// ============================================================
// /api/v1/chat/calls/[callId]
// GET   — Détail d'un appel (membre de la conversation requis)
// PATCH — Action : join | leave | decline | end
//         join    → status ongoing, participant ajouté
//         leave   → participant.leftAt ; tous partis → ended
//         decline → ringing → declined (1-1)
//         end     → terminateur d'appel (initiateur ou admin)
// → broadcasts « call:joined / call:left / call:ended »
// ============================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/db";
import { callParticipants, calls } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { apiErrorResponse, readJson } from "@/lib/api/errors";
import { requireMembership, ChatError } from "@/lib/chat/service";
import { emitToRoom } from "@/lib/realtime/emit";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ callId: string }> };

const actionSchema = z.object({
  action: z.enum(["join", "leave", "decline", "end"]),
});

async function getCallOr404(callId: string) {
  const [call] = await db.select().from(calls).where(eq(calls.id, callId)).limit(1);
  if (!call) throw new ChatError("Appel introuvable", 404);
  return call;
}

export async function GET(_req: Request, { params }: RouteContext) {
  try {
    const user = await requireUser();
    const { callId } = await params;
    const call = await getCallOr404(callId);
    await requireMembership(call.conversationId, user.userId);

    const participants = await db
      .select()
      .from(callParticipants)
      .where(eq(callParticipants.callId, call.id));

    return NextResponse.json({ ok: true, call, participants });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(req: Request, { params }: RouteContext) {
  try {
    const user = await requireUser();
    const { callId } = await params;
    const call = await getCallOr404(callId);
    await requireMembership(call.conversationId, user.userId);
    const { action } = actionSchema.parse(await readJson(req));

    const finishedStatuses = ["ended", "missed", "declined"];
    const room = `conversation:${call.conversationId}`;

    switch (action) {
      case "join": {
        if (finishedStatuses.includes(call.status)) {
          throw new ChatError("Cet appel est terminé", 400);
        }
        await db
          .insert(callParticipants)
          .values({ callId: call.id, userId: user.userId })
          .onConflictDoUpdate({
            target: [
              callParticipants.callId,
              callParticipants.userId,
            ],
            set: { leftAt: null },
          });
        if (call.status === "ringing") {
          await db
            .update(calls)
            .set({ status: "ongoing" })
            .where(eq(calls.id, call.id));
        }
        await emitToRoom("/chat", room, "call:joined", {
          callId: call.id,
          userId: user.userId,
        });
        return NextResponse.json({ ok: true, status: "ongoing" });
      }

      case "leave": {
        await db
          .update(callParticipants)
          .set({ leftAt: new Date() })
          .where(
            and(
              eq(callParticipants.callId, call.id),
              eq(callParticipants.userId, user.userId)
            )
          );
        // Tout le monde est parti → l'appel s'achève
        const remaining = await db
          .select({ id: callParticipants.id })
          .from(callParticipants)
          .where(
            and(
              eq(callParticipants.callId, call.id),
              // encore connecté
              sql`${callParticipants.leftAt} is null`
            )
          );
        let status = call.status;
        if (remaining.length === 0 && !finishedStatuses.includes(call.status)) {
          status = call.status === "ringing" ? "missed" : "ended";
          await db
            .update(calls)
            .set({ status, endedAt: new Date() })
            .where(eq(calls.id, call.id));
        }
        await emitToRoom("/chat", room, "call:left", {
          callId: call.id,
          userId: user.userId,
          status,
        });
        return NextResponse.json({ ok: true, status });
      }

      case "decline": {
        if (call.status !== "ringing") {
          throw new ChatError("Impossible de refuser : l'appel n'est plus en cours", 400);
        }
        await db
          .update(calls)
          .set({ status: "declined", endedAt: new Date() })
          .where(eq(calls.id, call.id));
        await emitToRoom("/chat", room, "call:ended", {
          callId: call.id,
          status: "declined",
          by: user.userId,
        });
        return NextResponse.json({ ok: true, status: "declined" });
      }

      case "end": {
        if (finishedStatuses.includes(call.status)) {
          return NextResponse.json({ ok: true, status: call.status });
        }
        await db
          .update(calls)
          .set({ status: "ended", endedAt: new Date() })
          .where(eq(calls.id, call.id));
        await emitToRoom("/chat", room, "call:ended", {
          callId: call.id,
          status: "ended",
          by: user.userId,
        });
        return NextResponse.json({ ok: true, status: "ended" });
      }
    }
  } catch (error) {
    return apiErrorResponse(error);
  }
}
