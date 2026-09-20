// ============================================================
// INSTRUCTOR — Logique formateur partagée
// Mes formations + agrégats (étudiants, leçons, avis), slug
// unique, synchro de la durée, vérification de propriété.
// ============================================================

import { db } from "@/db";
import {
  courses,
  courseReviews,
  domains,
  enrollments,
  lessons,
} from "@/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import { slugify } from "@/lib/format";

export interface InstructorCourse {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  domainId: string;
  domain: { name: string; icon: string | null };
  level: string;
  durationHours: number | null;
  priceXof: number;
  thumbnailUrl: string | null;
  requirements: string[];
  whatYouLearn: string[];
  status: string;
  rating: number | null;
  studentsCount: number;
  lessonsCount: number;
  reviewsCount: number;
  createdAt: Date;
  updatedAt: Date;
}

/** Mes formations (tout statut) avec agrégats temps réel. */
export async function getInstructorCourses(
  instructorId: string
): Promise<InstructorCourse[]> {
  const rows = await db
    .select({
      id: courses.id,
      slug: courses.slug,
      title: courses.title,
      subtitle: courses.subtitle,
      description: courses.description,
      domainId: courses.domainId,
      domainName: domains.name,
      domainIcon: domains.icon,
      level: courses.level,
      durationHours: courses.durationHours,
      priceXof: courses.priceXof,
      thumbnailUrl: courses.thumbnailUrl,
      requirements: courses.requirements,
      whatYouLearn: courses.whatYouLearn,
      status: courses.status,
      rating: courses.rating,
      studentsCount: courses.studentsCount,
      lessonsCount: sql<number>`(select count(*) from ${lessons} l where l.course_id = ${courses.id})::int`,
      reviewsCount: sql<number>`(select count(*) from ${courseReviews} r where r.course_id = ${courses.id})::int`,
      createdAt: courses.createdAt,
      updatedAt: courses.updatedAt,
    })
    .from(courses)
    .innerJoin(domains, eq(courses.domainId, domains.id))
    .where(eq(courses.instructorId, instructorId))
    .orderBy(desc(courses.updatedAt));

  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    subtitle: r.subtitle,
    description: r.description,
    domainId: r.domainId,
    domain: { name: r.domainName, icon: r.domainIcon },
    level: r.level,
    durationHours: r.durationHours,
    priceXof: r.priceXof,
    thumbnailUrl: r.thumbnailUrl,
    requirements: r.requirements ?? [],
    whatYouLearn: r.whatYouLearn ?? [],
    status: r.status,
    rating: r.rating,
    studentsCount: r.studentsCount,
    lessonsCount: r.lessonsCount,
    reviewsCount: r.reviewsCount,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));
}

/** La formation appartient-elle à ce formateur ? */
export async function getOwnedCourse(courseId: string, instructorId: string) {
  const [row] = await db
    .select({
      id: courses.id,
      instructorId: courses.instructorId,
      status: courses.status,
      lessonsCount: sql<number>`(select count(*) from ${lessons} l where l.course_id = ${courses.id})::int`,
      students: sql<number>`(select count(*) from ${enrollments} e where e.course_id = ${courses.id})::int`,
    })
    .from(courses)
    .where(eq(courses.id, courseId))
    .limit(1);

  if (!row || row.instructorId !== instructorId) return null;
  return row;
}

/** Génère un slug unique à partir du titre (…-2, …-3 si pris). */
export async function uniqueCourseSlug(title: string): Promise<string> {
  const base = slugify(title).slice(0, 180) || "formation";
  for (let i = 0; i < 10; i++) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    const [existing] = await db
      .select({ id: courses.id })
      .from(courses)
      .where(eq(courses.slug, candidate))
      .limit(1);
    if (!existing) return candidate;
  }
  // Repli très improbable
  return `${base}-${Date.now().toString(36)}`;
}

/**
 * Recalcule durationHours depuis la somme des durées de leçons
 * (arrondi à l'heure supérieure) + touche updatedAt.
 */
export async function syncCourseDuration(courseId: string): Promise<void> {
  await db.execute(sql`
    update ${courses}
    set
      duration_hours = greatest(
        1,
        round(
          coalesce(
            (select sum(${lessons.durationMinutes}) from ${lessons} l
             where l.course_id = ${courses.id}),
            0
          ) / 60.0
        )::int
      ),
      updated_at = now()
    where ${courses.id} = ${courseId}
  `);
}

/** Stats globales du formateur (bandeau). */
export async function getInstructorStats(instructorId: string) {
  const mine = await getInstructorCourses(instructorId);
  return {
    coursesTotal: mine.length,
    published: mine.filter((c) => c.status === "published").length,
    drafts: mine.filter((c) => c.status === "draft").length,
    totalStudents: mine.reduce((s, c) => s + c.studentsCount, 0),
    totalLessons: mine.reduce((s, c) => s + c.lessonsCount, 0),
    totalReviews: mine.reduce((s, c) => s + c.reviewsCount, 0),
    avgRating50:
      mine.filter((c) => (c.rating ?? 0) > 0).length > 0
        ? Math.round(
            mine
              .filter((c) => (c.rating ?? 0) > 0)
              .reduce((s, c) => s + (c.rating ?? 0), 0) /
              mine.filter((c) => (c.rating ?? 0) > 0).length
          )
        : 0,
  };
}
