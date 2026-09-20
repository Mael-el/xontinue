// ============================================================
// /api/v1/workspaces/[id]/channels/[channelId]/messages/[messageId]
// PATCH  — Modifier MON message (auteur uniquement)
// DELETE — Supprimer : auteur, ou membre avec MANAGE_WORKSPACE /
//          MANAGE_CHANNELS (modération)
// → broadcasts WS « message:update » / « message:delete »
// ============================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/db";
import { workspaceMessages } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { apiErrorResponse, readJson } from "@/lib/api/errors";
import {
  getChannelOr404,
  getPermissionMask,
  getWorkspaceOr404,
  WorkspaceError,
} from "@/lib/workspaces/service";
import { hasPermission, WS_PERMISSIONS } from "@/lib/workspaces/permissions";
import { emitToRoom } from "@/lib/realtime/emit";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string; channelId: string; messageId: string }>;
};

const patchSchema = z.object({
  content: z.string().trim().min(1, "Message vide").max(4000),
});

async function getMessageOr404(channelId: string, messageId: string) {
  const [msg] = await db
    .select()
    .from(workspaceMessages)
    .where(
      and(
        eq(workspaceMessages.id, messageId),
        eq(workspaceMessages.channelId, channelId)
      )
    )
    .limit(1);
  if (!msg) throw new WorkspaceError("Message introuvable", 404);
  return msg;
}

export async function PATCH(req: Request, { params }: RouteContext) {
  try {
    const user = await requireUser();
    const { id, channelId, messageId } = await params;
    const ws = await getWorkspaceOr404(id);
    const channel = await getChannelOr404(channelId, ws.id);
    const msg = await getMessageOr404(channel.id, messageId);

    if (msg.authorId !== user.userId) {
      throw new WorkspaceError(
        "Seul l'auteur peut modifier son message",
        403
      );
    }
    const input = patchSchema.parse(await readJson(req));

    const [updated] = await db
      .update(workspaceMessages)
      .set({ content: input.content, editedAt: new Date() })
      .where(eq(workspaceMessages.id, msg.id))
      .returning();

    await emitToRoom("/workspace", `channel:${channel.id}`, "message:update", {
      message: updated,
      channelId: channel.id,
    });

    return NextResponse.json({ ok: true, message: updated });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  try {
    const user = await requireUser();
    const { id, channelId, messageId } = await params;
    const ws = await getWorkspaceOr404(id);
    const channel = await getChannelOr404(channelId, ws.id);
    const msg = await getMessageOr404(channel.id, messageId);

    if (msg.authorId !== user.userId) {
      const mask = await getPermissionMask(ws, user.userId);
      const canModerate =
        hasPermission(mask, WS_PERMISSIONS.MANAGE_WORKSPACE) ||
        hasPermission(mask, WS_PERMISSIONS.MANAGE_CHANNELS);
      if (!canModerate) {
        throw new WorkspaceError(
          "Tu ne peux supprimer que tes propres messages",
          403
        );
      }
    }

    await db
      .delete(workspaceMessages)
      .where(eq(workspaceMessages.id, msg.id));

    await emitToRoom("/workspace", `channel:${channel.id}`, "message:delete", {
      messageId: msg.id,
      channelId: channel.id,
    });

    return NextResponse.json({ ok: true, deleted: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
