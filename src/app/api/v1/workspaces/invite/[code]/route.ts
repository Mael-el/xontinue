// ============================================================
// /api/v1/workspaces/invite/[code]
// GET  — Aperçu public de l'espace derrière le code (nom,
//        membres, validité) avant de rejoindre
// POST — Rejoindre l'espace avec ce code :
//        validité (expiration / max d'utilisations), idempotent
//        si déjà membre, attribution du rôle par défaut
// ============================================================

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/db";
import { workspaceInvites, workspaces } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { apiErrorResponse } from "@/lib/api/errors";
import {
  getMembership,
  getWorkspaceOr404,
  toPublicWorkspace,
  WorkspaceError,
} from "@/lib/workspaces/service";
import { getDefaultMemberRole } from "@/lib/workspaces/create";
import {
  checkInviteValidity,
  normalizeInviteCode,
} from "@/lib/workspaces/invites";
import {
  workspaceMembers,
  workspaceMemberRoles,
} from "@/db/schema";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ code: string }> };

async function getInvite(code: string) {
  const [row] = await db
    .select()
    .from(workspaceInvites)
    .where(eq(workspaceInvites.code, normalizeInviteCode(code)))
    .limit(1);
  if (!row) throw new WorkspaceError("Invitation introuvable", 404);
  return row;
}

function validityMessage(validity: { ok: boolean; reason?: string }): string {
  if (validity.reason === "expired") return "Ce lien d'invitation a expiré";
  if (validity.reason === "exhausted")
    return "Ce lien d'invitation a atteint sa limite d'utilisations";
  return "Invitation invalide";
}

export async function GET(_req: Request, { params }: RouteContext) {
  try {
    const user = await requireUser();
    const { code } = await params;
    const invite = await getInvite(code);
    const ws = await getWorkspaceOr404(invite.workspaceId);
    const validity = checkInviteValidity(invite);
    const membership = await getMembership(ws.id, user.userId);

    return NextResponse.json({
      ok: true,
      workspace: toPublicWorkspace(ws),
      valid: validity.ok,
      reason: validity.ok ? null : (validity as { reason: string }).reason,
      message: validity.ok ? null : validityMessage(validity),
      alreadyMember: !!membership,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(_req: Request, { params }: RouteContext) {
  try {
    const user = await requireUser();
    const { code } = await params;
    const invite = await getInvite(code);
    const ws = await getWorkspaceOr404(invite.workspaceId);

    // Déjà membre → NO-OP idempotent (le lien reste valable pour d'autres)
    const existing = await getMembership(ws.id, user.userId);
    if (existing) {
      return NextResponse.json({
        ok: true,
        workspace: toPublicWorkspace(ws),
        alreadyMember: true,
      });
    }

    const validity = checkInviteValidity(invite);
    if (!validity.ok) {
      throw new WorkspaceError(validityMessage(validity), 410);
    }

    const [member] = await db
      .insert(workspaceMembers)
      .values({ workspaceId: ws.id, userId: user.userId })
      .returning();
    const defaultRole = await getDefaultMemberRole(ws.id);
    if (defaultRole) {
      await db.insert(workspaceMemberRoles).values({
        memberId: member.id,
        roleId: defaultRole.id,
      });
    }

    await db
      .update(workspaces)
      .set({ memberCount: sql`${workspaces.memberCount} + 1` })
      .where(eq(workspaces.id, ws.id));
    await db
      .update(workspaceInvites)
      .set({ usesCount: sql`${workspaceInvites.usesCount} + 1` })
      .where(eq(workspaceInvites.id, invite.id));

    return NextResponse.json(
      {
        ok: true,
        workspace: toPublicWorkspace(ws),
        alreadyMember: false,
        joined: true,
      },
      { status: 201 }
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
