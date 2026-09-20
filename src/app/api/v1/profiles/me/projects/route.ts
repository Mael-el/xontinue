// ============================================================
// /api/v1/profiles/me/projects
// GET  — Liste des projets (portfolio)
// POST — Ajoute un projet
// ============================================================

import { NextResponse } from "next/server";
import { db } from "@/db";
import { userProjects } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireUser, AuthError, createProjectSchema } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const current = await requireUser();
    const projects = await db
      .select()
      .from(userProjects)
      .where(eq(userProjects.userId, current.userId))
      .orderBy(desc(userProjects.isFeatured), desc(userProjects.createdAt));
    return NextResponse.json({ ok: true, projects });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    return NextResponse.json({ ok: false, error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const current = await requireUser();
    const body = await req.json();
    const parsed = createProjectSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Données invalides", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const [project] = await db
      .insert(userProjects)
      .values({
        userId: current.userId,
        ...parsed.data,
      })
      .returning();
    return NextResponse.json({ ok: true, project }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    return NextResponse.json({ ok: false, error: "Erreur serveur" }, { status: 500 });
  }
}
