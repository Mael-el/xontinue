// ============================================================
// POST /api/v1/enrollments/[courseSlug]/lessons/[lessonId]/complete
// Marque une leçon comme terminée :
// 1. Enregistre la complétion (idempotent, unique user+lesson)
// 2. Recalcule la progression de l'inscription (en %)
// 3. Termine le cours à 100 % (bonus d'XP)
// 4. Attribue l'XP + met à jour la série + débloque les badges
// ============================================================

import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  courses,
  enrollments,
  lessonCompletions,
  lessons,
} from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { requireUser, AuthError } from "@/lib/auth";
import { awardXp, COURSE_COMPLETION_BONUS_XP } from "@/lib/gamification";
import { notifyUser } from "@/lib/notifications";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ courseSlug: string; lessonId: string }>;
};

export async function POST(_req: Request, { params }: RouteContext) {
  try {
    const current = await requireUser();
    const { courseSlug, lessonId } = await params;

    // 1) Inscription active de l'utilisateur pour ce cours
    const [row] = await db
      .select({ enrollment: enrollments, course: courses })
      .from(enrollments)
      .innerJoin(courses, eq(enrollments.courseId, courses.id))
      .where(
        and(
          eq(enrollments.userId, current.userId),
          eq(courses.slug, courseSlug)
        )
      )
      .limit(1);

    if (!row || row.enrollment.status === "cancelled") {
      return NextResponse.json(
        { ok: false, error: "Tu n'es pas inscrit à ce cours" },
        { status: 404 }
      );
    }

    // 2) La leçon doit appartenir au cours
    const [lesson] = await db
      .select()
      .from(lessons)
      .where(and(eq(lessons.id, lessonId), eq(lessons.courseId, row.course.id)))
      .limit(1);

    if (!lesson) {
      return NextResponse.json(
        { ok: false, error: "Leçon introuvable" },
        { status: 404 }
      );
    }

    // 3) Idempotence : déjà complétée → état courant sans nouveau gain
    const [existing] = await db
      .select({ id: lessonCompletions.id })
      .from(lessonCompletions)
      .where(
        and(
          eq(lessonCompletions.userId, current.userId),
          eq(lessonCompletions.lessonId, lesson.id)
        )
      )
      .limit(1);

    if (existing) {
      return NextResponse.json({
        ok: true,
        alreadyCompleted: true,
        xpGained: 0,
        bonusXp: 0,
        progress: row.enrollment.progress,
        courseCompleted: row.enrollment.status === "completed",
        newBadges: [],
      });
    }

    // 4) Enregistrer la complétion
    const lessonXp = lesson.xpReward ?? 10;
    await db.insert(lessonCompletions).values({
      userId: current.userId,
      lessonId: lesson.id,
      enrollmentId: row.enrollment.id,
      xpAwarded: lessonXp,
    });

    // 5) Recalculer la progression : complétées / total du cours
    const [totals] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(lessons)
      .where(eq(lessons.courseId, row.course.id));

    const [done] = await db
      .select({ completed: sql<number>`count(*)::int` })
      .from(lessonCompletions)
      .where(eq(lessonCompletions.enrollmentId, row.enrollment.id));

    const total = Math.max(1, totals?.total ?? 1);
    const completedCount = done?.completed ?? 0;
    const progress = Math.min(100, Math.round((completedCount / total) * 100));

    // 6) À 100 % → cours terminé + bonus d'XP
    let courseCompleted = false;
    let bonusXp = 0;
    if (progress >= 100 && row.enrollment.status !== "completed") {
      courseCompleted = true;
      bonusXp = COURSE_COMPLETION_BONUS_XP;
      await db
        .update(enrollments)
        .set({ progress, status: "completed", completedAt: new Date() })
        .where(eq(enrollments.id, row.enrollment.id));

      // Notification de fin de formation (best-effort)
      void notifyUser(current.userId, {
        type: "course_completed",
        title: `🏆 Formation terminée : ${row.course.title}`,
        body: `Bravo ! Tu as terminé « ${row.course.title} » et gagné +${COURSE_COMPLETION_BONUS_XP} XP de bonus.`,
        href: `/courses/${courseSlug}/learn`,
      });
    } else if (row.enrollment.status !== "completed") {
      await db
        .update(enrollments)
        .set({ progress })
        .where(eq(enrollments.id, row.enrollment.id));
    }

    // 7) XP, série quotidienne et badges
    const gamification = await awardXp(current.userId, lessonXp + bonusXp);

    return NextResponse.json({
      ok: true,
      alreadyCompleted: false,
      xpGained: lessonXp,
      bonusXp,
      progress,
      courseCompleted,
      xp: gamification.xp,
      streak: gamification.streak,
      newBadges: gamification.newBadges,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: error.status }
      );
    }
    console.error("lesson complete POST error:", error);
    return NextResponse.json(
      { ok: false, error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
