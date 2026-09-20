// ============================================================
// REQUÊTE CATALOGUE — Filtres et tri des cours (partagés)
// Utilisé par la page /courses (SSR) et la route /api/courses
// pour garantir un comportement identique.
// ============================================================

import { courses, domains } from "@/db/schema";
import { asc, desc, eq, gt, ilike, or, type SQL } from "drizzle-orm";

// ------------------------------------------------------------
// Paramètres acceptés + validation (whitelist)
// ------------------------------------------------------------

const LEVELS = ["beginner", "intermediate", "advanced", "expert"] as const;
export type CourseLevel = (typeof LEVELS)[number];

const PRICES = ["free", "paid"] as const;
export type CoursePriceFilter = (typeof PRICES)[number];

export const COURSE_SORTS = [
  "popular",
  "rating",
  "newest",
  "price_asc",
  "price_desc",
] as const;
export type CourseSort = (typeof COURSE_SORTS)[number];

/** Paramètres bruts lus depuis l'URL. */
export interface RawCourseParams {
  domain?: string;
  q?: string;
  level?: string;
  price?: string;
  sort?: string;
}

/** Paramètres validés et prêts pour la requête SQL. */
export interface ParsedCourseParams {
  domain?: string;
  q?: string;
  level?: CourseLevel;
  price?: CoursePriceFilter;
  sort: CourseSort;
}

/**
 * Valide les paramètres d'URL : valeurs inconnues ignorées,
 * tri par défaut "popular" (les plus suivis d'abord).
 */
export function parseCourseParams(raw: RawCourseParams): ParsedCourseParams {
  const q = raw.q?.trim() || undefined;
  const domain = raw.domain?.trim() || undefined;

  const level = (LEVELS as readonly string[]).includes(raw.level ?? "")
    ? (raw.level as CourseLevel)
    : undefined;

  const price = (PRICES as readonly string[]).includes(raw.price ?? "")
    ? (raw.price as CoursePriceFilter)
    : undefined;

  const sort = (COURSE_SORTS as readonly string[]).includes(raw.sort ?? "")
    ? (raw.sort as CourseSort)
    : "popular";

  return { domain, q, level, price, sort };
}

/**
 * Construit les conditions WHERE du catalogue.
 * La recherche porte sur le titre, le sous-titre ET la description.
 */
export function buildCourseConditions(p: ParsedCourseParams): SQL[] {
  const conditions: SQL[] = [eq(courses.status, "published")];

  if (p.q) {
    // Échappe les jokers LIKE (% et _) saisis par l'utilisateur
    const pattern = `%${p.q.replace(/[%_]/g, "\\$&")}%`;
    const search = or(
      ilike(courses.title, pattern),
      ilike(courses.subtitle, pattern),
      ilike(courses.description, pattern)
    );
    if (search) conditions.push(search);
  }

  if (p.domain) {
    conditions.push(eq(domains.slug, p.domain));
  }

  if (p.level) {
    conditions.push(eq(courses.level, p.level));
  }

  if (p.price === "free") {
    conditions.push(eq(courses.priceXof, 0));
  } else if (p.price === "paid") {
    conditions.push(gt(courses.priceXof, 0));
  }

  return conditions;
}

/** Clause ORDER BY correspondant au tri demandé. */
export function courseOrderBy(sort: CourseSort): SQL[] {
  switch (sort) {
    case "rating":
      // Les notes réelles (avis) d'abord, popularité en tie-break
      return [desc(courses.rating), desc(courses.studentsCount)];
    case "newest":
      return [desc(courses.createdAt)];
    case "price_asc":
      return [asc(courses.priceXof), desc(courses.studentsCount)];
    case "price_desc":
      return [desc(courses.priceXof), desc(courses.studentsCount)];
    case "popular":
    default:
      return [desc(courses.studentsCount), desc(courses.rating)];
  }
}

/** Libellé français d'un tri (pour l'UI). */
export function courseSortLabel(sort: CourseSort): string {
  switch (sort) {
    case "popular":
      return "Populaires";
    case "rating":
      return "Mieux notées";
    case "newest":
      return "Récentes";
    case "price_asc":
      return "Prix croissant";
    case "price_desc":
      return "Prix décroissant";
  }
}
