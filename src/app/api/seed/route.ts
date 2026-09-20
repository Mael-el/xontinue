// ============================================================
// ROUTE API — SEED DE LA BASE DE DONNÉES
// Appelée en POST pour initialiser les données d'AfricaSkills.
// En production, à remplacer par un script CLI.
//
// Idempotent :
// - Le socle (domaines, cours, badges, entreprises, jobs) n'est
//   inséré que si la table des domaines est vide.
// - Les leçons sont insérées indépendamment, si aucune n'existe,
//   ce qui permet de « réparer » une base déjà initialisée.
// ============================================================

import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  domains,
  courses,
  lessons,
  badges,
  companies,
  jobs,
  users,
} from "@/db/schema";
import { sql } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import {
  SEED_DOMAINS,
  SEED_COURSES,
  SEED_LESSONS,
  SEED_BADGES,
  SEED_COMPANIES,
  SEED_JOBS,
} from "@/lib/seed-data";

export const dynamic = "force-dynamic";

/** Compte les lignes d'une table. */
async function countRows(table: PgTable): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(table);
  return rows[0]?.count ?? 0;
}

/**
 * Insère les leçons de démonstration si la table est vide.
 * Retourne le nombre de leçons insérées (0 si déjà peuplée).
 */
async function seedLessons(): Promise<number> {
  const existing = await countRows(lessons);
  if (existing > 0) return 0;

  const allCourses = await db
    .select({ id: courses.id, slug: courses.slug })
    .from(courses);

  const courseIdBySlug = new Map(allCourses.map((c) => [c.slug, c.id]));

  const values = Object.entries(SEED_LESSONS).flatMap(([slug, titles]) => {
    const courseId = courseIdBySlug.get(slug);
    if (!courseId) return [];
    return titles.map((title, i) => ({
      courseId,
      title,
      content: `Contenu de la leçon « ${title} » — replacé par la vidéo et le support en production.`,
      order: i + 1,
      durationMinutes: 15 + ((i * 7) % 30),
      xpReward: 10,
    }));
  });

  if (values.length === 0) return 0;
  await db.insert(lessons).values(values);
  return values.length;
}

/**
 * Garde-fou production : le seed devient une opération d'administration
 * explicite. En production, exiger l'en-tête `x-seed-secret` correspondant
 * à SEED_SECRET (.env) ; sans SEED_SECRET configuré, la route est fermée.
 */
function assertSeedAllowed(req: Request): NextResponse | null {
  if (process.env.NODE_ENV !== "production") return null;

  const expected = process.env.SEED_SECRET;
  if (!expected) {
    return NextResponse.json(
      { ok: false, error: "Seed désactivé (SEED_SECRET non configuré)" },
      { status: 403 }
    );
  }
  if (req.headers.get("x-seed-secret") !== expected) {
    return NextResponse.json(
      { ok: false, error: "Non autorisé" },
      { status: 401 }
    );
  }
  return null;
}

export async function POST(req: Request) {
  const denied = assertSeedAllowed(req);
  if (denied) return denied;

  try {
    const summary: Record<string, number | string> = {};

    // --------------------------------------------------------
    // 1) Socle principal — seulement si la base est vide
    // --------------------------------------------------------
    const existingDomains = await countRows(domains);

    if (existingDomains > 0) {
      summary.base = "déjà initialisée";
    } else {
      // 1a) Insérer les domaines
      const insertedDomains = await db
        .insert(domains)
        .values(SEED_DOMAINS as any)
        .returning();

      const domainMap = new Map(insertedDomains.map((d) => [d.slug, d.id]));

      // 1b) Créer des instructeurs fictifs uniques
      const instructorNames = Array.from(
        new Set(SEED_COURSES.map((c) => c.instructorName))
      );
      const insertedInstructors = await db
        .insert(users)
        .values(
          instructorNames.map((name, i) => ({
            email: `instructor-${i + 1}@africaskills.africa`,
            fullName: name,
            role: "instructor" as const,
            country: "Bénin",
            bio: `Instructeur certifié AfricaSkills — ${name}`,
          }))
        )
        .returning();

      const instructorMap = new Map(
        insertedInstructors.map((u) => [u.fullName, u.id])
      );

      // 1c) Insérer les cours
      await db.insert(courses).values(
        SEED_COURSES.map((c) => ({
          slug: c.slug,
          title: c.title,
          subtitle: c.subtitle,
          description: c.description,
          domainId: domainMap.get(c.domainSlug)!,
          instructorId: instructorMap.get(c.instructorName) ?? null,
          level: c.level,
          durationHours: c.durationHours,
          priceXof: c.priceXof,
          rating: c.rating,
          studentsCount: c.studentsCount,
          whatYouLearn: c.whatYouLearn,
          requirements: c.requirements,
          status: "published" as const,
        }))
      );

      // 1d) Insérer les badges
      await db.insert(badges).values(
        SEED_BADGES.map((b) => ({
          slug: b.slug,
          name: b.name,
          description: b.description,
          icon: b.icon,
          rarity: b.rarity,
          domainId: b.domainSlug ? (domainMap.get(b.domainSlug) ?? null) : null,
          requiredXp: b.requiredXp,
        }))
      );

      // 1e) Insérer les entreprises
      const insertedCompanies = await db
        .insert(companies)
        .values(
          SEED_COMPANIES.map((c) => ({
            slug: c.slug,
            name: c.name,
            country: c.country,
            city: c.city,
            industry: c.industry,
            logoUrl: c.logoEmoji, // on stocke l'emoji dans le champ URL pour la démo
            description: c.description,
            isVerified: true,
          }))
        )
        .returning();

      const companyMap = new Map(insertedCompanies.map((c) => [c.slug, c.id]));

      // 1f) Insérer les offres d'emploi
      await db.insert(jobs).values(
        SEED_JOBS.map((j, i) => ({
          title: j.title,
          slug: `job-${i + 1}-${Date.now()}`,
          companyId: companyMap.get(j.companySlug)!,
          type: j.type,
          location: j.location,
          isRemote: j.isRemote,
          salaryMinXof: j.salaryMinXof,
          salaryMaxXof: j.salaryMaxXof,
          description: j.description,
          requiredBadges: j.requiredBadges,
          expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        }))
      );

      summary.base = "initialisée";
      summary.domains = insertedDomains.length;
      summary.instructors = insertedInstructors.length;
      summary.courses = SEED_COURSES.length;
      summary.badges = SEED_BADGES.length;
      summary.companies = insertedCompanies.length;
      summary.jobs = SEED_JOBS.length;
    }

    // --------------------------------------------------------
    // 2) Leçons — idempotent, indépendant du socle
    // --------------------------------------------------------
    summary.lessons = await seedLessons();

    return NextResponse.json({ ok: true, summary });
  } catch (error) {
    console.error("Seed error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  const counts = {
    domains: await countRows(domains),
    courses: await countRows(courses),
    lessons: await countRows(lessons),
    badges: await countRows(badges),
    companies: await countRows(companies),
    jobs: await countRows(jobs),
  };
  return NextResponse.json({ ok: true, counts });
}
