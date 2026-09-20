// ============================================================
// PAGE — CATALOGUE DES FORMATIONS
// Recherche plein texte (titre, sous-titre, description),
// filtres domaine / niveau / prix, tri (popularité, note réelle,
// nouveautés, prix). SSR : l'URL porte tout l'état des filtres.
// ============================================================

import Link from "next/link";
import { db } from "@/db";
import { domains, courses, users } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { CourseCard } from "@/components/CourseCard";
import { CourseFiltersBar } from "./CourseFiltersBar";
import {
  buildCourseConditions,
  courseOrderBy,
  courseSortLabel,
  parseCourseParams,
} from "@/lib/courses-query";
import { levelLabel } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function CoursesPage({
  searchParams,
}: {
  searchParams: Promise<{
    domain?: string;
    q?: string;
    level?: string;
    price?: string;
    sort?: string;
  }>;
}) {
  const sp = await searchParams;
  const filters = parseCourseParams(sp);

  // Domaines avec compteur de cours (pour les pilules)
  const allDomains = await db
    .select({
      slug: domains.slug,
      name: domains.name,
      icon: domains.icon,
      coursesCount: sql<number>`count(${courses.id})::int`,
    })
    .from(domains)
    .leftJoin(courses, eq(courses.domainId, domains.id))
    .groupBy(domains.slug, domains.name, domains.icon)
    .orderBy(domains.name);

  // Cours filtrés + triés (logique partagée avec /api/courses)
  const filteredCourses = await db
    .select({
      slug: courses.slug,
      title: courses.title,
      subtitle: courses.subtitle,
      level: courses.level,
      durationHours: courses.durationHours,
      priceXof: courses.priceXof,
      rating: courses.rating,
      studentsCount: courses.studentsCount,
      instructorName: users.fullName,
      domain: {
        slug: domains.slug,
        name: domains.name,
        icon: domains.icon,
        color: domains.color,
      },
    })
    .from(courses)
    .innerJoin(domains, eq(courses.domainId, domains.id))
    .leftJoin(users, eq(courses.instructorId, users.id))
    .where(and(...buildCourseConditions(filters)))
    .orderBy(...courseOrderBy(filters.sort));

  const currentDomain = allDomains.find((d) => d.slug === filters.domain);

  /**
   * Construit un href préservant les filtres courants — utilisé par
   * les pilules de domaine pour ne pas perdre recherche/niveau/prix/tri.
   */
  function hrefFor(overrides: { domain?: string }): string {
    const params = new URLSearchParams();
    const domain = "domain" in overrides ? overrides.domain : filters.domain;
    if (domain) params.set("domain", domain);
    if (filters.q) params.set("q", filters.q);
    if (filters.level) params.set("level", filters.level);
    if (filters.price) params.set("price", filters.price);
    if (filters.sort !== "popular") params.set("sort", filters.sort);
    const qs = params.toString();
    return `/courses${qs ? `?${qs}` : ""}`;
  }

  // Résumé lisible des filtres actifs
  const activeFilters: string[] = [];
  if (filters.q) activeFilters.push(`« ${filters.q} »`);
  if (filters.level) activeFilters.push(levelLabel(filters.level));
  if (filters.price) activeFilters.push(filters.price === "free" ? "Gratuit" : "Payant");
  if (filters.sort !== "popular") activeFilters.push(`tri : ${courseSortLabel(filters.sort)}`);

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      {/* En-tête */}
      <div className="mb-8">
        <div className="text-xs font-bold uppercase tracking-[0.2em] text-orange-500">
          Catalogue
        </div>
        <h1 className="mt-2 text-3xl font-black text-white sm:text-4xl lg:text-5xl">
          {currentDomain
            ? `${currentDomain.icon} Formations ${currentDomain.name}`
            : "Toutes les formations"}
        </h1>
        <p className="mt-3 max-w-2xl text-neutral-400">
          {filteredCourses.length} formation
          {filteredCourses.length > 1 ? "s" : ""}
          {activeFilters.length > 0
            ? ` pour ${activeFilters.join(" · ")}`
            : " disponible" + (filteredCourses.length > 1 ? "s" : "")}
          . Apprends à ton rythme, paie en Mobile Money, décroche ton badge.
        </p>
      </div>

      {/* Pilules de domaine (préservent les autres filtres) */}
      <div className="mb-6 flex flex-wrap gap-2">
        <Link
          href={hrefFor({ domain: undefined })}
          className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
            !filters.domain
              ? "bg-orange-500 text-black"
              : "border border-neutral-800 text-neutral-400 hover:border-orange-500/50 hover:text-white"
          }`}
        >
          Tous
        </Link>
        {allDomains.map((d) => (
          <Link
            key={d.slug}
            href={hrefFor({ domain: d.slug })}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              filters.domain === d.slug
                ? "bg-orange-500 text-black"
                : "border border-neutral-800 text-neutral-400 hover:border-orange-500/50 hover:text-white"
            }`}
          >
            {d.icon} {d.name}
            <span className="ml-1 text-xs opacity-60">({d.coursesCount})</span>
          </Link>
        ))}
      </div>

      {/* Barre de filtres (recherche, niveau, prix, tri) — client */}
      <CourseFiltersBar
        domain={filters.domain}
        q={filters.q}
        level={filters.level}
        price={filters.price}
        sort={filters.sort}
      />

      {/* Grille de résultats */}
      {filteredCourses.length === 0 ? (
        <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-16 text-center">
          <div className="text-5xl">📭</div>
          <h3 className="mt-4 text-xl font-bold text-white">
            Aucune formation trouvée
          </h3>
          <p className="mt-2 text-neutral-400">
            Essaie d’élargir ta recherche ou de changer de filtre.
          </p>
          <Link
            href="/courses"
            className="mt-4 inline-block rounded-xl border border-neutral-700 px-5 py-2.5 text-sm font-semibold text-neutral-200 transition hover:border-orange-500/50 hover:text-orange-300"
          >
            ✕ Réinitialiser tous les filtres
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filteredCourses.map((c) => (
            <CourseCard
              key={c.slug}
              slug={c.slug}
              title={c.title}
              subtitle={c.subtitle}
              level={c.level as "beginner" | "intermediate" | "advanced" | "expert"}
              durationHours={Number(c.durationHours ?? 0)}
              priceXof={Number(c.priceXof ?? 0)}
              rating={Number(c.rating ?? 0)}
              studentsCount={Number(c.studentsCount ?? 0)}
              instructorName={c.instructorName}
              domain={c.domain}
            />
          ))}
        </div>
      )}
    </div>
  );
}
