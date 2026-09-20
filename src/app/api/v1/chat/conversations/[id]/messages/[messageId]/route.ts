// ============================================================
// /api/v1/chat/conversations/[id]/messages/[messageId]
// PATCH  — Modifier MON message texte (auteur uniquement)
// DELETE — Supprimer MON message (soft delete : « message
//          supprimé » façon WhatsApp — le contenu disparaît
//          mais pas la ligne de discussion)
// → broadcasts WS « message:update » / « message:delete »
// ============================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/db";
import { chatMessages } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { apiErrorResponse, readJson } from "@/lib/api/errors";
import {
  getConversationOr404,
  requireMembership,
  ChatError,
} from "@/lib/chat/service";
import { emitToRoom } from "@/lib/realtime/emit";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string; messageId: string }>;
};

const patchSchema = z.object({
  content: z.string().trim().min(1, "Message vide").max(4000),
});

async function getMessageOr404(conversationId: string, messageId: string) {
  const [msg] = await db
    .select()
    .from(chatMessages)
    .where(
      and(
        eq(chatMessages.id, messageId),
        eq(chatMessages.conversationId, conversationId)
      )
    )
    .limit(1);
  if (!msg) throw new ChatError("Message introuvable", 404);
  return msg;
}

export async function PATCH(req: Request, { params }: RouteContext) {
  try {
    const user = await requireUser();
    const { id, messageId } = await params;
    const conv = await getConversationOr404(id);
    await requireMembership(conv.id, user.userId);
    const msg = await getMessageOr404(conv.id, messageId);

    if (msg.senderId !== user.userId) {
      throw new ChatError("Seul l'auteur peut modifier son message", 403);
    }
    if (msg.deletedAt) throw new ChatError("Message déjà supprimé", 400);
    if (msg.type !== "text") {
      throw new ChatError("Seuls les messages texte se modifient", 400);
    }

    const input = patchSchema.parse(await readJson(req));
    const [updated] = await db
      .update(chatMessages)
      .set({ content: input.content, editedAt: new Date() })
      .where(eq(chatMessages.id, msg.id))
      .returning();

    await emitToRoom("/chat", `conversation:${conv.id}`, "message:update", {
      message: updated,
      conversationId: conv.id,
    });

    return NextResponse.json({ ok: true, message: updated });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  try {
    const user = await requireUser();
    const { id, messageId } = await params;
    const conv = await getConversationOr404(id);
    await requireMembership(conv.id, user.userId);
    const msg = await getMessageOr404(conv.id, messageId);

    if (msg.senderId !== user.userId) {
      throw new ChatError("Tu ne peux supprimer que tes propres messages", 403);
    }
    if (!msg.deletedAt) {
      await db
        .update(chatMessages)
        .set({ deletedAt: new Date(), content: null })
        .where(eq(chatMessages.id, msg.id));
    }

    await emitToRoom("/chat", `conversation:${conv.id}`, "message:delete", {
      messageId: msg.id,
      conversationId: conv.id,
    });

    return NextResponse.json({ ok: true, deleted: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
