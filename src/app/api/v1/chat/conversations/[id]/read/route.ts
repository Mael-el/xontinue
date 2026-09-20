// ============================================================
// /api/v1/chat/conversations/[id]/read
// POST — Marquer la conversation comme lue :
//        pointeur de lecture → dernier message, compteur à 0,
//        accusés (message_reads) créés en masse (idempotent)
// → broadcast WS « message:read » (les autres mettent à jour
//   leurs ✓✓ en bleu)
// ============================================================

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { apiErrorResponse } from "@/lib/api/errors";
import {
  getConversationOr404,
  markConversationRead,
} from "@/lib/chat/service";
import { emitToRoom } from "@/lib/realtime/emit";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const conv = await getConversationOr404(id);

    const { lastReadMessageId, readCount } = await markConversationRead(
      conv.id,
      user.userId
    );

    // Les autres participants basculent leurs coches en bleu
    if (lastReadMessageId) {
      await emitToRoom("/chat", `conversation:${conv.id}`, "message:read", {
        conversationId: conv.id,
        userId: user.userId,
        lastReadMessageId,
      });
    }

    return NextResponse.json({
      ok: true,
      lastReadMessageId,
      readCount,
      unreadCount: 0,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
