// ============================================================
// /api/v1/workspaces/[id]
// GET    — Détail de l'espace (membre requis) + mes permissions
// PATCH  — Modifier (permission MANAGE_WORKSPACE)
// DELETE — Supprimer l'espace (propriétaire uniquement)
// ============================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/db";
import { workspaces } from "@/db/schema";
import { eq } from "drizzle-orm";
import { apiErrorResponse, readJson } from "@/lib/api/errors";
import {
  getWorkspaceOr404,
  getMembership,
  getPermissionMask,
  requirePermission,
  toPublicWorkspace,
} from "@/lib/workspaces/service";
import { maskToNames } from "@/lib/workspaces/service";
import { WS_PERMISSIONS } from "@/lib/workspaces/permissions";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  icon: z.string().trim().max(20).nullable().optional(),
  bannerUrl: z.string().trim().max(500).nullable().optional(),
  isPublic: z.boolean().optional(),
});

export async function GET(_req: Request, { params }: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const ws = await getWorkspaceOr404(id);
    // Lecture réservée aux membres (sauf espace public : aperçu autorisé)
    const member = await getMembership(ws.id, user.userId);
    if (!member && !ws.isPublic) {
      return NextResponse.json(
        { ok: false, error: "Tu n'es pas membre de cet espace" },
        { status: 403 }
      );
    }
    const mask = await getPermissionMask(ws, user.userId);
    return NextResponse.json({
      ok: true,
      workspace: toPublicWorkspace(ws, {
        isOwner: ws.ownerId === user.userId,
        myPermissions: maskToNames(mask),
      }),
      membership: member
        ? { id: member.id, nickname: member.nickname, joinedAt: member.joinedAt }
        : null,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(req: Request, { params }: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const ws = await getWorkspaceOr404(id);
    await requirePermission(ws, user.userId, WS_PERMISSIONS.MANAGE_WORKSPACE);
    const input = patchSchema.parse(await readJson(req));

    const [updated] = await db
      .update(workspaces)
      .set({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined
          ? { description: input.description }
          : {}),
        ...(input.icon !== undefined ? { icon: input.icon } : {}),
        ...(input.bannerUrl !== undefined ? { bannerUrl: input.bannerUrl } : {}),
        ...(input.isPublic !== undefined ? { isPublic: input.isPublic } : {}),
        updatedAt: new Date(),
      })
      .where(eq(workspaces.id, ws.id))
      .returning();

    return NextResponse.json({
      ok: true,
      workspace: toPublicWorkspace(updated),
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const ws = await getWorkspaceOr404(id);
    if (ws.ownerId !== user.userId) {
      return NextResponse.json(
        { ok: false, error: "Seul le propriétaire peut supprimer l'espace" },
        { status: 403 }
      );
    }
    // Les salons/rôles/membres/messages/invitations tombent en cascade
    await db.delete(workspaces).where(eq(workspaces.id, ws.id));
    return NextResponse.json({ ok: true, deleted: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
