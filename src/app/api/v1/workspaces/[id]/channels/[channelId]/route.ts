// ============================================================
// /api/v1/workspaces/[id]/channels/[channelId]
// PATCH  — Modifier un salon (MANAGE_CHANNELS)
// DELETE — Supprimer un salon (MANAGE_CHANNELS)
// ============================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/db";
import { workspaceChannels } from "@/db/schema";
import { eq } from "drizzle-orm";
import { apiErrorResponse, readJson } from "@/lib/api/errors";
import {
  getChannelOr404,
  getWorkspaceOr404,
  requirePermission,
} from "@/lib/workspaces/service";
import { WS_PERMISSIONS } from "@/lib/workspaces/permissions";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string; channelId: string }> };

const patchSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  topic: z.string().trim().max(250).nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  position: z.number().int().min(0).max(1000).optional(),
  isPrivate: z.boolean().optional(),
  type: z.enum(["text", "voice", "announcement", "forum"]).optional(),
});

export async function PATCH(req: Request, { params }: RouteContext) {
  try {
    const user = await requireUser();
    const { id, channelId } = await params;
    const ws = await getWorkspaceOr404(id);
    await requirePermission(ws, user.userId, WS_PERMISSIONS.MANAGE_CHANNELS);
    const channel = await getChannelOr404(channelId, ws.id);
    const input = patchSchema.parse(await readJson(req));

    const [updated] = await db
      .update(workspaceChannels)
      .set({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.topic !== undefined ? { topic: input.topic } : {}),
        ...(input.categoryId !== undefined
          ? { categoryId: input.categoryId }
          : {}),
        ...(input.position !== undefined ? { position: input.position } : {}),
        ...(input.isPrivate !== undefined ? { isPrivate: input.isPrivate } : {}),
        ...(input.type !== undefined ? { type: input.type } : {}),
        updatedAt: new Date(),
      })
      .where(eq(workspaceChannels.id, channel.id))
      .returning();

    return NextResponse.json({ ok: true, channel: updated });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  try {
    const user = await requireUser();
    const { id, channelId } = await params;
    const ws = await getWorkspaceOr404(id);
    await requirePermission(ws, user.userId, WS_PERMISSIONS.MANAGE_CHANNELS);
    const channel = await getChannelOr404(channelId, ws.id);

    await db
      .delete(workspaceChannels)
      .where(eq(workspaceChannels.id, channel.id));
    return NextResponse.json({ ok: true, deleted: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
