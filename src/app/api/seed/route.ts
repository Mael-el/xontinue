// ============================================================
// ROUTE API — SEED DE LA BASE DE DONNÉES
// Appelée en POST pour initialiser les données d'AfricaSkills.
// En production, à remplacer par un script CLI.
//
// Idempotent :
// - Le socle (domaines, cours, badges, entreprises, jobs) n'est
//   inséré que si la table des domaines est vide.
// - L'extension de catalogue insère les cours du seed dont le slug
//   est encore absent (catalogue évolutif sur base déjà initialisée).
// - Les leçons sont insérées par cours qui n'en a pas encore, ce qui
//   permet de déployer de nouveaux cours sans vider la base.
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
  posts,
  postLikes,
  postComments,
  follows,
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
  SEED_POSTS,
  SEED_POST_COMMENTS,
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
 * Insère les leçons de démonstration pour les cours qui n'en ont pas.
 * Idempotent PAR COURS : un cours déjà pourvu n'est pas réinséré
 * (extension du catalogue sur une base en production).
 * Retourne le nombre de leçons insérées (0 si déjà peuplée).
 */
async function seedLessons(): Promise<number> {
  const allCourses = await db
    .select({ id: courses.id, slug: courses.slug })
    .from(courses);

  const courseIdBySlug = new Map(allCourses.map((c) => [c.slug, c.id]));

  // Cours ayant DÉJÀ des leçons → on ne réinsère rien pour eux
  const done = await db
    .select({ courseId: lessons.courseId })
    .from(lessons)
    .groupBy(lessons.courseId);
  const doneIds = new Set(done.map((d) => d.courseId));

  const values = Object.entries(SEED_LESSONS).flatMap(([slug, titles]) => {
    const courseId = courseIdBySlug.get(slug);
    if (!courseId || doneIds.has(courseId)) return [];
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
 * Extension du catalogue : insère les cours de SEED_COURSES dont le
 * slug n'existe pas encore en base (laisser les existants intacts).
 * Crée les instructeurs manquants par nom (email instructor-* unique).
 * Retourne le nombre de cours ajoutés.
 */
async function extendCatalog(): Promise<number> {
  const existing = await db
    .select({ slug: courses.slug })
    .from(courses);
  const existingSlugs = new Set(existing.map((c) => c.slug));

  const domainRows = await db
    .select({ id: domains.id, slug: domains.slug })
    .from(domains);
  const domainMap = new Map(domainRows.map((d) => [d.slug, d.id]));

  const missing = SEED_COURSES.filter((c) => !existingSlugs.has(c.slug));
  if (missing.length === 0) return 0;

  // Instructeurs : carte nom → id, créés à la demande
  const userRows = await db
    .select({ id: users.id, fullName: users.fullName })
    .from(users);
  const instructorMap = new Map(
    userRows.map((u) => [u.fullName, u.id] as const)
  );
  const usedEmails = new Set(
    (await db.select({ email: users.email }).from(users)).map((u) => u.email)
  );

  const instructorNames = Array.from(new Set(missing.map((c) => c.instructorName)));
  let seq = usedEmails.size + 1;
  for (const name of instructorNames) {
    if (instructorMap.has(name)) continue;
    let email = `instructor-${seq}@africaskills.africa`;
    seq++;
    while (usedEmails.has(email)) {
      email = `instructor-${seq}@africaskills.africa`;
      seq++;
    }
    usedEmails.add(email);
    const [created] = await db
      .insert(users)
      .values({
        email,
        fullName: name,
        role: "instructor" as const,
        country: "Bénin",
        bio: `Instructeur certifié AfricaSkills — ${name}`,
      })
      .returning();
    instructorMap.set(created.fullName, created.id);
  }

  await db.insert(courses).values(
    missing.map((c) => ({
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
  return missing.length;
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

/**
 * Publications de démo du fil social — insérées UNIQUEMENT si la
 * table posts est vide (jamais d'écrasement des contenus réels).
 * Les instructeurs du seed y tiennent des propos typiques,
 * avec likes, commentaires et follows croisés entre eux.
 */
async function seedSocialFeed(): Promise<number> {
  const existing = await countRows(posts);
  if (existing > 0) return 0;

  const instructors = await db
    .select({ id: users.id, fullName: users.fullName })
    .from(users);
  const byName = new Map(instructors.map((u) => [u.fullName, u.id]));
  const ids = instructors.map((u) => u.id);
  if (ids.length < 2) return 0;

  const HOUR = 3_600_000;
  const now = Date.now();

  // 1) Publications décalées dans le temps (fil naturel)
  const createdIds: string[] = [];
  for (let i = 0; i < SEED_POSTS.length; i++) {
    const entry = SEED_POSTS[i];
    const authorId = byName.get(entry.authorName);
    if (!authorId) continue;
    const createdAt = new Date(now - (i * 4 + 1.5) * HOUR);
    const [row] = await db
      .insert(posts)
      .values({
        authorId,
        content: entry.content,
        imageUrl: entry.imageUrl ?? null,
        createdAt,
        updatedAt: createdAt,
      })
      .returning({ id: posts.id });
    createdIds.push(row.id);

    // 2) Likes tournants entre utilisateurs (compteur matérialisé)
    const likeCount = 2 + ((i * 5) % 6);
    const likers = ids.filter((id) => id !== authorId).slice(0, likeCount);
    for (const likerId of likers) {
      await db.insert(postLikes).values({ postId: row.id, userId: likerId });
    }
    // 3) 1 commentaire tournant pour les posts pairs
    let commentsCount = 0;
    if (i % 2 === 0) {
      const commentAuthor = ids[(i + 1) % ids.length];
      if (commentAuthor !== authorId) {
        await db.insert(postComments).values({
          postId: row.id,
          authorId: commentAuthor,
          content: SEED_POST_COMMENTS[i % SEED_POST_COMMENTS.length],
        });
        commentsCount = 1;
      }
    }
    await db
      .update(posts)
      .set({ likesCount: likers.length, commentsCount })
      .where(sql`${posts.id} = ${row.id}`);
  }

  // 4) Follows croisés : i suit (i+1) et (i+7) — suggère « Personnes à suivre »
  for (let i = 0; i < ids.length; i++) {
    for (const shift of [1, 7]) {
      const followeeId = ids[(i + shift) % ids.length];
      if (followeeId !== ids[i]) {
        await db
          .insert(follows)
          .values({ followerId: ids[i], followeeId })
          .onConflictDoNothing();
      }
    }
  }

  return createdIds.length;
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
    // 2) Extension du catalogue (ajoute QUE les slugs manquants)
    // --------------------------------------------------------
    summary.coursesAdded = await extendCatalog();

    // --------------------------------------------------------
    // 3) Leçons — idempotent PAR COURS, indépendant du socle
    // --------------------------------------------------------
    summary.lessons = await seedLessons();

    // --------------------------------------------------------
    // 4) Fil social de démo — seulement si aucun post n'existe
    // --------------------------------------------------------
    summary.socialPosts = await seedSocialFeed();

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
    posts: await countRows(posts),
  };
  return NextResponse.json({ ok: true, counts });
}
