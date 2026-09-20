// ============================================================
// GET /api/v1/admin/overview
// Vue d'ensemble de la plateforme — **réservée aux admins**.
// Stats temps réel : utilisateurs, formations, inscriptions,
// revenus, avis, leçons, candidatures + inscriptions 14j.
// ============================================================

import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  users,
  courses,
  enrollments,
  payments,
  jobApplications,
  courseReviews,
  lessonCompletions,
} from "@/db/schema";
import { sql, and, gte } from "drizzle-orm";
import { requireRole, AuthError } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireRole("admin");

    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    since.setUTCDate(since.getUTCDate() - 13);

    const [
      [usersStats],
      [coursesStats],
      [enrollStats],
      [paymentStats],
      [applicationStats],
      [reviewStats],
      [lessonStats],
      signupRows,
    ] = await Promise.all([
      db
        .select({
          total: sql<number>`count(*)::int`,
          active: sql<number>`count(*) filter (where ${users.status} = 'active')::int`,
          pending: sql<number>`count(*) filter (where ${users.status} = 'pending')::int`,
          suspended: sql<number>`count(*) filter (where ${users.status} in ('suspended', 'banned'))::int`,
          students: sql<number>`count(*) filter (where ${users.role} = 'student')::int`,
          instructors: sql<number>`count(*) filter (where ${users.role} = 'instructor')::int`,
          companies: sql<number>`count(*) filter (where ${users.role} = 'company')::int`,
        })
        .from(users),
      db
        .select({
          published: sql<number>`count(*) filter (where ${courses.status} = 'published')::int`,
          draft: sql<number>`count(*) filter (where ${courses.status} = 'draft')::int`,
        })
        .from(courses),
      db
        .select({
          total: sql<number>`count(*)::int`,
          active: sql<number>`count(*) filter (where ${enrollments.status} = 'active')::int`,
          completed: sql<number>`count(*) filter (where ${enrollments.status} = 'completed')::int`,
        })
        .from(enrollments),
      db
        .select({
          revenueXof: sql<number>`coalesce(sum(${payments.amountXof}) filter (where ${payments.status} = 'succeeded'), 0)::int`,
          succeeded: sql<number>`count(*) filter (where ${payments.status} = 'succeeded')::int`,
          pending: sql<number>`count(*) filter (where ${payments.status} = 'pending')::int`,
        })
        .from(payments),
      db
        .select({ total: sql<number>`count(*)::int` })
        .from(jobApplications),
      db
        .select({
          total: sql<number>`count(*)::int`,
          average: sql<number>`coalesce(round(avg(${courseReviews.rating}), 1), 0)::float`,
        })
        .from(courseReviews),
      db
        .select({ total: sql<number>`count(*)::int` })
        .from(lessonCompletions),
      db
        .select({
          day: sql<string>`to_char(${users.createdAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`,
          count: sql<number>`count(*)::int`,
        })
        .from(users)
        .where(and(gte(users.createdAt, since)))
        .groupBy(sql`1`),
    ]);

    // Inscriptions par jour, 14 derniers jours (jours sans inscription = 0)
    const byDay = new Map(signupRows.map((r) => [r.day, r.count]));
    const signups14d: { date: string; count: number }[] = [];
    const cursor = new Date(since);
    for (let i = 0; i < 14; i++) {
      const key = cursor.toISOString().slice(0, 10);
      signups14d.push({ date: key, count: byDay.get(key) ?? 0 });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    return NextResponse.json({
      ok: true,
      users: usersStats,
      courses: coursesStats,
      enrollments: enrollStats,
      payments: paymentStats,
      revenueXof: paymentStats.revenueXof,
      applications: applicationStats.total,
      reviews: reviewStats,
      lessonsCompleted: lessonStats.total,
      signups14d,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: error.status }
      );
    }
    console.error("admin overview error:", error);
    return NextResponse.json(
      { ok: false, error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
