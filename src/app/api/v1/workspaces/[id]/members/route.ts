// ============================================================
// /api/v1/workspaces/[id]/members
// GET — Membres de l'espace (avec leurs rôles)
// ============================================================

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/db";
import {
  users,
  workspaceMemberRoles,
  workspaceMembers,
  workspaceRoles,
} from "@/db/schema";
import { asc, eq, inArray } from "drizzle-orm";
import { apiErrorResponse } from "@/lib/api/errors";
import {
  getWorkspaceOr404,
  requireMembership,
} from "@/lib/workspaces/service";
import { maskToNames } from "@/lib/workspaces/service";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const ws = await getWorkspaceOr404(id);
    await requireMembership(ws.id, user.userId);

    const members = await db
      .select({
        id: workspaceMembers.id,
        userId: workspaceMembers.userId,
        nickname: workspaceMembers.nickname,
        joinedAt: workspaceMembers.joinedAt,
        fullName: users.fullName,
        avatarUrl: users.avatarUrl,
      })
      .from(workspaceMembers)
      .innerJoin(users, eq(workspaceMembers.userId, users.id))
      .where(eq(workspaceMembers.workspaceId, ws.id))
      .orderBy(asc(workspaceMembers.joinedAt));

    // Rôles de chaque membre (une requête groupée)
    const memberIds = members.map((m) => m.id);
    const roleRows =
      memberIds.length > 0
        ? await db
            .select({
              memberId: workspaceMemberRoles.memberId,
              roleId: workspaceMemberRoles.roleId,
              roleName: workspaceRoles.name,
              roleColor: workspaceRoles.color,
              rolePosition: workspaceRoles.position,
            })
            .from(workspaceMemberRoles)
            .innerJoin(
              workspaceRoles,
              eq(workspaceMemberRoles.roleId, workspaceRoles.id)
            )
            .where(inArray(workspaceMemberRoles.memberId, memberIds))
        : [];

    const rolesByMember = new Map<
      string,
      Array<{ id: string; name: string; color: string | null; position: number }>
    >();
    for (const r of roleRows) {
      const arr = rolesByMember.get(r.memberId) ?? [];
      arr.push({
        id: r.roleId,
        name: r.roleName,
        color: r.roleColor,
        position: r.rolePosition,
      });
      rolesByMember.set(r.memberId, arr);
    }

    return NextResponse.json({
      ok: true,
      members: members.map((m) => ({
        ...m,
        isOwner: m.userId === ws.ownerId,
        roles: (rolesByMember.get(m.id) ?? []).sort(
          (a, b) => b.position - a.position
        ),
      })),
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
