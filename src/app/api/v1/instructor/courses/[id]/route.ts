// ============================================================
// INSTRUCTOR · FORMATION [id] (propriétaire uniquement)
// PATCH  → modifier les champs et/ou action publish|unpublish
//          (publish exige ≥ 1 leçon)
// DELETE → supprimer le brouillon — refusé s'il y a des inscrits
// ============================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { courses } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireRole, AuthError } from "@/lib/auth";
import { getOwnedCourse } from "@/lib/instructor";
import { courseSchema } from "../route";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

const patchSchema = courseSchema.partial().extend({
  action: z.enum(["publish", "unpublish"]).optional(),
});

export async function PATCH(req: Request, { params }: RouteContext) {
  try {
    const current = await requireRole("instructor", "admin");
    const { id } = await params;

    const owned = await getOwnedCourse(id, current.userId);
    if (!owned) {
      return NextResponse.json(
        { ok: false, error: "Formation introuvable" },
        { status: 404 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Données invalides", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { action, ...fields } = parsed.data;

    // ---- Action publier / dépublier ----
    if (action === "publish") {
      if (owned.lessonsCount === 0) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Ajoute au moins une leçon avant de publier ta formation.",
          },
          { status: 400 }
        );
      }
      const [updated] = await db
        .update(courses)
        .set({ status: "published", updatedAt: new Date() })
        .where(eq(courses.id, id))
        .returning({ status: courses.status });
      return NextResponse.json({
        ok: true,
        status: updated.status,
        message: "🚀 Ta formation est en ligne et visible dans le catalogue !",
      });
    }
    if (action === "unpublish") {
      const [updated] = await db
        .update(courses)
        .set({ status: "draft", updatedAt: new Date() })
        .where(eq(courses.id, id))
        .returning({ status: courses.status });
      return NextResponse.json({
        ok: true,
        status: updated.status,
        message: "Formation repassée en brouillon (les inscrits gardent l'accès).",
      });
    }

    // ---- Mise à jour des champs ----
    const updates: Record<string, unknown> = {};
    if (fields.title !== undefined) updates.title = fields.title;
    if (fields.subtitle !== undefined) updates.subtitle = fields.subtitle || null;
    if (fields.description !== undefined)
      updates.description = fields.description || null;
    if (fields.level !== undefined) updates.level = fields.level;
    if (fields.priceXof !== undefined) updates.priceXof = fields.priceXof;
    if (fields.thumbnailUrl !== undefined)
      updates.thumbnailUrl = fields.thumbnailUrl || null;
    if (fields.requirements !== undefined)
      updates.requirements = fields.requirements;
    if (fields.whatYouLearn !== undefined)
      updates.whatYouLearn = fields.whatYouLearn;
    if (fields.domainId !== undefined) updates.domainId = fields.domainId;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { ok: false, error: "Aucun champ à modifier" },
        { status: 400 }
      );
    }

    updates.updatedAt = new Date();
    await db.update(courses).set(updates).where(eq(courses.id, id));

    return NextResponse.json({ ok: true, message: "Formation mise à jour ✅" });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: error.status }
      );
    }
    console.error("instructor course PATCH error:", error);
    return NextResponse.json(
      { ok: false, error: "Erreur serveur" },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  try {
    const current = await requireRole("instructor", "admin");
    const { id } = await params;

    const owned = await getOwnedCourse(id, current.userId);
    if (!owned) {
      return NextResponse.json(
        { ok: false, error: "Formation introuvable" },
        { status: 404 }
      );
    }

    // On protège les données des étudiants : impossible de
    // supprimer une formation ayant des inscrits.
    if (owned.students > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: `Impossible : ${owned.students} étudiant(s) sont inscrits. Dépublie la formation à la place.`,
        },
        { status: 409 }
      );
    }

    await db.delete(courses).where(eq(courses.id, id));
    return NextResponse.json({ ok: true, deleted: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: error.status }
      );
    }
    console.error("instructor course DELETE error:", error);
    return NextResponse.json(
      { ok: false, error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
