// ============================================================
// PAGE — DÉTAIL D'UNE FORMATION
// ============================================================

import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { courses, domains, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { formatXof, formatRating, formatStudents, levelLabel } from "@/lib/format";
import { CourseCheckout } from "./CourseCheckout";
import { CourseReviews } from "./CourseReviews";

export const dynamic = "force-dynamic";

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

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

  if (!course) notFound();

  const whatYouLearn = (course.whatYouLearn ?? []) as string[];
  const requirements = (course.requirements ?? []) as string[];

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Fil d'ariane */}
      <nav className="mb-6 flex items-center gap-2 text-sm text-neutral-500">
        <Link href="/courses" className="hover:text-white">
          Formations
        </Link>
        <span>›</span>
        <Link
          href={`/courses?domain=${course.domain?.slug}`}
          className="hover:text-white"
        >
          {course.domain?.name}
        </Link>
        <span>›</span>
        <span className="truncate text-neutral-300">{course.title}</span>
      </nav>

      <div className="grid gap-10 lg:grid-cols-3">
        {/* Colonne principale */}
        <div className="lg:col-span-2">
          <div
            className={`mb-6 flex h-56 items-center justify-center rounded-2xl ${
              course.domain?.color ?? "bg-orange-500"
            } relative overflow-hidden`}
          >
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.3),transparent_60%)]" />
            <div className="text-9xl drop-shadow-2xl">
              {course.domain?.icon ?? "📚"}
            </div>
          </div>

          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-neutral-900 px-3 py-1 text-xs font-semibold text-neutral-300">
              {course.domain?.icon} {course.domain?.name}
            </span>
            <span className="rounded-full bg-neutral-900 px-3 py-1 text-xs font-semibold text-neutral-300">
              {levelLabel(course.level as "beginner" | "intermediate" | "advanced" | "expert")}
            </span>
            <span className="rounded-full bg-amber-500/20 px-3 py-1 text-xs font-semibold text-amber-400">
              ★ {formatRating(Number(course.rating ?? 0))}
            </span>
          </div>

          <h1 className="text-3xl font-black text-white sm:text-4xl lg:text-5xl">
            {course.title}
          </h1>
          {course.subtitle && (
            <p className="mt-3 text-lg text-neutral-400">{course.subtitle}</p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-neutral-400">
            <span>👨🏾‍🏫 {course.instructorName ?? "Équipe AfricaSkills"}</span>
            <span>·</span>
            <span>🎓 {formatStudents(Number(course.studentsCount ?? 0))} étudiants</span>
            <span>·</span>
            <span>⏱️ {Number(course.durationHours ?? 0)}h de contenu</span>
          </div>

          {/* Ce que tu vas apprendre */}
          <section className="mt-10 rounded-2xl border border-neutral-800 bg-neutral-950 p-6">
            <h2 className="text-xl font-bold text-white">
              🎯 Ce que tu vas apprendre
            </h2>
            <ul className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              {whatYouLearn.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-neutral-300">
                  <span className="mt-0.5 text-emerald-400">✓</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Description */}
          {course.description && (
            <section className="mt-8">
              <h2 className="text-xl font-bold text-white">📖 Description</h2>
              <p className="mt-3 whitespace-pre-wrap leading-relaxed text-neutral-300">
                {course.description}
              </p>
            </section>
          )}

          {/* Prérequis */}
          {requirements.length > 0 && (
            <section className="mt-8">
              <h2 className="text-xl font-bold text-white">📋 Prérequis</h2>
              <ul className="mt-3 space-y-2">
                {requirements.map((r, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-sm text-neutral-400"
                  >
                    <span className="text-orange-500">▸</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Instructeur */}
          <section className="mt-8 rounded-2xl border border-neutral-800 bg-neutral-950 p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-amber-500 text-2xl">
                👨🏾‍🏫
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-neutral-500">
                  Ton instructeur
                </div>
                <div className="text-lg font-bold text-white">
                  {course.instructorName ?? "Équipe AfricaSkills"}
                </div>
                {course.instructorBio && (
                  <div className="text-sm text-neutral-400">
                    {course.instructorBio}
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Avis des étudiants (composant client) */}
          <CourseReviews courseSlug={course.slug} />
        </div>

        {/* Sidebar */}
        <aside className="lg:col-span-1">
          <div className="sticky top-24 space-y-4">
            <CourseCheckout
              priceXof={Number(course.priceXof ?? 0)}
              courseSlug={course.slug}
              courseTitle={course.title}
            />

            <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-5">
              <div className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                Cette formation inclut
              </div>
              <ul className="mt-3 space-y-2 text-sm text-neutral-300">
                <li>⏱️ {course.durationHours}h de vidéos HD</li>
                <li>📱 Accès mobile à vie</li>
                <li>🏆 Certificat officiel AfricaSkills</li>
                <li>💬 Groupe Telegram privé</li>
                <li>🇬🇧 Anglais intensif inclus (3 mois)</li>
                <li>💼 Accès aux offres d&apos;emploi partenaires</li>
              </ul>
            </div>

            <div className="rounded-2xl border border-orange-500/30 bg-orange-500/5 p-5">
              <div className="text-xs font-bold uppercase tracking-wider text-orange-400">
                Garantie
              </div>
              <div className="mt-1 text-sm font-bold text-white">
                Satisfait ou remboursé 14 jours
              </div>
              <p className="mt-2 text-xs text-neutral-400">
                Si le cours ne te convient pas, on te rembourse intégralement,
                sans question.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
