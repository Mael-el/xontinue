// ============================================================
// /api/v1/workspaces/[id]/invites
// GET  — Invitations actives de l'espace (MANAGE_WORKSPACE)
// POST — Créer un code d'invitation (MANAGE_WORKSPACE ou
//        MANAGE_MEMBERS) — options : maxUses, expiresInHours
// ============================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/db";
import { workspaceInvites } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { apiErrorResponse, readJson } from "@/lib/api/errors";
import {
  getPermissionMask,
  getWorkspaceOr404,
  WorkspaceError,
} from "@/lib/workspaces/service";
import { hasPermission, WS_PERMISSIONS } from "@/lib/workspaces/permissions";
import { generateInviteCode } from "@/lib/workspaces/invites";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

const createSchema = z.object({
  maxUses: z.number().int().min(1).max(10000).nullable().optional(),
  expiresInHours: z.number().min(0.5).max(24 * 30).nullable().optional(),
});

async function assertInvitePermission(workspaceId: string, userId: string) {
  const ws = await getWorkspaceOr404(workspaceId);
  const mask = await getPermissionMask(ws, userId);
  const ok =
    hasPermission(mask, WS_PERMISSIONS.MANAGE_WORKSPACE) ||
    hasPermission(mask, WS_PERMISSIONS.MANAGE_MEMBERS);
  if (!ok) throw new WorkspaceError("Permission insuffisante", 403);
  return ws;
}

export async function GET(_req: Request, { params }: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await params;
    await assertInvitePermission(id, user.userId);

    const invites = await db
      .select()
      .from(workspaceInvites)
      .where(eq(workspaceInvites.workspaceId, id))
      .orderBy(desc(workspaceInvites.createdAt));

    return NextResponse.json({ ok: true, invites });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(req: Request, { params }: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await params;
    await assertInvitePermission(id, user.userId);
    const input = createSchema.parse(await readJson(req));

    const expiresAt = input.expiresInHours
      ? new Date(Date.now() + input.expiresInHours * 3600_000)
      : null;

    // Collision de code : on retente 3 fois (code unique en base)
    let invite = null;
    for (let attempt = 0; attempt < 3 && !invite; attempt++) {
      try {
        [invite] = await db
          .insert(workspaceInvites)
          .values({
            workspaceId: id,
            code: generateInviteCode(),
            creatorId: user.userId,
            maxUses: input.maxUses ?? null,
            expiresAt,
          })
          .returning();
      } catch (error) {
        if (attempt === 2) throw error;
      }
    }

    return NextResponse.json(
      {
        ok: true,
        invite,
        inviteUrl: `/workspaces/invite/${invite!.code}`,
      },
      { status: 201 }
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
