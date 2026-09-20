// ============================================================
// ROUTE API — CATALOGUE DES COURS
// GET /api/courses?domain=&q=&level=&price=&sort=&limit=
//
// Filtres :
//   domain=<slug>                                    → domaine
//   q=<texte>    (titre + sous-titre + description)  → recherche
//   level=beginner|intermediate|advanced|expert      → niveau
//   price=free|paid                                  → prix
//   sort=popular|rating|newest|price_asc|price_desc  → tri
//   limit=<n> (défaut 50, max 100)                   → pagination
// ============================================================

import { NextResponse } from "next/server";
import { db } from "@/db";
import { courses, domains, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import {
  buildCourseConditions,
  courseOrderBy,
  parseCourseParams,
} from "@/lib/courses-query";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 100);

  const filters = parseCourseParams({
    domain: url.searchParams.get("domain") ?? undefined,
    q: url.searchParams.get("q") ?? undefined,
    level: url.searchParams.get("level") ?? undefined,
    price: url.searchParams.get("price") ?? undefined,
    sort: url.searchParams.get("sort") ?? undefined,
  });

  try {
    const rows = await db
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
      })
      .from(courses)
      .leftJoin(domains, eq(courses.domainId, domains.id))
      .leftJoin(users, eq(courses.instructorId, users.id))
      .where(and(...buildCourseConditions(filters)))
      .orderBy(...courseOrderBy(filters.sort))
      .limit(limit);

    return NextResponse.json({
      ok: true,
      courses: rows,
      filters: {
        domain: filters.domain ?? null,
        q: filters.q ?? null,
        level: filters.level ?? null,
        price: filters.price ?? null,
        sort: filters.sort,
      },
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
