// ============================================================
// /api/v1/chat/conversations/[id]/calls
// GET  — Historique des appels (les « ringing » expirés > 60 s
//        sont consolidés en « missed »)
// POST — Démarrer un appel audio/vidéo → statut « ringing »,
//        notification « call:incoming » à tous les membres
// ============================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/db";
import { callParticipants, calls, users } from "@/db/schema";
import { and, desc, eq, lt, sql } from "drizzle-orm";
import { apiErrorResponse, readJson } from "@/lib/api/errors";
import {
  getConversationOr404,
  listMembers,
  requireMembership,
} from "@/lib/chat/service";
import { emitToRooms } from "@/lib/realtime/emit";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/** Appel resté « ringing » plus longtemps = manqué. */
const RING_TIMEOUT_MS = 60_000;

const startSchema = z.object({
  type: z.enum(["audio", "video"]).default("audio"),
});

export async function GET(_req: Request, { params }: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const conv = await getConversationOr404(id);
    await requireMembership(conv.id, user.userId);

    // Consolide les sonneries expirées en « missed »
    await db
      .update(calls)
      .set({ status: "missed", endedAt: sql`now()` })
      .where(
        and(
          eq(calls.conversationId, conv.id),
          eq(calls.status, "ringing"),
          lt(calls.startedAt, new Date(Date.now() - RING_TIMEOUT_MS))
        )
      );

    const history = await db
      .select({
        id: calls.id,
        type: calls.type,
        status: calls.status,
        startedAt: calls.startedAt,
        endedAt: calls.endedAt,
        initiatorId: calls.initiatorId,
        initiatorName: users.fullName,
        initiatorAvatar: users.avatarUrl,
      })
      .from(calls)
      .innerJoin(users, eq(calls.initiatorId, users.id))
      .where(eq(calls.conversationId, conv.id))
      .orderBy(desc(calls.startedAt))
      .limit(50);

    return NextResponse.json({ ok: true, calls: history });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(req: Request, { params }: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const conv = await getConversationOr404(id);
    await requireMembership(conv.id, user.userId);
    const input = startSchema.parse(await readJson(req));

    const [call] = await db
      .insert(calls)
      .values({
        conversationId: conv.id,
        initiatorId: user.userId,
        type: input.type,
        status: "ringing",
      })
      .returning();
    await db.insert(callParticipants).values({
      callId: call.id,
      userId: user.userId,
    });

    // Sonnerie chez tous les autres membres
    const members = await listMembers(conv.id);
    const others = members.filter((m) => m.userId !== user.userId);
    await emitToRooms(
      "/chat",
      others.map((m) => `user:${m.userId}`),
      "call:incoming",
      {
        call: {
          id: call.id,
          type: call.type,
          status: call.status,
          startedAt: call.startedAt,
        },
        conversationId: conv.id,
        conversationName:
          conv.type === "group" ? conv.name : undefined,
        from: {
          id: user.userId,
        },
      }
    );

    return NextResponse.json({ ok: true, call }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
