// ============================================================
// /api/v1/chat/conversations/[id]/members/[userId]
// DELETE — Retirer un membre d'un groupe (admin) ou se retirer
//          soi-même. Le dernier admin ne peut pas partir.
// ============================================================

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/db";
import { conversationMembers } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { apiErrorResponse } from "@/lib/api/errors";
import {
  getConversationOr404,
  getMembership,
  requireMembership,
  ChatError,
} from "@/lib/chat/service";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string; userId: string }> };

export async function DELETE(_req: Request, { params }: RouteContext) {
  try {
    const user = await requireUser();
    const { id, userId: targetUserId } = await params;
    const conv = await getConversationOr404(id);
    const myMembership = await requireMembership(conv.id, user.userId);

    if (conv.type !== "group") {
      throw new ChatError("Opération réservée aux groupes", 400);
    }

    const self = targetUserId === user.userId;
    if (!self && myMembership.role !== "admin") {
      throw new ChatError("Seul un admin peut retirer un membre", 403);
    }

    const target = await getMembership(conv.id, targetUserId);
    if (!target) throw new ChatError("Membre introuvable", 404);

    // Garde-fou : le dernier admin reste (sinon groupe sans pilote)
    if (target.role === "admin") {
      const admins = await db
        .select({ id: conversationMembers.id })
        .from(conversationMembers)
        .where(
          and(
            eq(conversationMembers.conversationId, conv.id),
            eq(conversationMembers.role, "admin")
          )
        );
      if (admins.length <= 1) {
        throw new ChatError(
          "Impossible de retirer le dernier admin du groupe",
          400
        );
      }
    }

    await db
      .delete(conversationMembers)
      .where(eq(conversationMembers.id, target.id));
    return NextResponse.json({ ok: true, removed: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
