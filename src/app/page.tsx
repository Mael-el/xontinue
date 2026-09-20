// ============================================================
// PAGE D'ACCUEIL — AfricaSkills
// Hero, domaines, cours vedettes, stats, témoignages, CTA
// ============================================================

import Link from "next/link";
import { db } from "@/db";
import {
  domains,
  courses,
  users,
  userBadges,
  companies,
  jobs,
  enrollments,
} from "@/db/schema";
import { eq, sql, desc, or, isNull, gt } from "drizzle-orm";
import { DomainCard } from "@/components/DomainCard";
import { CourseCard } from "@/components/CourseCard";

export const dynamic = "force-dynamic";

async function ensureSeed() {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(domains);
  if (count === 0) {
    // Appel interne au seed
    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
    try {
      await fetch(`${baseUrl}/api/seed`, {
        method: "POST",
        cache: "no-store",
      });
    } catch {
      // silencieux — le seed peut échouer lors du premier render
    }
  }
}

export default async function HomePage() {
  await ensureSeed();

  // Chargement parallèle des données
  const [domainsRes, topCourses, stats] = await Promise.all([
    db
      .select({
        id: domains.id,
        slug: domains.slug,
        name: domains.name,
        description: domains.description,
        icon: domains.icon,
        color: domains.color,
        coursesCount: sql<number>`count(${courses.id})::int`,
      })
      .from(domains)
      .leftJoin(courses, eq(courses.domainId, domains.id))
      .groupBy(domains.id)
      .orderBy(domains.name),
    db
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
          name: domains.name,
          icon: domains.icon,
          color: domains.color,
        },
      })
      .from(courses)
      .innerJoin(domains, eq(courses.domainId, domains.id))
      .leftJoin(users, eq(courses.instructorId, users.id))
      .where(eq(courses.status, "published"))
      .orderBy(desc(courses.studentsCount))
      .limit(6),
    Promise.all([
      // Étudiants actifs (comptes vérifiés)
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(users)
        .where(eq(users.status, "active")),
      // Formations publiées
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(courses)
        .where(eq(courses.status, "published")),
      // Badges & certifications réellement décernés
      db.select({ count: sql<number>`count(*)::int` }).from(userBadges),
      // Entreprises partenaires
      db.select({ count: sql<number>`count(*)::int` }).from(companies),
      // Offres d'emploi encore ouvertes (non expirées)
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(jobs)
        .where(or(isNull(jobs.expiresAt), gt(jobs.expiresAt, new Date()))),
      // Talents formés (formations terminées à 100 %)
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(enrollments)
        .where(eq(enrollments.status, "completed")),
    ]),
  ]);

  const [userStats, courseStats, badgeStats, companyStats, jobStats, trainedStats] =
    stats;

  const activeStudents = userStats[0]?.count ?? 0;
  const trainedCount = trainedStats[0]?.count ?? 0;

  // Format honnête : « 12 340+ » (le + seulement s'il y en a au moins un)
  const fmtCount = (n: number, suffix = "+") =>
    n > 0 ? `${n.toLocaleString("fr-FR")}${suffix}` : "0";

  return (
    <>
      {/* ============================================================
          HERO
          ============================================================ */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 adinkra-pattern opacity-60" />
        <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8 lg:py-36">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-orange-500/30 bg-orange-500/10 px-4 py-1.5 text-xs font-semibold text-orange-400">
                <span className="pulse-dot relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                {trainedCount > 0
                  ? `${trainedCount} talent${trainedCount > 1 ? "s" : ""} déjà formé${trainedCount > 1 ? "s" : ""} sur AfricaSkills`
                  : "La plateforme panafricaine des compétences"}
              </div>

              <h1 className="mt-6 text-4xl font-black leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-6xl">
                L&apos;Afrique forme.
                <br />
                <span className="animated-gradient bg-gradient-to-r from-orange-500 via-amber-400 to-emerald-500 bg-clip-text text-transparent">
                  L&apos;Afrique embauche.
                </span>
              </h1>

              <p className="mt-6 max-w-xl text-lg leading-relaxed text-neutral-400">
                AfricaSkills est la première plateforme panafricaine qui{" "}
                <span className="font-semibold text-white">
                  forme les jeunes par domaines
                </span>
                ,{" "}
                <span className="font-semibold text-white">
                  certifie leurs compétences par des badges
                </span>{" "}
                et les{" "}
                <span className="font-semibold text-white">
                  connecte aux entreprises
                </span>
                . L&apos;anglais professionnel en 3 mois, imposé.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href="/courses"
                  className="rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-3.5 text-sm font-bold text-black shadow-xl shadow-orange-500/30 transition hover:from-orange-400 hover:to-amber-400"
                >
                  Explorer les formations →
                </Link>
                <Link
                  href="/badges"
                  className="rounded-xl border border-neutral-700 px-6 py-3.5 text-sm font-semibold text-white transition hover:border-orange-500/50 hover:bg-neutral-900"
                >
                  Voir les certifications
                </Link>
              </div>

              {/* Paiements acceptés */}
              <div className="mt-10 flex items-center gap-6 border-t border-neutral-900 pt-6">
                <span className="text-xs uppercase tracking-widest text-neutral-500">
                  Paiements
                </span>
                <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-neutral-400">
                  <span>🟡 MTN MoMo</span>
                  <span>🟠 Orange Money</span>
                  <span>🔵 Wave</span>
                  <span>🟣 Moov Money</span>
                </div>
              </div>
            </div>

            {/* Carte de présentation visuelle */}
            <div className="relative">
              <div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-orange-500/20 via-amber-500/10 to-emerald-500/20 blur-2xl" />
              <div className="relative rounded-3xl border border-neutral-800 bg-neutral-950 p-6 shadow-2xl">
                <div className="flex items-center justify-between border-b border-neutral-900 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 text-xl">
                      👨🏾‍💻
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white">
                        Kwame A.
                      </div>
                      <div className="text-xs text-neutral-500">
                        Fullstack Developer · Accra 🇬🇭
                      </div>
                    </div>
                  </div>
                  <span className="rounded-full bg-emerald-500/20 px-2.5 py-1 text-[10px] font-bold text-emerald-400">
                    LEVEL 12
                  </span>
                </div>

                <div className="mt-5 space-y-3">
                  <Stat label="XP Total" value="8 420" accent="text-amber-400" />
                  <Stat
                    label="Anglais"
                    value="B2 — Semaine 9/12"
                    accent="text-emerald-400"
                  />
                  <Stat label="Cours terminés" value="7" accent="text-white" />
                </div>

                <div className="mt-5">
                  <div className="mb-2 text-[10px] uppercase tracking-wider text-neutral-500">
                    Badges débloqués
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <BadgePreview icon="⚔️" name="Fullstack Hero" />
                    <BadgePreview icon="🥇" name="English Pro" />
                    <BadgePreview icon="🤖" name="AI Builder" />
                    <BadgePreview icon="🛡️" name="Cyber Guardian" />
                  </div>
                </div>

                <div className="mt-5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 p-4">
                  <div className="flex items-center justify-between text-black">
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-wider">
                        Offre reçue
                      </div>
                      <div className="text-sm font-bold">
                        Senior Dev @ Wave · 2.2M FCFA/mois
                      </div>
                    </div>
                    <div className="text-2xl">💼</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          STATS
          ============================================================ */}
      <section className="border-y border-neutral-900 bg-neutral-950/50">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-4 px-4 py-12 sm:px-6 md:grid-cols-5 lg:px-8">
          <StatBig
            value={fmtCount(activeStudents)}
            label="Étudiants actifs"
            icon="🎓"
          />
          <StatBig
            value={fmtCount(courseStats[0]?.count ?? 0)}
            label="Formations"
            icon="📚"
          />
          <StatBig
            value={fmtCount(badgeStats[0]?.count ?? 0)}
            label="Badges décernés"
            icon="🏆"
          />
          <StatBig
            value={fmtCount(companyStats[0]?.count ?? 0)}
            label="Entreprises partenaires"
            icon="🏢"
          />
          <StatBig
            value={fmtCount(jobStats[0]?.count ?? 0)}
            label="Offres d'emploi"
            icon="💼"
          />
        </div>
      </section>

      {/* ============================================================
          DOMAINES
          ============================================================ */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <SectionHeader
          eyebrow="12 domaines d'excellence"
          title="Choisis ta voie."
          subtitle="De l'anglais à la robotique, chaque parcours est conçu par des experts africains et validé par les entreprises du continent."
        />
        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {domainsRes.map((d) => (
            <DomainCard
              key={d.id}
              slug={d.slug}
              name={d.name}
              description={d.description}
              icon={d.icon}
              color={d.color}
              coursesCount={d.coursesCount}
            />
          ))}
        </div>
      </section>

      {/* ============================================================
          COURS VEDETTES
          ============================================================ */}
      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
        <SectionHeader
          eyebrow="Les plus populaires"
          title="Formations qui changent des vies."
          subtitle="Rejoins des milliers d'étudiants qui ont transformé leur carrière avec AfricaSkills."
          cta={{ href: "/courses", label: "Voir toutes les formations" }}
        />
        <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {topCourses.map((c) => (
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
      </section>

      {/* ============================================================
          POURQUOI AFRICASKILLS
          ============================================================ */}
      <section className="border-y border-neutral-900 bg-gradient-to-b from-neutral-950 to-[#0A0A0A]">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <SectionHeader
            eyebrow="Notre différence"
            title="Pensé pour l'Afrique. Par l'Afrique."
          />
          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Feature
              icon="🌍"
              title="100% panafricain"
              description="Instructeurs africains, contenus adaptés au contexte local, études de cas sur MTN, Wave, Jumia, Flutterwave."
            />
            <Feature
              icon="📱"
              title="Paiement Mobile Money"
              description="MTN MoMo, Orange Money, Wave, Moov. Aucun compte bancaire requis. Paye en 3 fois sans frais."
            />
            <Feature
              icon="🇬🇧"
              title="Anglais imposé en 3 mois"
              description="Chaque étudiant suit le programme intensif d'anglais. B2 garanti ou remboursé."
            />
            <Feature
              icon="🏆"
              title="Badges reconnus"
              description="Tes certifications sont vérifiables et reconnues par +80 entreprises partenaires."
            />
            <Feature
              icon="💼"
              title="Emploi garanti"
              description="Les meilleurs étudiants sont directement mis en relation avec nos entreprises partenaires."
            />
            <Feature
              icon="🚀"
              title="Accélérateur startup"
              description="Un parcours entrepreneuriat + incubateur pour lancer ta startup avec mentorat et funding."
            />
          </div>
        </div>
      </section>

      {/* ============================================================
          CTA FINAL
          ============================================================ */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-orange-500 via-amber-500 to-emerald-500 p-1">
          <div className="relative rounded-[22px] bg-[#0A0A0A] p-10 sm:p-16">
            <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-orange-500 opacity-20 blur-3xl" />
            <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-emerald-500 opacity-20 blur-3xl" />

            <div className="relative max-w-2xl">
              <div className="text-sm font-bold uppercase tracking-widest text-orange-400">
                Rejoins le mouvement
              </div>
              <h2 className="mt-3 text-3xl font-black text-white sm:text-5xl">
                Ton futur commence <br />
                <span className="bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">
                  aujourd&apos;hui.
                </span>
              </h2>
              <p className="mt-4 text-lg text-neutral-400">
                Inscris-toi gratuitement, choisis ton parcours, paie via Mobile
                Money, et rejoins la plus grande communauté tech d&apos;Afrique.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/courses"
                  className="rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-3.5 text-sm font-bold text-black transition hover:from-orange-400 hover:to-amber-400"
                >
                  Créer mon compte gratuitement
                </Link>
                <Link
                  href="/about"
                  className="rounded-xl border border-neutral-700 px-6 py-3.5 text-sm font-semibold text-white transition hover:border-white/30"
                >
                  Comment ça marche ?
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

// ============================================================
// SOUS-COMPOSANTS LOCAUX
// ============================================================

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-neutral-900 bg-black/30 px-3 py-2">
      <span className="text-xs text-neutral-500">{label}</span>
      <span className={`text-sm font-bold ${accent}`}>{value}</span>
    </div>
  );
}

function BadgePreview({ icon, name }: { icon: string; name: string }) {
  return (
    <div className="flex items-center gap-1.5 rounded-full border border-neutral-800 bg-neutral-900 px-2.5 py-1">
      <span className="text-sm">{icon}</span>
      <span className="text-xs font-semibold text-neutral-300">{name}</span>
    </div>
  );
}

function StatBig({
  value,
  label,
  icon,
}: {
  value: string;
  label: string;
  icon: string;
}) {
  return (
    <div className="flex flex-col">
      <div className="flex items-baseline gap-2">
        <span className="text-2xl">{icon}</span>
        <span className="bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-3xl font-black text-transparent sm:text-4xl">
          {value}
        </span>
      </div>
      <span className="mt-1 text-xs font-medium text-neutral-500 sm:text-sm">
        {label}
      </span>
    </div>
  );
}

function SectionHeader({
  eyebrow,
  title,
  subtitle,
  cta,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  cta?: { href: string; label: string };
}) {
  return (
    <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
      <div className="max-w-2xl">
        <div className="text-xs font-bold uppercase tracking-[0.2em] text-orange-500">
          {eyebrow}
        </div>
        <h2 className="mt-2 text-3xl font-black text-white sm:text-4xl lg:text-5xl">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-3 text-base leading-relaxed text-neutral-400 sm:text-lg">
            {subtitle}
          </p>
        )}
      </div>
      {cta && (
        <Link
          href={cta.href}
          className="shrink-0 rounded-lg border border-neutral-700 px-4 py-2 text-sm font-semibold text-white transition hover:border-orange-500/50 hover:text-orange-400"
        >
          {cta.label} →
        </Link>
      )}
    </div>
  );
}

function Feature({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-950/50 p-6 transition hover:border-orange-500/30">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500/20 to-amber-500/20 text-2xl">
        {icon}
      </div>
      <h3 className="mt-4 text-lg font-bold text-white">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-neutral-400">
        {description}
      </p>
    </div>
  );
}
