// ============================================================
// /api/v1/workspaces/[id]/categories/[categoryId]
// PATCH  — Renommer / repositionner (MANAGE_CHANNELS)
// DELETE — Supprimer (les salons restent, détachés — set null)
// ============================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/db";
import { workspaceCategories } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { apiErrorResponse, readJson } from "@/lib/api/errors";
import {
  getWorkspaceOr404,
  requirePermission,
  WorkspaceError,
} from "@/lib/workspaces/service";
import { WS_PERMISSIONS } from "@/lib/workspaces/permissions";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string; categoryId: string }> };

const patchSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  position: z.number().int().min(0).max(1000).optional(),
});

async function getCategoryOr404(workspaceId: string, categoryId: string) {
  const [cat] = await db
    .select()
    .from(workspaceCategories)
    .where(
      and(
        eq(workspaceCategories.id, categoryId),
        eq(workspaceCategories.workspaceId, workspaceId)
      )
    )
    .limit(1);
  if (!cat) throw new WorkspaceError("Catégorie introuvable", 404);
  return cat;
}

export async function PATCH(req: Request, { params }: RouteContext) {
  try {
    const user = await requireUser();
    const { id, categoryId } = await params;
    const ws = await getWorkspaceOr404(id);
    await requirePermission(ws, user.userId, WS_PERMISSIONS.MANAGE_CHANNELS);
    const cat = await getCategoryOr404(ws.id, categoryId);
    const input = patchSchema.parse(await readJson(req));

    const [updated] = await db
      .update(workspaceCategories)
      .set({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.position !== undefined ? { position: input.position } : {}),
      })
      .where(eq(workspaceCategories.id, cat.id))
      .returning();

    return NextResponse.json({ ok: true, category: updated });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  try {
    const user = await requireUser();
    const { id, categoryId } = await params;
    const ws = await getWorkspaceOr404(id);
    await requirePermission(ws, user.userId, WS_PERMISSIONS.MANAGE_CHANNELS);
    const cat = await getCategoryOr404(ws.id, categoryId);

    await db
      .delete(workspaceCategories)
      .where(eq(workspaceCategories.id, cat.id));
    return NextResponse.json({ ok: true, deleted: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
