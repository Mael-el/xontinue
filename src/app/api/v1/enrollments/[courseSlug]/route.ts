// ============================================================
// /api/v1/enrollments/[courseSlug]
// GET    — Détail de l'inscription + leçons avec progression
// DELETE — Annule l'inscription (soft delete, progression gardée)
// ============================================================

import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  courses,
  domains,
  enrollments,
  lessonCompletions,
  lessons,
  users,
} from "@/db/schema";
import { and, asc, eq } from "drizzle-orm";
import { requireUser, AuthError } from "@/lib/auth";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ courseSlug: string }> };

/**
 * GET /api/v1/enrollments/[courseSlug]
 *
 * Deux réponses possibles (toujours 200 sauf cours inexistant) :
 * - `enrolled: false` → infos minimales du cours + requiresPayment,
 *   pour afficher un paywall ou un bouton d'inscription.
 * - `enrolled: true` → inscription, leçons ordonnées avec leur
 *   état de complétion et statistiques de progression.
 */
export async function GET(_req: Request, { params }: RouteContext) {
  try {
    const current = await requireUser();
    const { courseSlug } = await params;

    const [course] = await db
      .select({
        id: courses.id,
        slug: courses.slug,
        title: courses.title,
        subtitle: courses.subtitle,
        level: courses.level,
        durationHours: courses.durationHours,
        priceXof: courses.priceXof,
        status: courses.status,
        domain: {
          name: domains.name,
          icon: domains.icon,
          color: domains.color,
        },
      })
      .from(courses)
      .innerJoin(domains, eq(courses.domainId, domains.id))
      .where(eq(courses.slug, courseSlug))
      .limit(1);

    if (!course) {
      return NextResponse.json(
        { ok: false, error: "Cours introuvable" },
        { status: 404 }
      );
    }

    const [enrollment] = await db
      .select()
      .from(enrollments)
      .where(
        and(
          eq(enrollments.userId, current.userId),
          eq(enrollments.courseId, course.id)
        )
      )
      .limit(1);

    // Non inscrit (ou inscription annulée) → paywall / CTA d'inscription
    if (!enrollment || enrollment.status === "cancelled") {
      return NextResponse.json({
        ok: true,
        enrolled: false,
        requiresPayment: (course.priceXof ?? 0) > 0,
        course,
      });
    }

    // Leçons du cours, ordonnées
    const courseLessons = await db
      .select()
      .from(lessons)
      .where(eq(lessons.courseId, course.id))
      .orderBy(asc(lessons.order));

    // Complétions de CET utilisateur pour CETTE inscription
    const completions = await db
      .select({
        lessonId: lessonCompletions.lessonId,
        completedAt: lessonCompletions.completedAt,
      })
      .from(lessonCompletions)
      .where(eq(lessonCompletions.enrollmentId, enrollment.id));

    const doneMap = new Map(
      completions.map((c) => [c.lessonId, c.completedAt])
    );

    const lessonsWithState = courseLessons.map((l) => ({
      id: l.id,
      title: l.title,
      order: l.order,
      durationMinutes: l.durationMinutes,
      xpReward: l.xpReward,
      hasVideo: Boolean(l.videoUrl),
      completed: doneMap.has(l.id),
      completedAt: doneMap.get(l.id) ?? null,
    }));

    // XP + série de l'étudiant (pour l'en-tête de la page d'apprentissage)
    const [userStats] = await db
      .select({ xp: users.xp, streak: users.streak })
      .from(users)
      .where(eq(users.id, current.userId))
      .limit(1);

    return NextResponse.json({
      ok: true,
      enrolled: true,
      course,
      enrollment: {
        id: enrollment.id,
        status: enrollment.status,
        progress: enrollment.progress,
        enrolledAt: enrollment.enrolledAt,
        completedAt: enrollment.completedAt,
      },
      lessons: lessonsWithState,
      stats: {
        totalLessons: lessonsWithState.length,
        completedLessons: lessonsWithState.filter((l) => l.completed).length,
        xp: userStats?.xp ?? 0,
        streak: userStats?.streak ?? 0,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: error.status }
      );
    }
    console.error("enrollment detail GET error:", error);
    return NextResponse.json(
      { ok: false, error: "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/enrollments/[courseSlug]
 * Annule l'inscription (statut → cancelled). La progression et
 * les complétions sont conservées pour une éventuelle réactivation.
 */
export async function DELETE(_req: Request, { params }: RouteContext) {
  try {
    const current = await requireUser();
    const { courseSlug } = await params;

    const [course] = await db
      .select({ id: courses.id })
      .from(courses)
      .where(eq(courses.slug, courseSlug))
      .limit(1);

    if (!course) {
      return NextResponse.json(
        { ok: false, error: "Cours introuvable" },
        { status: 404 }
      );
    }

    const [updated] = await db
      .update(enrollments)
      .set({ status: "cancelled" })
      .where(
        and(
          eq(enrollments.userId, current.userId),
          eq(enrollments.courseId, course.id),
          eq(enrollments.status, "active")
        )
      )
      .returning();

    if (!updated) {
      return NextResponse.json(
        { ok: false, error: "Aucune inscription active pour ce cours" },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, enrollment: updated });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: error.status }
      );
    }
    console.error("enrollment DELETE error:", error);
    return NextResponse.json(
      { ok: false, error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
