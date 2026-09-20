// ============================================================
// /api/v1/chat/conversations/[id]/messages
// GET  — Page de messages (+ réactions agrégées, statut ✓✓
//        pour mes messages, extraits des réponses citées)
// POST — Envoyer : texte et/ou pièce(s) jointe(s) en base64
//        (image / fichier / vocal WebM-OGG / vidéo) — une requête
//        crée le message + ses attachments
//   ├─ bump des compteurs « non lus » des autres membres
//   ├─ broadcast WS « message:new » (room conversation + rooms users)
//   └─ notification in-app aux membres hors ligne (relais « push »)
// ============================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/db";
import {
  chatMessages,
  messageAttachments,
  users,
} from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { apiErrorResponse, readJson } from "@/lib/api/errors";
import {
  computePageDelivery,
  getConversationOr404,
  listMembers,
  listMessages,
  requireMembership,
  sendChatMessage,
} from "@/lib/chat/service";
import { aggregateReactions } from "@/lib/chat/reactions";
import { statusToTicks } from "@/lib/chat/read-status";
import { saveAttachmentFromBase64 } from "@/lib/uploads";
import { emitToRooms } from "@/lib/realtime/emit";
import { queryRealtimePresence } from "@/lib/realtime/emit";
import { notifyUser } from "@/lib/notifications";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

const attachmentSchema = z.object({
  fileName: z.string().min(1).max(255),
  mimeType: z.string().min(3).max(120),
  dataBase64: z.string().min(1),
  durationSeconds: z.number().int().min(0).max(36000).nullable().optional(),
});

const sendSchema = z
  .object({
    content: z.string().max(4000).optional(),
    type: z.enum(["text", "image", "file", "audio", "video"]).default("text"),
    replyToId: z.string().uuid().nullable().optional(),
    attachments: z.array(attachmentSchema).max(5).optional(),
    clientRef: z.string().max(64).optional(), // idempotence côté client
  })
  .refine(
    (v) => (v.content && v.content.trim().length > 0) || v.attachments?.length,
    { message: "Contenu ou pièce jointe requis" }
  );

const MAX_PAGE = 50;

export async function GET(req: Request, { params }: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const conv = await getConversationOr404(id);
    await requireMembership(conv.id, user.userId);

    const url = new URL(req.url);
    const beforeParam = url.searchParams.get("before");
    const before = beforeParam ? new Date(beforeParam) : undefined;
    const limit = Math.min(
      Number(url.searchParams.get("limit") ?? MAX_PAGE) || MAX_PAGE,
      100
    );

    const { messages, hasMore } = await listMessages(conv.id, {
      before: before && !Number.isNaN(before.getTime()) ? before : undefined,
      limit,
    });
    const visible = messages.filter((m) => !m.deletedAt);

    // Attachments du lot
    const ids = visible.map((m) => m.id);
    const attachments =
      ids.length > 0
        ? await db
            .select()
            .from(messageAttachments)
            .where(inArray(messageAttachments.messageId, ids))
        : [];
    const attByMsg = new Map<string, typeof attachments>();
    for (const a of attachments) {
      const arr = attByMsg.get(a.messageId) ?? [];
      arr.push(a);
      attByMsg.set(a.messageId, arr);
    }

    // Réactions agrégées + statuts de livraison (batch)
    const reactions = await aggregateReactions(ids, user.userId);
    const delivery = await computePageDelivery(visible, user.userId);

    // Extraits des messages cités
    const replyIds = [...new Set(visible.flatMap((m) => (m.replyToId ? [m.replyToId] : [])))];
    const replies =
      replyIds.length > 0
        ? await db
            .select({
              id: chatMessages.id,
              senderId: chatMessages.senderId,
              type: chatMessages.type,
              content: chatMessages.content,
              senderName: users.fullName,
            })
            .from(chatMessages)
            .innerJoin(users, eq(chatMessages.senderId, users.id))
            .where(inArray(chatMessages.id, replyIds))
        : [];
    const replyMap = new Map(replies.map((r) => [r.id, r]));

    // Auteurs (une passe)
    const authorIds = [...new Set(visible.map((m) => m.senderId))];
    const authors =
      authorIds.length > 0
        ? await db
            .select({ id: users.id, fullName: users.fullName, avatarUrl: users.avatarUrl })
            .from(users)
            .where(inArray(users.id, authorIds))
        : [];
    const authorMap = new Map(authors.map((a) => [a.id, a]));

    return NextResponse.json({
      ok: true,
      messages: visible.map((m) => {
        const status = m.senderId === user.userId ? delivery[m.id] : undefined;
        return {
          id: m.id,
          conversationId: m.conversationId,
          senderId: m.senderId,
          type: m.type,
          content: m.content,
          replyToId: m.replyToId,
          replyTo: m.replyToId ? (replyMap.get(m.replyToId) ?? null) : null,
          editedAt: m.editedAt,
          createdAt: m.createdAt,
          author: authorMap.get(m.senderId) ?? null,
          attachments: attByMsg.get(m.id) ?? [],
          reactions: reactions[m.id] ?? [],
          ...(status
            ? { delivery: status, ticks: statusToTicks(status) }
            : {}),
        };
      }),
      hasMore,
      nextBefore: hasMore ? visible[0]?.createdAt.toISOString() : null,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(req: Request, { params }: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const conv = await getConversationOr404(id);
    const membership = await requireMembership(conv.id, user.userId);
    const input = sendSchema.parse(await readJson(req));

    const { message, author } = await sendChatMessage({
      conversationId: conv.id,
      senderId: user.userId,
      type: input.type,
      content: input.content ?? null,
      replyToId: input.replyToId ?? null,
    });

    // Pièces jointes : stockage local + lignes d'attachments
    const saved = [];
    for (const att of input.attachments ?? []) {
      const stored = await saveAttachmentFromBase64(att);
      const [row] = await db
        .insert(messageAttachments)
        .values({
          messageId: message.id,
          uploaderId: user.userId,
          fileName: stored.fileName,
          mimeType: att.mimeType,
          sizeBytes: stored.sizeBytes,
          url: stored.url,
          durationSeconds: att.durationSeconds ?? null,
        })
        .returning();
      saved.push(row);
    }

    const payload = {
      message: {
        ...message,
        author,
        attachments: saved,
        reactions: [],
        delivery: "sent",
        clientRef: input.clientRef ?? null,
      },
      conversationId: conv.id,
    };

    // Diffusion temps réel : room conversation (membres ouverts)
    const members = await listMembers(conv.id);
    const others = members.filter((m) => m.userId !== user.userId);
    await emitToRooms(
      "/chat",
      [`conversation:${conv.id}`, ...others.map((m) => `user:${m.userId}`)],
      "message:new",
      payload
    );

    // Relais « push » : notification in-app aux membres hors ligne
    // (Web Push/FCM = point d'extension documenté ; l'in-app couvre
    // le cas du navigateur ouvert sur un autre onglet du site)
    try {
      const presences = await queryRealtimePresence(
        others.map((m) => m.userId)
      );
      for (const m of others) {
        const status = presences?.[m.userId] ?? "offline";
        if (status !== "online") {
          void notifyUser(m.userId, {
            type: "system",
            title: `💬 ${author?.fullName ?? "Nouveau message"}`,
            body:
              conv.type === "group"
                ? `${conv.name} : ${(message.content ?? "📎 Pièce jointe").slice(0, 80)}`
                : (message.content ?? "📎 Pièce jointe").slice(0, 80),
            href: `/messages/${conv.id}`,
          });
        }
      }
    } catch {
      // notifications best-effort
    }

    return NextResponse.json(
      {
        ok: true,
        ...payload,
        myUnreadCount: membership.unreadCount,
      },
      { status: 201 }
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
