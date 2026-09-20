// ============================================================
// ROUTE API — DÉTAIL D'UN COURS PAR SLUG
// GET /api/courses/[slug]
// ============================================================

import { NextResponse } from "next/server";
import { db } from "@/db";
import { courses, domains, users, lessons } from "@/db/schema";
import { eq, asc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> }
) {
  const { slug } = await ctx.params;

  try {
    const [course] = await db
      .select({
        id: courses.id,
        slug: courses.slug,
        title: courses.title,
        subtitle: courses.subtitle,
        description: courses.description,
        level: courses.level,
        durationHours: courses.durationHours,
        priceXof: courses.priceXof,
        rating: courses.rating,
        studentsCount: courses.studentsCount,
        whatYouLearn: courses.whatYouLearn,
        requirements: courses.requirements,
        domain: {
          slug: domains.slug,
          name: domains.name,
          icon: domains.icon,
          color: domains.color,
        },
        instructorName: users.fullName,
        instructorBio: users.bio,
      })
      .from(courses)
      .leftJoin(domains, eq(courses.domainId, domains.id))
      .leftJoin(users, eq(courses.instructorId, users.id))
      .where(eq(courses.slug, slug))
      .limit(1);

    if (!course) {
      return NextResponse.json(
        { ok: false, error: "Cours introuvable" },
        { status: 404 }
      );
    }

    const courseLessons = await db
      .select()
      .from(lessons)
      .where(eq(lessons.courseId, course.id))
      .orderBy(asc(lessons.order));

    return NextResponse.json({
      ok: true,
      course: { ...course, lessons: courseLessons },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
