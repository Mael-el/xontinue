// ============================================================
// GET /api/v1/dashboard
// Agrégation complète pour le dashboard utilisateur
// (overview, progression, skills, badges, cours, candidatures)
// ============================================================

import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  users,
  enrollments,
  courses,
  domains,
  userBadges,
  badges,
  userSkills,
  userProjects,
  jobApplications,
  jobs,
  companies,
  lessonCompletions,
} from "@/db/schema";
import { eq, desc, sql, and, gte } from "drizzle-orm";
import { requireUser, AuthError } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const current = await requireUser();
    const uid = current.userId;

    // User + stats de base
    const [userRow] = await db
      .select({
        id: users.id,
        fullName: users.fullName,
        role: users.role,
        avatarUrl: users.avatarUrl,
        xp: users.xp,
        streak: users.streak,
        englishLevel: users.englishLevel,
        lastActivityAt: users.lastActivityAt,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, uid))
      .limit(1);

    // Cours en cours
    const currentCourses = await db
      .select({
        id: enrollments.id,
        courseId: enrollments.courseId,
        progress: enrollments.progress,
        enrolledAt: enrollments.enrolledAt,
        title: courses.title,
        slug: courses.slug,
        level: courses.level,
        durationHours: courses.durationHours,
        domain: {
          name: domains.name,
          icon: domains.icon,
          color: domains.color,
        },
      })
      .from(enrollments)
      .innerJoin(courses, eq(enrollments.courseId, courses.id))
      .innerJoin(domains, eq(courses.domainId, domains.id))
      .where(
        and(eq(enrollments.userId, uid), eq(enrollments.status, "active"))
      )
      .orderBy(desc(enrollments.enrolledAt))
      .limit(6);

    // Cours terminés
    const completedCourses = await db
      .select({
        id: enrollments.id,
        completedAt: enrollments.completedAt,
        title: courses.title,
        slug: courses.slug,
        domain: {
          name: domains.name,
          icon: domains.icon,
        },
      })
      .from(enrollments)
      .innerJoin(courses, eq(enrollments.courseId, courses.id))
      .innerJoin(domains, eq(courses.domainId, domains.id))
      .where(
        and(eq(enrollments.userId, uid), eq(enrollments.status, "completed"))
      )
      .orderBy(desc(enrollments.completedAt))
      .limit(6);

    // Badges obtenus
    const earnedBadges = await db
      .select({
        slug: badges.slug,
        name: badges.name,
        icon: badges.icon,
        rarity: badges.rarity,
        awardedAt: userBadges.awardedAt,
      })
      .from(userBadges)
      .innerJoin(badges, eq(userBadges.badgeId, badges.id))
      .where(eq(userBadges.userId, uid))
      .orderBy(desc(userBadges.awardedAt))
      .limit(12);

    // Prochains badges (non obtenus)
    const obtainedIds = earnedBadges.map((b) => b.slug);
    const nextBadges = await db
      .select({
        slug: badges.slug,
        name: badges.name,
        icon: badges.icon,
        rarity: badges.rarity,
        requiredXp: badges.requiredXp,
      })
      .from(badges)
      .where(gte(badges.requiredXp, userRow?.xp ?? 0))
      .orderBy(badges.requiredXp)
      .limit(3);

    // Compétences
    const skills = await db
      .select()
      .from(userSkills)
      .where(eq(userSkills.userId, uid))
      .orderBy(desc(userSkills.endorsedCount))
      .limit(10);

    // Projets du portfolio
    const projects = await db
      .select()
      .from(userProjects)
      .where(eq(userProjects.userId, uid))
      .orderBy(desc(userProjects.isFeatured), desc(userProjects.createdAt))
      .limit(6);

    // Candidatures
    const applications = await db
      .select({
        id: jobApplications.id,
        status: jobApplications.status,
        appliedAt: jobApplications.createdAt,
        jobTitle: jobs.title,
        companyName: companies.name,
        companyLogo: companies.logoUrl,
      })
      .from(jobApplications)
      .innerJoin(jobs, eq(jobApplications.jobId, jobs.id))
      .leftJoin(companies, eq(jobs.companyId, companies.id))
      .where(eq(jobApplications.userId, uid))
      .orderBy(desc(jobApplications.createdAt))
      .limit(5);

    // Statistiques agrégées
    const [enrollStats] = await db
      .select({
        total: sql<number>`count(*)::int`,
        completed: sql<number>`count(*) filter (where ${enrollments.status} = 'completed')::int`,
        inProgress: sql<number>`count(*) filter (where ${enrollments.status} = 'active')::int`,
        totalHours: sql<number>`coalesce(sum(${courses.durationHours}), 0)::int`,
        avgProgress: sql<number>`coalesce(avg(${enrollments.progress}), 0)::int`,
      })
      .from(enrollments)
      .leftJoin(courses, eq(enrollments.courseId, courses.id))
      .where(eq(enrollments.userId, uid));

    // Classement simulé par XP
    const [rankRow] = await db
      .select({
        rank: sql<number>`(select count(*) + 1 from ${users} u2 where u2.xp > ${users.xp} and u2.status = 'active')::int`,
        totalStudents: sql<number>`(select count(*) from ${users} where status = 'active')::int`,
      })
      .from(users)
      .where(eq(users.id, uid))
      .limit(1);

    return NextResponse.json({
      ok: true,
      user: userRow,
      overview: {
        xp: userRow?.xp ?? 0,
        streak: userRow?.streak ?? 0,
        englishLevel: userRow?.englishLevel ?? 0,
        rank: rankRow?.rank ?? 1,
        totalStudents: rankRow?.totalStudents ?? 0,
        coursesTotal: enrollStats?.total ?? 0,
        coursesCompleted: enrollStats?.completed ?? 0,
        coursesInProgress: enrollStats?.inProgress ?? 0,
        totalLearningHours: enrollStats?.totalHours ?? 0,
        avgProgress: enrollStats?.avgProgress ?? 0,
        badgesCount: earnedBadges.length,
        projectsCount: projects.length,
        skillsCount: skills.length,
        applicationsCount: applications.length,
      },
      currentCourses,
      completedCourses,
      earnedBadges,
      nextBadges: nextBadges.filter((b) => !obtainedIds.includes(b.slug)),
      skills,
      projects,
      applications,
      // Progression réelle sur 30 jours (lesson_completions)
      progressChart: await getProgressChart(uid),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: error.status }
      );
    }
    console.error("dashboard error:", error);
    return NextResponse.json({ ok: false, error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * Progression réelle sur les 30 derniers jours : XP de leçons validées
 * par jour, agrégés depuis `lesson_completions` (fuseau UTC).
 * Les jours sans activité valent 0 pour que le graphe soit continu.
 */
async function getProgressChart(userId: string) {
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  since.setUTCDate(since.getUTCDate() - 29);

  const rows = await db
    .select({
      day: sql<string>`to_char(${lessonCompletions.completedAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`,
      xp: sql<number>`coalesce(sum(${lessonCompletions.xpAwarded}), 0)::int`,
    })
    .from(lessonCompletions)
    .where(
      and(
        eq(lessonCompletions.userId, userId),
        gte(lessonCompletions.completedAt, since)
      )
    )
    .groupBy(sql`1`);

  const byDay = new Map(rows.map((r) => [r.day, r.xp]));

  const days: { date: string; xp: number }[] = [];
  const cursor = new Date(since);
  for (let i = 0; i < 30; i++) {
    const key = cursor.toISOString().slice(0, 10);
    days.push({ date: key, xp: byDay.get(key) ?? 0 });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}
