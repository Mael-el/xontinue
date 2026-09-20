// ============================================================
// /api/v1/workspaces/[id]/leave
// POST — Quitter l'espace (le propriétaire doit d'abord le
//        supprimer : pas de transfert de propriété en v1)
// ============================================================

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/db";
import { workspaceMembers, workspaces } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { apiErrorResponse } from "@/lib/api/errors";
import {
  getMembership,
  getWorkspaceOr404,
  WorkspaceError,
} from "@/lib/workspaces/service";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const ws = await getWorkspaceOr404(id);

    if (ws.ownerId === user.userId) {
      throw new WorkspaceError(
        "Le propriétaire ne peut pas quitter l'espace — supprime-le d'abord",
        400
      );
    }
    const member = await getMembership(ws.id, user.userId);
    if (!member) throw new WorkspaceError("Tu n'es pas membre", 404);

    await db.delete(workspaceMembers).where(eq(workspaceMembers.id, member.id));
    await db
      .update(workspaces)
      .set({ memberCount: sql`greatest(${workspaces.memberCount} - 1, 0)` })
      .where(eq(workspaces.id, ws.id));

    return NextResponse.json({ ok: true, left: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
