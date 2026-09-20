// ============================================================
// /api/v1/workspaces/[id]/channels/[channelId]/messages
// GET  — Messages du salon (page de 50, curseur `before` ISO)
// POST — Envoyer un message (règles : see sendWorkspaceMessage)
//        → broadcast WS « message:new » via le pont temps réel
// ============================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/db";
import { users, workspaceMessages } from "@/db/schema";
import { and, desc, eq, inArray, lt } from "drizzle-orm";
import { apiErrorResponse, readJson } from "@/lib/api/errors";
import {
  getChannelOr404,
  getPermissionMask,
  getWorkspaceOr404,
  requireMembership,
  sendWorkspaceMessage,
} from "@/lib/workspaces/service";
import { hasPermission, WS_PERMISSIONS } from "@/lib/workspaces/permissions";
import { emitToRoom } from "@/lib/realtime/emit";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string; channelId: string }> };

const sendSchema = z.object({
  content: z.string().min(1).max(4000),
  replyToId: z.string().uuid().nullable().optional(),
});

const PAGE_SIZE = 50;

export async function GET(req: Request, { params }: RouteContext) {
  try {
    const user = await requireUser();
    const { id, channelId } = await params;
    const ws = await getWorkspaceOr404(id);
    await requireMembership(ws.id, user.userId);
    const channel = await getChannelOr404(channelId, ws.id);

    const url = new URL(req.url);
    const beforeParam = url.searchParams.get("before");
    const before = beforeParam ? new Date(beforeParam) : null;
    const limit = Math.min(
      Number(url.searchParams.get("limit") ?? PAGE_SIZE) || PAGE_SIZE,
      100
    );

    const conditions = [eq(workspaceMessages.channelId, channel.id)];
    if (before && !Number.isNaN(before.getTime())) {
      conditions.push(lt(workspaceMessages.createdAt, before));
    }

    const rows = await db
      .select({
        id: workspaceMessages.id,
        channelId: workspaceMessages.channelId,
        authorId: workspaceMessages.authorId,
        content: workspaceMessages.content,
        replyToId: workspaceMessages.replyToId,
        editedAt: workspaceMessages.editedAt,
        createdAt: workspaceMessages.createdAt,
        authorName: users.fullName,
        authorAvatar: users.avatarUrl,
      })
      .from(workspaceMessages)
      .innerJoin(users, eq(workspaceMessages.authorId, users.id))
      .where(and(...conditions))
      .orderBy(desc(workspaceMessages.createdAt), desc(workspaceMessages.id))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit).reverse();

    // Extraits des messages cités (replyTo)
    const replyIds = [...new Set(page.flatMap((m) => (m.replyToId ? [m.replyToId] : [])))];
    const replies =
      replyIds.length > 0
        ? await db
            .select({
              id: workspaceMessages.id,
              authorId: workspaceMessages.authorId,
              content: workspaceMessages.content,
              authorName: users.fullName,
            })
            .from(workspaceMessages)
            .innerJoin(users, eq(workspaceMessages.authorId, users.id))
            .where(inArray(workspaceMessages.id, replyIds))
        : [];
    const replyMap = new Map(replies.map((r) => [r.id, r]));

    return NextResponse.json({
      ok: true,
      messages: page.map((m) => ({
        id: m.id,
        channelId: m.channelId,
        authorId: m.authorId,
        content: m.content,
        replyToId: m.replyToId,
        replyTo: m.replyToId ? (replyMap.get(m.replyToId) ?? null) : null,
        editedAt: m.editedAt,
        createdAt: m.createdAt,
        author: { id: m.authorId, fullName: m.authorName, avatarUrl: m.authorAvatar },
      })),
      hasMore,
      nextBefore: hasMore ? page[0]?.createdAt?.toISOString() : null,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(req: Request, { params }: RouteContext) {
  try {
    const user = await requireUser();
    const { id, channelId } = await params;
    const ws = await getWorkspaceOr404(id);
    const channel = await getChannelOr404(channelId, ws.id);
    const input = sendSchema.parse(await readJson(req));

    await requireMembership(ws.id, user.userId);
    const mask = await getPermissionMask(ws, user.userId);
    if (!hasPermission(mask, WS_PERMISSIONS.SEND_MESSAGES)) {
      return NextResponse.json(
        { ok: false, error: "Permission insuffisante" },
        { status: 403 }
      );
    }

    const { message, author } = await sendWorkspaceMessage({
      workspace: ws,
      channel,
      authorId: user.userId,
      content: input.content,
      replyToId: input.replyToId ?? null,
    });

    const payload = {
      message: { ...message, author },
      channelId: channel.id,
      workspaceId: ws.id,
    };
    // Diffusion temps réel (best-effort — la BDD reste la vérité)
    await emitToRoom("/workspace", `channel:${channel.id}`, "message:new", payload);

    return NextResponse.json({ ok: true, ...payload }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
