// ============================================================
// /api/v1/workspaces/[id]/invites/[code]
// DELETE — Révoque une invitation (MANAGE_WORKSPACE/​MEMBERS)
// ============================================================

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/db";
import { workspaceInvites } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { apiErrorResponse } from "@/lib/api/errors";
import {
  getPermissionMask,
  getWorkspaceOr404,
  WorkspaceError,
} from "@/lib/workspaces/service";
import {
  hasPermission,
  WS_PERMISSIONS,
} from "@/lib/workspaces/permissions";
import { normalizeInviteCode } from "@/lib/workspaces/invites";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string; code: string }> };

export async function DELETE(_req: Request, { params }: RouteContext) {
  try {
    const user = await requireUser();
    const { id, code } = await params;
    const ws = await getWorkspaceOr404(id);
    const mask = await getPermissionMask(ws, user.userId);
    if (
      !hasPermission(mask, WS_PERMISSIONS.MANAGE_WORKSPACE) &&
      !hasPermission(mask, WS_PERMISSIONS.MANAGE_MEMBERS)
    ) {
      throw new WorkspaceError("Permission insuffisante", 403);
    }

    const codeNorm = normalizeInviteCode(code);
    const [deleted] = await db
      .delete(workspaceInvites)
      .where(
        and(
          eq(workspaceInvites.workspaceId, ws.id),
          eq(workspaceInvites.code, codeNorm)
        )
      )
      .returning({ id: workspaceInvites.id });
    if (!deleted) throw new WorkspaceError("Invitation introuvable", 404);

    return NextResponse.json({ ok: true, revoked: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
