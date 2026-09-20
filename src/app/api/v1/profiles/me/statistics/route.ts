// ============================================================
// GET /api/v1/profiles/me/statistics
// Statistiques agrégées pour le profil courant
// ============================================================

import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  users,
  enrollments,
  userBadges,
  userProjects,
  userSkills,
  jobApplications,
  courses,
} from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { requireUser, AuthError } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const current = await requireUser();
    const uid = current.userId;

    const [userRow] = await db
      .select({
        xp: users.xp,
        streak: users.streak,
        englishLevel: users.englishLevel,
        lastActivityAt: users.lastActivityAt,
      })
      .from(users)
      .where(eq(users.id, uid))
      .limit(1);

    const [enrollStats] = await db
      .select({
        total: sql<number>`count(*)::int`,
        completed: sql<number>`count(*) filter (where ${enrollments.status} = 'completed')::int`,
        inProgress: sql<number>`count(*) filter (where ${enrollments.status} = 'active' and ${enrollments.progress} > 0)::int`,
        totalHours: sql<number>`coalesce(sum(${courses.durationHours}), 0)::int`,
      })
      .from(enrollments)
      .leftJoin(courses, eq(enrollments.courseId, courses.id))
      .where(eq(enrollments.userId, uid));

    const [badgeCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(userBadges)
      .where(eq(userBadges.userId, uid));

    const [projectCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(userProjects)
      .where(eq(userProjects.userId, uid));

    const [skillCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(userSkills)
      .where(eq(userSkills.userId, uid));

    const [applicationCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(jobApplications)
      .where(eq(jobApplications.userId, uid));

    // Progression sur 7 jours (dernières activités)
    const recentEnrollments = await db
      .select({
        date: sql<string>`date_trunc('day', ${enrollments.enrolledAt})::date::text`,
        count: sql<number>`count(*)::int`,
      })
      .from(enrollments)
      .where(eq(enrollments.userId, uid))
      .groupBy(sql`date_trunc('day', ${enrollments.enrolledAt})`)
      .orderBy(desc(sql`date_trunc('day', ${enrollments.enrolledAt})`))
      .limit(7);

    return NextResponse.json({
      ok: true,
      statistics: {
        xp: userRow?.xp ?? 0,
        streak: userRow?.streak ?? 0,
        englishLevel: userRow?.englishLevel ?? 0,
        lastActivityAt: userRow?.lastActivityAt,
        coursesTotal: enrollStats?.total ?? 0,
        coursesCompleted: enrollStats?.completed ?? 0,
        coursesInProgress: enrollStats?.inProgress ?? 0,
        totalLearningHours: enrollStats?.totalHours ?? 0,
        badgesCount: badgeCount?.count ?? 0,
        projectsCount: projectCount?.count ?? 0,
        skillsCount: skillCount?.count ?? 0,
        applicationsCount: applicationCount?.count ?? 0,
        recentActivity: recentEnrollments,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    return NextResponse.json({ ok: false, error: "Erreur serveur" }, { status: 500 });
  }
}
