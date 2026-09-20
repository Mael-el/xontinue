// ============================================================
// /api/v1/chat/conversations
// GET  — Mes conversations (aperçu dernier message, non lus,
//        présence du correspondant en 1-1)
// POST — Créer : { userId } → conversation directe (IDEMPOTENT,
//        une seule paire existe) ; { name, memberIds } → groupe
// ============================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/db";
import {
  chatMessages,
  conversationMembers,
  conversations,
  users,
} from "@/db/schema";
import { desc, eq, inArray } from "drizzle-orm";
import { apiErrorResponse, readJson } from "@/lib/api/errors";
import {
  createGroupConversation,
  getOrCreateDirectConversation,
  listMembers,
  ChatError,
} from "@/lib/chat/service";
import { getPresenceMany } from "@/lib/chat/presence";

export const dynamic = "force-dynamic";

const createSchema = z
  .object({
    userId: z.string().uuid().optional(),
    name: z.string().trim().min(2).max(120).optional(),
    memberIds: z.array(z.string().uuid()).min(1).max(100).optional(),
  })
  .refine((v) => v.userId || (v.name && v.memberIds?.length), {
    message: "Fournis userId (1-1) ou name + memberIds (groupe)",
  });

/** Sérialise une conversation pour la liste (avec enrichissements). */
async function listForUser(userId: string) {
  const memberships = await db
    .select({
      conversationId: conversationMembers.conversationId,
      unreadCount: conversationMembers.unreadCount,
      joinedAt: conversationMembers.joinedAt,
    })
    .from(conversationMembers)
    .where(eq(conversationMembers.userId, userId));

  if (memberships.length === 0) return [];
  const ids = memberships.map((m) => m.conversationId);
  const unreadByConv = new Map(memberships.map((m) => [m.conversationId, m.unreadCount]));

  const convs = await db
    .select()
    .from(conversations)
    .where(inArray(conversations.id, ids))
    .orderBy(desc(conversations.lastMessageAt));

  // Dernier message de chaque conversation (une passe)
  const lastMsgs = await db
    .select({
      id: chatMessages.id,
      conversationId: chatMessages.conversationId,
      senderId: chatMessages.senderId,
      type: chatMessages.type,
      content: chatMessages.content,
      createdAt: chatMessages.createdAt,
    })
    .from(chatMessages)
    .where(inArray(chatMessages.conversationId, ids))
    .orderBy(desc(chatMessages.createdAt));
  const lastByConv = new Map<string, (typeof lastMsgs)[number]>();
  for (const m of lastMsgs) {
    if (!lastByConv.has(m.conversationId)) lastByConv.set(m.conversationId, m);
  }

  // Correspondants (1-1) pour nom + présence
  const directIds = convs.filter((c) => c.type === "direct").map((c) => c.id);
  const peers =
    directIds.length > 0
      ? await db
          .select({
            conversationId: conversationMembers.conversationId,
            userId: conversationMembers.userId,
            fullName: users.fullName,
            avatarUrl: users.avatarUrl,
          })
          .from(conversationMembers)
          .innerJoin(users, eq(conversationMembers.userId, users.id))
          .where(inArray(conversationMembers.conversationId, directIds))
      : [];
  const peerByConv = new Map<string, (typeof peers)[number]>();
  for (const p of peers) {
    if (p.userId !== userId && !peerByConv.has(p.conversationId)) {
      peerByConv.set(p.conversationId, p);
    }
  }
  const presence = await getPresenceMany([
    ...new Set(peers.filter((p) => p.userId !== userId).map((p) => p.userId)),
  ]);

  return convs.map((c) => {
    const peer = peerByConv.get(c.id) ?? null;
    const last = lastByConv.get(c.id) ?? null;
    return {
      id: c.id,
      type: c.type,
      name: c.type === "group" ? c.name : (peer?.fullName ?? "Utilisateur"),
      avatarUrl: c.type === "group" ? c.avatarUrl : (peer?.avatarUrl ?? null),
      peerId: peer?.userId ?? null,
      peerPresence: peer ? (presence[peer.userId] ?? null) : null,
      unreadCount: unreadByConv.get(c.id) ?? 0,
      lastMessage: last
        ? {
            id: last.id,
            senderId: last.senderId,
            type: last.type,
            preview:
              last.type === "text"
                ? (last.content ?? "").slice(0, 80)
                : `📎 ${last.type}`,
            createdAt: last.createdAt,
          }
        : null,
      lastMessageAt: c.lastMessageAt,
      createdAt: c.createdAt,
    };
  });
}

export async function GET() {
  try {
    const user = await requireUser();
    const list = await listForUser(user.userId);
    return NextResponse.json({ ok: true, conversations: list });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const input = createSchema.parse(await readJson(req));

    if (input.userId) {
      // Vérifie que le destinataire existe
      const [peer] = await db
        .select({ id: users.id, fullName: users.fullName, avatarUrl: users.avatarUrl })
        .from(users)
        .where(eq(users.id, input.userId))
        .limit(1);
      if (!peer) throw new ChatError("Utilisateur introuvable", 404);

      const { conversation, created } = await getOrCreateDirectConversation(
        user.userId,
        input.userId
      );
      return NextResponse.json(
        {
          ok: true,
          conversation: {
            id: conversation.id,
            type: conversation.type,
            name: peer.fullName,
            avatarUrl: peer.avatarUrl,
            peerId: peer.id,
          },
          created,
        },
        { status: created ? 201 : 200 }
      );
    }

    const conversation = await createGroupConversation(
      user.userId,
      input.name!,
      input.memberIds!
    );
    return NextResponse.json(
      {
        ok: true,
        conversation: {
          id: conversation.id,
          type: conversation.type,
          name: conversation.name,
          avatarUrl: conversation.avatarUrl,
        },
        created: true,
      },
      { status: 201 }
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
