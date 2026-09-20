// ============================================================
// /api/v1/chat/conversations/[id]
// GET    — Détail (membres + présence correspondant)
// PATCH  — Renommer / changer l'avatar (groupes : admin uniquement)
// DELETE — Quitter la conversation (groupes) — les 1-1 restent
// ============================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/db";
import { conversationMembers, conversations } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { apiErrorResponse, readJson } from "@/lib/api/errors";
import {
  getConversationOr404,
  listMembers,
  requireMembership,
  ChatError,
} from "@/lib/chat/service";
import { getPresenceMany } from "@/lib/chat/presence";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  avatarUrl: z.string().trim().max(500).nullable().optional(),
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
      conversation: {
        id: conv.id,
        type: conv.type,
        name: conv.name,
        avatarUrl: conv.avatarUrl,
        isEncrypted: conv.isEncrypted,
        createdById: conv.createdById,
        lastMessageAt: conv.lastMessageAt,
        createdAt: conv.createdAt,
      },
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

export async function PATCH(req: Request, { params }: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const conv = await getConversationOr404(id);
    const membership = await requireMembership(conv.id, user.userId);

    if (conv.type !== "group") {
      throw new ChatError(
        "Les conversations 1-1 ne se personnalisent pas",
        400
      );
    }
    if (membership.role !== "admin") {
      throw new ChatError("Seul un admin peut modifier le groupe", 403);
    }

    const input = patchSchema.parse(await readJson(req));
    const [updated] = await db
      .update(conversations)
      .set({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl } : {}),
        updatedAt: new Date(),
      })
      .where(eq(conversations.id, conv.id))
      .returning();

    return NextResponse.json({ ok: true, conversation: updated });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const conv = await getConversationOr404(id);
    const membership = await requireMembership(conv.id, user.userId);

    if (conv.type !== "group") {
      throw new ChatError(
        "Une conversation 1-1 ne se quitte pas (elle reste dans l'historique)",
        400
      );
    }
    await db
      .delete(conversationMembers)
      .where(eq(conversationMembers.id, membership.id));
    return NextResponse.json({ ok: true, left: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
