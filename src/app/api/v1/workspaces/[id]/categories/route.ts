// ============================================================
// /api/v1/workspaces/[id]/categories
// GET  — Catégories de l'espace (tri par position)
// POST — Créer une catégorie (MANAGE_CHANNELS)
// ============================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/db";
import { workspaceCategories } from "@/db/schema";
import { asc, eq, sql } from "drizzle-orm";
import { apiErrorResponse, readJson } from "@/lib/api/errors";
import {
  getWorkspaceOr404,
  requireMembership,
  requirePermission,
} from "@/lib/workspaces/service";
import { WS_PERMISSIONS } from "@/lib/workspaces/permissions";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/** Prochaine position (fin de liste) des catégories d'un espace. */
async function nextCategoryPosition(workspaceId: string) {
  const [row] = await db
    .select({
      value: sql<number>`coalesce(max(${workspaceCategories.position}), -1)`,
    })
    .from(workspaceCategories)
    .where(eq(workspaceCategories.workspaceId, workspaceId));
  return Number(row?.value ?? -1) + 1;
}

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
});

export async function GET(_req: Request, { params }: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const ws = await getWorkspaceOr404(id);
    await requireMembership(ws.id, user.userId);

    const categories = await db
      .select()
      .from(workspaceCategories)
      .where(eq(workspaceCategories.workspaceId, ws.id))
      .orderBy(asc(workspaceCategories.position));

    return NextResponse.json({ ok: true, categories });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(req: Request, { params }: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const ws = await getWorkspaceOr404(id);
    await requirePermission(ws, user.userId, WS_PERMISSIONS.MANAGE_CHANNELS);
    const input = createSchema.parse(await readJson(req));

    const position = await nextCategoryPosition(ws.id);
    const [category] = await db
      .insert(workspaceCategories)
      .values({ workspaceId: ws.id, name: input.name, position })
      .returning();

    return NextResponse.json({ ok: true, category }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
