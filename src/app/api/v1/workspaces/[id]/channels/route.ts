// ============================================================
// /api/v1/workspaces/[id]/channels
// GET  — Salons de l'espace (+ participants vocaux en direct)
// POST — Créer un salon (MANAGE_CHANNELS), types :
//        text | voice | announcement | forum
// ============================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/db";
import {
  users,
  workspaceChannels,
  workspaceVoiceStates,
} from "@/db/schema";
import { asc, eq, sql } from "drizzle-orm";
import { apiErrorResponse, readJson } from "@/lib/api/errors";
import {
  getWorkspaceOr404,
  requireMembership,
  requirePermission,
} from "@/lib/workspaces/service";
import { WS_PERMISSIONS } from "@/lib/workspaces/permissions";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
  type: z.enum(["text", "voice", "announcement", "forum"]).default("text"),
  topic: z.string().trim().max(250).optional(),
  categoryId: z.string().uuid().nullable().optional(),
  isPrivate: z.boolean().optional(),
});

export async function GET(_req: Request, { params }: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const ws = await getWorkspaceOr404(id);
    await requireMembership(ws.id, user.userId);

    const channels = await db
      .select()
      .from(workspaceChannels)
      .where(eq(workspaceChannels.workspaceId, ws.id))
      .orderBy(asc(workspaceChannels.position), asc(workspaceChannels.name));

    // Participants présents dans les salons vocaux
    const voice = await db
      .select({
        channelId: workspaceVoiceStates.channelId,
        userId: workspaceVoiceStates.userId,
        muted: workspaceVoiceStates.muted,
        deafened: workspaceVoiceStates.deafened,
        fullName: users.fullName,
        avatarUrl: users.avatarUrl,
      })
      .from(workspaceVoiceStates)
      .innerJoin(users, eq(workspaceVoiceStates.userId, users.id))
      .innerJoin(
        workspaceChannels,
        eq(workspaceVoiceStates.channelId, workspaceChannels.id)
      )
      .where(eq(workspaceChannels.workspaceId, ws.id));

    const voiceByChannel = new Map<string, typeof voice>();
    for (const v of voice) {
      const arr = voiceByChannel.get(v.channelId) ?? [];
      arr.push(v);
      voiceByChannel.set(v.channelId, arr);
    }

    return NextResponse.json({
      ok: true,
      channels: channels.map((c) => ({
        ...c,
        voiceParticipants: voiceByChannel.get(c.id) ?? [],
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
    const ws = await getWorkspaceOr404(id);
    await requirePermission(ws, user.userId, WS_PERMISSIONS.MANAGE_CHANNELS);
    const input = createSchema.parse(await readJson(req));

    const [row] = await db
      .select({
        value: sql<number>`coalesce(max(${workspaceChannels.position}), -1)`,
      })
      .from(workspaceChannels)
      .where(eq(workspaceChannels.workspaceId, ws.id));

    const [channel] = await db
      .insert(workspaceChannels)
      .values({
        workspaceId: ws.id,
        categoryId: input.categoryId ?? null,
        name: input.name,
        type: input.type,
        topic: input.topic ?? null,
        isPrivate: input.isPrivate ?? false,
        position: Number(row?.value ?? -1) + 1,
      })
      .returning();

    return NextResponse.json({ ok: true, channel }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
