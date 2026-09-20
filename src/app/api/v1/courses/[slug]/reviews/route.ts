// ============================================================
// /api/v1/courses/[slug]/reviews
// GET    — Avis d'un cours (public) + agrégats + mon avis si connecté
// POST   — Déposer / modifier mon avis (étudiants inscrits uniquement)
// DELETE — Supprimer mon avis
//
// Règle métier clé : seul un étudiant INSCRIT (inscription active
// ou terminée) peut noter la formation — avis "vérifiés".
// Chaque mutation recalcule la note dénormalisée du cours.
// ============================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { courseReviews, courses, enrollments, users } from "@/db/schema";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { getCurrentUser, requireUser, AuthError } from "@/lib/auth";
import { refreshCourseRating } from "@/lib/reviews";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ slug: string }> };

const reviewSchema = z.object({
  rating: z
    .number()
    .int("La note doit être un entier")
    .min(1, "Note minimum : 1")
    .max(5, "Note maximum : 5"),
  comment: z.string().trim().max(2000).optional(),
});

/** Récupère un cours publié par son slug (id + slug). */
async function findCourse(slug: string) {
  const [course] = await db
    .select({ id: courses.id, slug: courses.slug, title: courses.title })
    .from(courses)
    .where(eq(courses.slug, slug))
    .limit(1);
  return course ?? null;
}

/** Vérifie que l'utilisateur est inscrit (actif ou a terminé) au cours. */
async function isEnrolled(userId: string, courseId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: enrollments.id })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.userId, userId),
        eq(enrollments.courseId, courseId),
        inArray(enrollments.status, ["active", "completed"])
      )
    )
    .limit(1);
  return Boolean(row);
}

/**
 * GET /api/v1/courses/[slug]/reviews
 * Public. Retourne les 50 derniers avis, la moyenne (sur 5), le
 * total, la distribution par étoile — et, si l'utilisateur est
 * connecté : `myReview` et `canReview`.
 */
export async function GET(_req: Request, { params }: RouteContext) {
  try {
    const { slug } = await params;
    const course = await findCourse(slug);

    if (!course) {
      return NextResponse.json(
        { ok: false, error: "Cours introuvable" },
        { status: 404 }
      );
    }

    // Liste des avis + agrégats en parallèle
    const [reviews, [agg], distribution] = await Promise.all([
      db
        .select({
          id: courseReviews.id,
          rating: courseReviews.rating,
          comment: courseReviews.comment,
          createdAt: courseReviews.createdAt,
          updatedAt: courseReviews.updatedAt,
          author: {
            fullName: users.fullName,
            avatarUrl: users.avatarUrl,
            country: users.country,
          },
        })
        .from(courseReviews)
        .innerJoin(users, eq(courseReviews.userId, users.id))
        .where(eq(courseReviews.courseId, course.id))
        .orderBy(desc(courseReviews.createdAt))
        .limit(50),
      db
        .select({
          average: sql<number>`coalesce(round(avg(${courseReviews.rating})::numeric, 1), 0)::float`,
          count: sql<number>`count(*)::int`,
        })
        .from(courseReviews)
        .where(eq(courseReviews.courseId, course.id)),
      db
        .select({
          rating: courseReviews.rating,
          count: sql<number>`count(*)::int`,
        })
        .from(courseReviews)
        .where(eq(courseReviews.courseId, course.id))
        .groupBy(courseReviews.rating),
    ]);

    const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const d of distribution) dist[d.rating] = d.count;

    // Enrichissement si connecté : mon avis + éligibilité
    let myReview = null;
    let canReview = false;
    const current = await getCurrentUser();
    if (current) {
      const [mine] = await db
        .select({
          id: courseReviews.id,
          rating: courseReviews.rating,
          comment: courseReviews.comment,
          createdAt: courseReviews.createdAt,
        })
        .from(courseReviews)
        .where(
          and(
            eq(courseReviews.userId, current.userId),
            eq(courseReviews.courseId, course.id)
          )
        )
        .limit(1);

      myReview = mine ?? null;
      canReview = await isEnrolled(current.userId, course.id);
      // Un avis existant reste modifiable même si l'inscription a été annulée
      if (mine) canReview = true;
    }

    return NextResponse.json({
      ok: true,
      reviews,
      stats: {
        average: agg?.average ?? 0,
        count: agg?.count ?? 0,
        distribution: dist,
      },
      myReview,
      canReview,
    });
  } catch (error) {
    console.error("reviews GET error:", error);
    return NextResponse.json(
      { ok: false, error: "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/courses/[slug]/reviews
 * Dépose un avis, ou le MODIFIE s'il existe déjà (upsert logique,
 * un seul avis par étudiant et par cours). Réservé aux inscrits.
 */
export async function POST(req: Request, { params }: RouteContext) {
  try {
    const current = await requireUser();
    const { slug } = await params;

    const body = await req.json().catch(() => ({}));
    const parsed = reviewSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: "Données invalides",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const course = await findCourse(slug);
    if (!course) {
      return NextResponse.json(
        { ok: false, error: "Cours introuvable" },
        { status: 404 }
      );
    }

    // Seuls les étudiants inscrits (ou l'auteur d'un avis existant)
    // peuvent noter la formation
    const enrolled = await isEnrolled(current.userId, course.id);

    const [existing] = await db
      .select({ id: courseReviews.id })
      .from(courseReviews)
      .where(
        and(
          eq(courseReviews.userId, current.userId),
          eq(courseReviews.courseId, course.id)
        )
      )
      .limit(1);

    if (!enrolled && !existing) {
      return NextResponse.json(
        {
          ok: false,
          error: "Inscris-toi à cette formation pour laisser un avis",
          mustEnroll: true,
        },
        { status: 403 }
      );
    }

    let review;
    let created = false;
    if (existing) {
      [review] = await db
        .update(courseReviews)
        .set({
          rating: parsed.data.rating,
          comment: parsed.data.comment ?? null,
          updatedAt: new Date(),
        })
        .where(eq(courseReviews.id, existing.id))
        .returning();
    } else {
      [review] = await db
        .insert(courseReviews)
        .values({
          userId: current.userId,
          courseId: course.id,
          rating: parsed.data.rating,
          comment: parsed.data.comment ?? null,
        })
        .returning();
      created = true;
    }

    // Recalcule la note dénormalisée du cours
    const stats = await refreshCourseRating(course.id);

    return NextResponse.json(
      { ok: true, review, created, stats },
      { status: created ? 201 : 200 }
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: error.status }
      );
    }
    console.error("reviews POST error:", error);
    return NextResponse.json(
      { ok: false, error: "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/courses/[slug]/reviews
 * Supprime mon avis (404 si inexistant) puis recalcule la note.
 */
export async function DELETE(_req: Request, { params }: RouteContext) {
  try {
    const current = await requireUser();
    const { slug } = await params;

    const course = await findCourse(slug);
    if (!course) {
      return NextResponse.json(
        { ok: false, error: "Cours introuvable" },
        { status: 404 }
      );
    }

    const [deleted] = await db
      .delete(courseReviews)
      .where(
        and(
          eq(courseReviews.userId, current.userId),
          eq(courseReviews.courseId, course.id)
        )
      )
      .returning({ id: courseReviews.id });

    if (!deleted) {
      return NextResponse.json(
        { ok: false, error: "Aucun avis à supprimer" },
        { status: 404 }
      );
    }

    const stats = await refreshCourseRating(course.id);

    return NextResponse.json({ ok: true, deleted: true, stats });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: error.status }
      );
    }
    console.error("reviews DELETE error:", error);
    return NextResponse.json(
      { ok: false, error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
