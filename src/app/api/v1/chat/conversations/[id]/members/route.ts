// ============================================================
// /api/v1/chat/conversations/[id]/members
// GET  — Membres (membre requis)
// POST — Ajouter des membres à un GROUPE (admin uniquement)
// ============================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/db";
import { conversationMembers, users } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { apiErrorResponse, readJson } from "@/lib/api/errors";
import {
  getConversationOr404,
  listMembers,
  requireMembership,
  ChatError,
} from "@/lib/chat/service";
import { getPresenceMany } from "@/lib/chat/presence";
import { emitToRooms } from "@/lib/realtime/emit";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

const addSchema = z.object({
  userIds: z.array(z.string().uuid()).min(1).max(50),
});

export async function GET(_req: Request, { params }: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const conv = await getConversationOr404(id);
    await requireMembership(conv.id, user.userId);

    const members = await listMembers(conv.id);
    const presence = await getPresenceMany(members.map((m) => m.userId));
    return NextResponse.json({
      ok: true,
      members: members.map((m) => ({
        id: m.id,
        userId: m.userId,
        fullName: m.fullName,
        avatarUrl: m.avatarUrl,
        role: m.role,
        joinedAt: m.joinedAt,
        presence: presence[m.userId] ?? null,
      })),
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

    if (conv.type !== "group") {
      throw new ChatError(
        "Impossible d'ajouter des membres à une conversation 1-1 — crée un groupe",
        400
      );
    }
    if (membership.role !== "admin") {
      throw new ChatError("Seul un admin peut ajouter des membres", 403);
    }

    const input = addSchema.parse(await readJson(req));

    // Les utilisateurs doivent exister
    const found = await db
      .select({ id: users.id })
      .from(users)
      .where(inArray(users.id, input.userIds));
    const foundIds = new Set(found.map((f) => f.id));
    if (foundIds.size !== input.userIds.length) {
      throw new ChatError("Certains utilisateurs sont introuvables", 404);
    }

    // Déjà membres ?
    const existing = await db
      .select({ userId: conversationMembers.userId })
      .from(conversationMembers)
      .where(
        and(
          eq(conversationMembers.conversationId, conv.id),
          inArray(conversationMembers.userId, input.userIds)
        )
      );
    const existingIds = new Set(existing.map((e) => e.userId));
    const toAdd = input.userIds.filter((uid) => !existingIds.has(uid));

    if (toAdd.length > 0) {
      await db.insert(conversationMembers).values(
        toAdd.map((userId) => ({
          conversationId: conv.id,
          userId,
          role: "member" as const,
        }))
      );
      // Leur client se resynchronise via l'événement (room user)
      await emitToRooms(
        "/chat",
        toAdd.map((uid) => `user:${uid}`),
        "conversation:added",
        { conversationId: conv.id }
      );
    }

    return NextResponse.json({
      ok: true,
      added: toAdd,
      alreadyMembers: [...existingIds],
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
