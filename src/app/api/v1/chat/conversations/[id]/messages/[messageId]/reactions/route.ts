// ============================================================
// /api/v1/chat/conversations/[id]/messages/[messageId]/reactions
// POST — Basculer une réaction emoji { emoji } :
//        ajoutée → retirée (toggle idempotent) ;
//        20 emojis distincts max par message (garde-fou métier)
// → broadcast WS « reaction:update » (état agrégé complet)
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
import { aggregateReactions, toggleReaction } from "@/lib/chat/reactions";
import { emitToRoom } from "@/lib/realtime/emit";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string; messageId: string }>;
};

const schema = z.object({
  emoji: z.string().trim().min(1).max(16),
});

export async function POST(req: Request, { params }: RouteContext) {
  try {
    const user = await requireUser();
    const { id, messageId } = await params;
    const conv = await getConversationOr404(id);
    await requireMembership(conv.id, user.userId);
    const input = schema.parse(await readJson(req));

    const [msg] = await db
      .select({ id: chatMessages.id })
      .from(chatMessages)
      .where(
        and(
          eq(chatMessages.id, messageId),
          eq(chatMessages.conversationId, conv.id)
        )
      )
      .limit(1);
    if (!msg) throw new ChatError("Message introuvable", 404);

    const result = await toggleReaction(msg.id, user.userId, input.emoji);
    const aggregated = await aggregateReactions([msg.id], user.userId);

    await emitToRoom("/chat", `conversation:${conv.id}`, "reaction:update", {
      messageId: msg.id,
      conversationId: conv.id,
      reactions: aggregated[msg.id] ?? [],
    });

    return NextResponse.json({
      ok: true,
      ...result,
      reactions: aggregated[msg.id] ?? [],
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
