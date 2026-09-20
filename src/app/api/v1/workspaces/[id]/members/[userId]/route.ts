// ============================================================
// /api/v1/workspaces/[id]/members/[userId]
// DELETE — Exclure un membre (MANAGE_MEMBERS ou KICK_MEMBERS) ;
//          impossible d'exclure le propriétaire, ni de s'exclure
//          soi-même (utiliser /leave).
// ============================================================

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/db";
import { workspaceMembers, workspaces } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { apiErrorResponse } from "@/lib/api/errors";
import {
  getMembership,
  getPermissionMask,
  getWorkspaceOr404,
  WorkspaceError,
} from "@/lib/workspaces/service";
import { WS_PERMISSIONS, hasPermission } from "@/lib/workspaces/permissions";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string; userId: string }> };

export async function DELETE(_req: Request, { params }: RouteContext) {
  try {
    const user = await requireUser();
    const { id, userId: targetUserId } = await params;
    const ws = await getWorkspaceOr404(id);

    if (targetUserId === user.userId) {
      throw new WorkspaceError(
        "Utilise la route « leave » pour quitter l'espace",
        400
      );
    }
    if (targetUserId === ws.ownerId) {
      throw new WorkspaceError(
        "Impossible d'exclure le propriétaire de l'espace",
        400
      );
    }

    // Il faut MANAGE_MEMBERS ou KICK_MEMBERS
    const mask = await getPermissionMask(ws, user.userId);
    if (
      !hasPermission(mask, WS_PERMISSIONS.MANAGE_MEMBERS) &&
      !hasPermission(mask, WS_PERMISSIONS.KICK_MEMBERS)
    ) {
      throw new WorkspaceError("Permission insuffisante", 403);
    }

    const target = await getMembership(ws.id, targetUserId);
    if (!target) {
      throw new WorkspaceError("Cette personne n'est pas membre", 404);
    }

    // Les attributions de rôles tombent en cascade
    await db
      .delete(workspaceMembers)
      .where(eq(workspaceMembers.id, target.id));
    await db
      .update(workspaces)
      .set({ memberCount: sql`greatest(${workspaces.memberCount} - 1, 0)` })
      .where(eq(workspaces.id, ws.id));

    return NextResponse.json({ ok: true, removed: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
