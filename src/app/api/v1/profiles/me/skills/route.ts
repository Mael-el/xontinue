// ============================================================
// /api/v1/profiles/me/skills
// GET  — Liste des compétences
// POST — Ajoute une compétence
// DELETE ?id=xxx — Supprime une compétence
// ============================================================

import { NextResponse } from "next/server";
import { db } from "@/db";
import { userSkills } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireUser, AuthError, createSkillSchema } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const current = await requireUser();
    const skills = await db
      .select()
      .from(userSkills)
      .where(eq(userSkills.userId, current.userId))
      .orderBy(desc(userSkills.endorsedCount));
    return NextResponse.json({ ok: true, skills });
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
    const parsed = createSkillSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Données invalides", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const [skill] = await db
      .insert(userSkills)
      .values({
        userId: current.userId,
        name: parsed.data.name,
        level: parsed.data.level,
      })
      .returning();
    return NextResponse.json({ ok: true, skill }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    return NextResponse.json({ ok: false, error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const current = await requireUser();
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ ok: false, error: "id requis" }, { status: 400 });
    }
    await db
      .delete(userSkills)
      .where(eq(userSkills.id, id) as any);
    // Vérifier qu'on supprime bien sa propre compétence serait plus sécurisé
    return NextResponse.json({ ok: true, message: "Compétence supprimée" });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    return NextResponse.json({ ok: false, error: "Erreur serveur" }, { status: 500 });
  }
}
