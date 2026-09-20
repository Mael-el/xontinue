// ============================================================
// /api/v1/workspaces/[id]/members/[userId]/roles
// PUT — Remplace l'ensemble des rôles d'un membre
//       (MANAGE_ROLES requis ; impossible sur le propriétaire)
// ============================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/db";
import {
  workspaceMemberRoles,
  workspaceRoles,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { apiErrorResponse, readJson } from "@/lib/api/errors";
import {
  getMembership,
  getWorkspaceOr404,
  requirePermission,
  WorkspaceError,
} from "@/lib/workspaces/service";
import { WS_PERMISSIONS } from "@/lib/workspaces/permissions";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string; userId: string }> };

const schema = z.object({
  roleIds: z.array(z.string().uuid()).max(20),
});

export async function PUT(req: Request, { params }: RouteContext) {
  try {
    const user = await requireUser();
    const { id, userId: targetUserId } = await params;
    const ws = await getWorkspaceOr404(id);
    await requirePermission(ws, user.userId, WS_PERMISSIONS.MANAGE_ROLES);

    if (targetUserId === ws.ownerId) {
      throw new WorkspaceError(
        "Les rôles du propriétaire ne se modifient pas",
        400
      );
    }
    const member = await getMembership(ws.id, targetUserId);
    if (!member) throw new WorkspaceError("Cette personne n'est pas membre", 404);

    const input = schema.parse(await readJson(req));

    // Les rôles doivent appartenir à CET espace
    const valid = input.roleIds.length
      ? await db
          .select({ id: workspaceRoles.id })
          .from(workspaceRoles)
          .where(eq(workspaceRoles.workspaceId, ws.id))
      : [];
    const validIds = new Set(valid.map((r) => r.id));
    const unknown = input.roleIds.filter((r) => !validIds.has(r));
    if (unknown.length > 0) {
      throw new WorkspaceError(
        `Rôles inconnus pour cet espace : ${unknown.length} fourni(s)`,
        400
      );
    }

    await db
      .delete(workspaceMemberRoles)
      .where(eq(workspaceMemberRoles.memberId, member.id));
    if (input.roleIds.length > 0) {
      await db.insert(workspaceMemberRoles).values(
        input.roleIds.map((roleId) => ({ memberId: member.id, roleId }))
      );
    }
    return NextResponse.json({ ok: true, roleIds: input.roleIds });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
