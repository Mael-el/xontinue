// ============================================================
// /api/v1/workspaces/[id]/roles
// GET  — Liste des rôles (membre requis)
// POST — Créer un rôle (MANAGE_ROLES)
//        permissions : noms (ex: ["SEND_MESSAGES"]) ou entier masque
// ============================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/db";
import { workspaceRoles } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { apiErrorResponse, readJson } from "@/lib/api/errors";
import {
  getWorkspaceOr404,
  requireMembership,
  requirePermission,
} from "@/lib/workspaces/service";
import {
  ALL_PERMISSIONS,
  permissionsFromNames,
  WS_PERMISSIONS,
} from "@/lib/workspaces/permissions";
import { maskToNames } from "@/lib/workspaces/service";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
  color: z.string().trim().max(20).optional(),
  position: z.number().int().min(0).max(1000).optional(),
  /** Noms de permissions (convertis en masque) OU masque entier. */
  permissions: z
    .union([z.array(z.string()), z.number().int().min(0)])
    .optional(),
});

function toPublicRole(r: typeof workspaceRoles.$inferSelect) {
  return {
    id: r.id,
    name: r.name,
    color: r.color,
    position: r.position,
    permissions: r.permissions,
    permissionNames: maskToNames(r.permissions),
  };
}

export async function GET(_req: Request, { params }: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const ws = await getWorkspaceOr404(id);
    await requireMembership(ws.id, user.userId);

    const roles = await db
      .select()
      .from(workspaceRoles)
      .where(eq(workspaceRoles.workspaceId, ws.id))
      .orderBy(desc(workspaceRoles.position));

    return NextResponse.json({ ok: true, roles: roles.map(toPublicRole) });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(req: Request, { params }: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const ws = await getWorkspaceOr404(id);
    await requirePermission(ws, user.userId, WS_PERMISSIONS.MANAGE_ROLES);
    const input = createSchema.parse(await readJson(req));

    const mask =
      input.permissions === undefined
        ? 0
        : typeof input.permissions === "number"
          ? Math.min(input.permissions, ALL_PERMISSIONS)
          : permissionsFromNames(input.permissions);

    const [role] = await db
      .insert(workspaceRoles)
      .values({
        workspaceId: ws.id,
        name: input.name,
        color: input.color ?? "#94A3B8",
        position: input.position ?? 0,
        permissions: mask,
      })
      .returning();

    return NextResponse.json(
      { ok: true, role: toPublicRole(role) },
      { status: 201 }
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
