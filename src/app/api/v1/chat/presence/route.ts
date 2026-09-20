// ============================================================
// /api/v1/chat/presence
// GET  — Présences d'une liste d'utilisateurs (?userIds=a,b,c)
//        Source : serveur temps réel (mémoire TTL 120 s) en
//        priorité, sinon store local + base (lastSeenAt)
// POST — Heartbeat : { status? } — réactive le TTL (120 s) et
//        persiste l'activité (throttle : 1 ligne / user)
// ============================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { apiErrorResponse, readJson } from "@/lib/api/errors";
import {
  getPresenceMany,
  persistLastSeen,
  presenceStore,
  type PublicPresence,
} from "@/lib/chat/presence";
import { queryRealtimePresence } from "@/lib/realtime/emit";

export const dynamic = "force-dynamic";

const heartbeatSchema = z.object({
  status: z.enum(["online", "away", "dnd"]).default("online"),
});

export async function GET(req: Request) {
  try {
    await requireUser();
    const url = new URL(req.url);
    const raw = url.searchParams.get("userIds") ?? "";
    const userIds = [...new Set(raw.split(",").map((s) => s.trim()).filter(Boolean))].slice(0, 100);
    if (userIds.length === 0) {
      return NextResponse.json({ ok: true, presence: {} });
    }

    // Autorité : le serveur temps réel connaît les sockets vivants
    const live = await queryRealtimePresence(userIds);
    const base = await getPresenceMany(userIds);

    const presence: Record<string, PublicPresence> = {};
    for (const id of userIds) {
      const liveStatus = live?.[id];
      presence[id] =
        liveStatus && liveStatus !== "offline"
          ? { status: liveStatus as PublicPresence["status"], lastSeenAt: new Date().toISOString() }
          : (base[id] ?? { status: "offline", lastSeenAt: null });
    }
    return NextResponse.json({ ok: true, presence });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const { status } = heartbeatSchema.parse(await readJson(req));

    presenceStore.heartbeat(user.userId, status);
    // Persistance best-effort (pas d'attente bloquante)
    void persistLastSeen(user.userId, status).catch(() => {});

    return NextResponse.json({
      ok: true,
      status,
      ttlSeconds: 120,
      heartbeatIntervalSeconds: 30,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
