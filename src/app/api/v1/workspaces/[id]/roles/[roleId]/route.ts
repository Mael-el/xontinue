// ============================================================
// /api/v1/workspaces/[id]/roles/[roleId]
// PATCH  — Modifier un rôle (MANAGE_ROLES)
// DELETE — Supprimer un rôle (MANAGE_ROLES ; attributions en
//          cascade ; impossible de supprimer le rôle par défaut)
// ============================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/db";
import { workspaceMemberRoles, workspaceRoles } from "@/db/schema";
import { and, asc, eq, sql } from "drizzle-orm";
import { apiErrorResponse, readJson } from "@/lib/api/errors";
import {
  getWorkspaceOr404,
  requirePermission,
  maskToNames,
  WorkspaceError,
} from "@/lib/workspaces/service";
import {
  ALL_PERMISSIONS,
  permissionsFromNames,
  WS_PERMISSIONS,
} from "@/lib/workspaces/permissions";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string; roleId: string }> };

const patchSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  color: z.string().trim().max(20).nullable().optional(),
  position: z.number().int().min(0).max(1000).optional(),
  permissions: z
    .union([z.array(z.string()), z.number().int().min(0)])
    .optional(),
});

async function getRoleOr404(workspaceId: string, roleId: string) {
  const [role] = await db
    .select()
    .from(workspaceRoles)
    .where(
      and(
        eq(workspaceRoles.id, roleId),
        eq(workspaceRoles.workspaceId, workspaceId)
      )
    )
    .limit(1);
  if (!role) throw new WorkspaceError("Rôle introuvable", 404);
  return role;
}

export async function PATCH(req: Request, { params }: RouteContext) {
  try {
    const user = await requireUser();
    const { id, roleId } = await params;
    const ws = await getWorkspaceOr404(id);
    const myMask = await requirePermission(
      ws,
      user.userId,
      WS_PERMISSIONS.MANAGE_ROLES
    );
    const role = await getRoleOr404(ws.id, roleId);
    const input = patchSchema.parse(await readJson(req));

    let newMask: number | undefined;
    if (input.permissions !== undefined) {
      const target =
        typeof input.permissions === "number"
          ? Math.min(input.permissions, ALL_PERMISSIONS)
          : permissionsFromNames(input.permissions);
      // Un non-propriétaire ne peut pas créer un rôle doté de
      // permissions qu'il ne possède pas lui-même (anti-escalade).
      const extra = target & ~myMask & ALL_PERMISSIONS;
      if (ws.ownerId !== user.userId && extra !== 0) {
        throw new WorkspaceError(
          "Impossible d'attribuer des permissions que tu n'as pas",
          403
        );
      }
      newMask = target;
    }

    const [updated] = await db
      .update(workspaceRoles)
      .set({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.color !== undefined ? { color: input.color } : {}),
        ...(input.position !== undefined ? { position: input.position } : {}),
        ...(newMask !== undefined ? { permissions: newMask } : {}),
      })
      .where(eq(workspaceRoles.id, role.id))
      .returning();

    return NextResponse.json({
      ok: true,
      role: {
        ...updated,
        permissionNames: maskToNames(updated.permissions),
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  try {
    const user = await requireUser();
    const { id, roleId } = await params;
    const ws = await getWorkspaceOr404(id);
    await requirePermission(ws, user.userId, WS_PERMISSIONS.MANAGE_ROLES);
    const role = await getRoleOr404(ws.id, roleId);

    // Le rôle par défaut = le plus bas en position : on le protège
    const [lowest] = await db
      .select({ id: workspaceRoles.id })
      .from(workspaceRoles)
      .where(eq(workspaceRoles.workspaceId, ws.id))
      .orderBy(asc(workspaceRoles.position))
      .limit(1);
    if (lowest?.id === role.id) {
      throw new WorkspaceError(
        "Impossible de supprimer le rôle par défaut (« Membre »)",
        400
      );
    }

    // Attributions d'abord (sécurité — cascade déjà en place)
    await db
      .delete(workspaceMemberRoles)
      .where(eq(workspaceMemberRoles.roleId, role.id));
    await db.delete(workspaceRoles).where(eq(workspaceRoles.id, role.id));
    return NextResponse.json({ ok: true, deleted: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
