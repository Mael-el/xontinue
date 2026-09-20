// ============================================================
// AVIS — Agrégation des notes de cours
// La note dénormalisée `courses.rating` est sur 50 (affichée /10).
// Elle est recalculée à chaque dépôt / modification / suppression
// d'avis réel : les avis réels priment sur les valeurs de seed.
// ============================================================

import { db } from "@/db";
import { courseReviews, courses } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

export interface CourseRatingAgg {
  /** Note sur 50 (ex : 42 = 4.2/5) pour `courses.rating` */
  rating50: number;
  /** Nombre total d'avis */
  count: number;
}

/**
 * Recalcule la note moyenne d'un cours depuis ses avis réels et
 * met à jour la colonne dénormalisée `courses.rating`.
 * Sans avis → note remise à 0 (la valeur de seed n'est préservée
 * que si le cours n'a jamais reçu d'avis réel).
 */
export async function refreshCourseRating(
  courseId: string
): Promise<CourseRatingAgg> {
  const [agg] = await db
    .select({
      rating50: sql<number>`coalesce(round(avg(${courseReviews.rating}) * 10), 0)::int`,
      count: sql<number>`count(*)::int`,
    })
    .from(courseReviews)
    .where(eq(courseReviews.courseId, courseId));

  const result: CourseRatingAgg = {
    rating50: agg?.rating50 ?? 0,
    count: agg?.count ?? 0,
  };

  await db
    .update(courses)
    .set({ rating: result.rating50, updatedAt: new Date() })
    .where(eq(courses.id, courseId));

  return result;
}
