// ============================================================
// /api/v1/workspaces
// GET  — Mes espaces de travail (dont je suis membre)
// POST — Créer un espace (catégorie « Général », salons
//        « général » + « Vocal », rôles Admin/Membre)
// ============================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { apiErrorResponse, readJson } from "@/lib/api/errors";
import { listMyWorkspaces, toPublicWorkspace } from "@/lib/workspaces/service";
import { createWorkspaceWithDefaults } from "@/lib/workspaces/create";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: z.string().trim().min(2, "Nom trop court").max(120),
  description: z.string().trim().max(2000).optional(),
  icon: z.string().trim().max(20).optional(),
  isPublic: z.boolean().optional(),
});

export async function GET() {
  try {
    const user = await requireUser();
    const rows = await listMyWorkspaces(user.userId);
    return NextResponse.json({ ok: true, workspaces: rows });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const input = createSchema.parse(await readJson(req));
    const { workspace } = await createWorkspaceWithDefaults(user.userId, input);
    return NextResponse.json(
      { ok: true, workspace: toPublicWorkspace(workspace) },
      { status: 201 }
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
