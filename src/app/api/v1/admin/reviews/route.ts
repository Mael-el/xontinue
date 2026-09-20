// ============================================================
// GET /api/v1/admin/reviews
// Derniers avis publiés (toutes formations) — **admin uniquement**.
// ============================================================

import { NextResponse } from "next/server";
import { db } from "@/db";
import { courseReviews, courses, users } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { requireRole, AuthError } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireRole("admin");

    const rows = await db
      .select({
        id: courseReviews.id,
        rating: courseReviews.rating,
        comment: courseReviews.comment,
        createdAt: courseReviews.createdAt,
        userFullName: users.fullName,
        courseSlug: courses.slug,
        courseTitle: courses.title,
      })
      .from(courseReviews)
      .innerJoin(users, eq(courseReviews.userId, users.id))
      .innerJoin(courses, eq(courseReviews.courseId, courses.id))
      .orderBy(desc(courseReviews.createdAt))
      .limit(30);

    return NextResponse.json({
      ok: true,
      reviews: rows.map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        createdAt: r.createdAt,
        user: { fullName: r.userFullName },
        course: { slug: r.courseSlug, title: r.courseTitle },
      })),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: error.status }
      );
    }
    console.error("admin reviews GET error:", error);
    return NextResponse.json(
      { ok: false, error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
