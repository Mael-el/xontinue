// ============================================================
// PAGE — Dashboard étudiant (données réelles depuis l'API)
// ============================================================

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth/context";
import {
  applicationStatusColor,
  applicationStatusLabel,
  type ApplicationStatus,
} from "@/lib/format";

interface DashboardData {
  user: any;
  overview: {
    xp: number;
    streak: number;
    englishLevel: number;
    rank: number;
    totalStudents: number;
    coursesTotal: number;
    coursesCompleted: number;
    coursesInProgress: number;
    totalLearningHours: number;
    avgProgress: number;
    badgesCount: number;
    projectsCount: number;
    skillsCount: number;
    applicationsCount: number;
  };
  currentCourses: any[];
  completedCourses: any[];
  earnedBadges: any[];
  nextBadges: any[];
  skills: any[];
  projects: any[];
  applications: any[];
  progressChart: { date: string; xp: number }[];
}

export default function DashboardPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!isAuthenticated) {
      // Différé en micro-tâche : évite un setState synchrone dans l'effet
      queueMicrotask(() => {
        if (!cancelled) setLoading(false);
      });
      return () => {
        cancelled = true;
      };
    }
    fetch("/api/v1/dashboard", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d.ok) setData(d);
        else setError(d.error);
      })
      .catch(() => {
        if (!cancelled) setError("Erreur réseau");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  if (authLoading || loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-2xl bg-neutral-900"
            />
          ))}
        </div>
        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <div className="h-96 animate-pulse rounded-2xl bg-neutral-900 lg:col-span-2" />
          <div className="h-96 animate-pulse rounded-2xl bg-neutral-900" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <div className="text-6xl">🔐</div>
        <h1 className="mt-4 text-2xl font-black text-white">
          Connecte-toi pour accéder à ton dashboard
        </h1>
        <p className="mt-2 text-neutral-400">
          Suis tes progrès, tes badges et tes candidatures en temps réel.
        </p>
        <Link
          href="/auth/login"
          className="mt-6 inline-block rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-3 text-sm font-bold text-black"
        >
          Se connecter →
        </Link>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <div className="text-6xl">⚠️</div>
        <h1 className="mt-4 text-2xl font-black text-white">
          Erreur de chargement
        </h1>
        <p className="mt-2 text-neutral-400">{error ?? "Données indisponibles"}</p>
      </div>
    );
  }

  const { overview } = data;

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/profile/me"
            className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 text-3xl"
          >
            {user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.avatarUrl}
                alt=""
                className="h-full w-full rounded-2xl object-cover"
              />
            ) : (
              <span>👤</span>
            )}
          </Link>
          <div>
            <div className="text-xs uppercase tracking-widest text-neutral-500">
              Bienvenue
            </div>
            <h1 className="text-3xl font-black text-white">
              {data.user?.fullName ?? user.fullName}
            </h1>
            <div className="text-sm text-neutral-400">
              Niveau {Math.floor(overview.xp / 100) + 1} · {overview.xp} XP ·
              Rang #{overview.rank}/{overview.totalStudents}
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <Link
            href="/profile/me"
            className="rounded-xl border border-neutral-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:border-white/30"
          >
            Mon profil
          </Link>
          <Link
            href="/courses"
            className="rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-2.5 text-sm font-bold text-black"
          >
            + Nouveau cours
          </Link>
        </div>
      </div>

      {/* Stats dashboard */}
      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <DashStat
          icon="⚡"
          label="XP Total"
          value={overview.xp.toLocaleString("fr-FR")}
          delta={`Rang #${overview.rank}`}
          color="text-amber-400"
        />
        <DashStat
          icon="🎓"
          label="Cours"
          value={`${overview.coursesCompleted}/${overview.coursesTotal}`}
          delta={`${overview.coursesInProgress} en cours`}
          color="text-emerald-400"
        />
        <DashStat
          icon="🏆"
          label="Badges"
          value={overview.badgesCount.toString()}
          delta={`${overview.projectsCount} projets`}
          color="text-purple-400"
        />
        <DashStat
          icon="🔥"
          label="Streak"
          value={`${overview.streak}j`}
          delta={`${overview.totalLearningHours}h apprises`}
          color="text-orange-400"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Colonne principale */}
        <div className="space-y-6 lg:col-span-2">
          {/* Anglais */}
          <div className="rounded-2xl border border-neutral-800 bg-gradient-to-br from-sky-500/10 to-emerald-500/5 p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-bold uppercase tracking-widest text-sky-400">
                  Programme obligatoire
                </div>
                <h3 className="mt-1 text-xl font-bold text-white">
                  🇬🇧 Anglais Intensif — Semaine {Math.min(12, overview.englishLevel || 4)}/12
                </h3>
                <p className="mt-1 text-sm text-neutral-400">
                  Objectif B2. {12 - Math.min(12, overview.englishLevel || 4)} semaines restantes.
                </p>
              </div>
              <div className="text-5xl">📅</div>
            </div>
            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="font-semibold text-neutral-400">Progression</span>
                <span className="font-bold text-white">
                  {Math.round(((overview.englishLevel || 4) / 12) * 100)}%
                </span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-neutral-900">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-sky-400 to-emerald-500"
                  style={{
                    width: `${((overview.englishLevel || 4) / 12) * 100}%`,
                  }}
                />
              </div>
            </div>
            <Link
              href="/courses?domain=anglais"
              className="mt-5 inline-block rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-black transition hover:bg-neutral-200"
            >
              Continuer la leçon du jour →
            </Link>
          </div>

          {/* Progression chart — données réelles (lesson_completions) */}
          <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6">
            <div className="mb-1 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">
                📈 Progression (30 jours)
              </h3>
              <span className="text-xs text-neutral-500">
                XP de leçons validées / jour
              </span>
            </div>
            <div className="mb-4 text-xs text-neutral-400">
              ⚡{" "}
              <b className="text-amber-400">
                {data.progressChart.reduce((s, p) => s + p.xp, 0)} XP
              </b>{" "}
              sur la période
              {(() => {
                const best = data.progressChart.reduce((a, b) =>
                  b.xp > a.xp ? b : a
                );
                if (best.xp === 0) return null;
                return (
                  <>
                    {" "}
                    · meilleur jour :{" "}
                    <b className="text-orange-400">{best.xp} XP</b> le{" "}
                    {new Date(best.date + "T00:00:00Z").toLocaleDateString(
                      "fr-FR",
                      { day: "numeric", month: "long" }
                    )}
                  </>
                );
              })()}
            </div>
            <div className="flex h-40 items-end gap-[3px]">
              {data.progressChart.map((d, i) => {
                const max = Math.max(
                  ...data.progressChart.map((p) => p.xp),
                  10
                );
                const h = d.xp > 0 ? Math.max((d.xp / max) * 100, 4) : 0;
                const isToday = i === data.progressChart.length - 1;
                const dayLabel = new Date(
                  d.date + "T00:00:00Z"
                ).toLocaleDateString("fr-FR", {
                  day: "numeric",
                  month: "short",
                });
                return (
                  <div
                    key={d.date}
                    className={`group relative flex-1 transition ${
                      d.xp === 0
                        ? "rounded-sm bg-neutral-800/70 hover:bg-neutral-700"
                        : isToday
                          ? "rounded-t bg-gradient-to-t from-emerald-600 to-emerald-400 hover:from-emerald-500 hover:to-emerald-300"
                          : "rounded-t bg-gradient-to-t from-orange-500 to-amber-400 hover:from-orange-400 hover:to-amber-300"
                    }`}
                    style={{ height: d.xp > 0 ? `${h}%` : "3px" }}
                    title={`${dayLabel} : ${d.xp} XP`}
                  >
                    <div className="pointer-events-none absolute -top-8 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded bg-black px-1.5 py-0.5 text-[10px] font-bold text-white ring-1 ring-neutral-700 group-hover:block">
                      {dayLabel} · {d.xp} XP
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-2 flex justify-between text-[10px] text-neutral-500">
              <span>-29 jours</span>
              <span>
                <span className="text-emerald-400">■</span> Aujourd&apos;hui
              </span>
            </div>
          </div>

          {/* Cours en cours */}
          <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">
                📚 Mes formations en cours ({data.currentCourses.length})
              </h3>
              <Link
                href="/courses"
                className="text-sm font-semibold text-orange-500 hover:text-orange-400"
              >
                Explorer →
              </Link>
            </div>
            {data.currentCourses.length === 0 ? (
              <EmptyState
                emoji="📚"
                text="Aucun cours en cours. Explore le catalogue !"
                cta={{ href: "/courses", label: "Voir les formations" }}
              />
            ) : (
              <div className="space-y-4">
                {data.currentCourses.map((c) => (
                  <CourseProgressRow key={c.id} course={c} />
                ))}
              </div>
            )}
          </div>

          {/* Recommandations */}
          {data.completedCourses.length > 0 && (
            <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6">
              <h3 className="mb-4 text-lg font-bold text-white">
                ✅ Cours terminés ({data.completedCourses.length})
              </h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {data.completedCourses.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center gap-3 rounded-lg bg-black/30 p-3 transition hover:bg-black/50"
                  >
                    <Link
                      href={`/courses/${c.slug}`}
                      className="flex min-w-0 flex-1 items-center gap-3"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-900 text-xl">
                        {c.domain?.icon ?? "📚"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-bold text-white">
                          {c.title}
                        </div>
                        <div className="text-xs text-neutral-500">
                          {c.domain?.name}
                        </div>
                      </div>
                    </Link>
                    <span className="text-xs font-bold text-emerald-400">
                      100%
                    </span>
                    <Link
                      href={`/certificates/${c.id}`}
                      title="Voir le certificat"
                      className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-xs transition hover:bg-emerald-500/20"
                    >
                      📜
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <aside className="space-y-6">
          {/* Mes badges */}
          <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">🏆 Mes badges</h3>
              <Link
                href="/badges"
                className="text-xs font-semibold text-orange-500 hover:text-orange-400"
              >
                Tous →
              </Link>
            </div>
            {data.earnedBadges.length === 0 ? (
              <EmptyState
                emoji="🏆"
                text="Aucun badge encore. Termine ta première leçon !"
              />
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {data.earnedBadges.slice(0, 6).map((b) => (
                  <div
                    key={b.slug}
                    className="rounded-xl border border-neutral-800 bg-black/30 p-2 text-center"
                  >
                    <div className="text-2xl">{b.icon}</div>
                    <div className="mt-1 truncate text-[10px] font-bold text-white">
                      {b.name}
                    </div>
                    <div className="text-[9px] capitalize text-neutral-500">
                      {b.rarity}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Classement */}
          <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6">
            <h3 className="mb-4 text-lg font-bold text-white">
              🔥 Classement
            </h3>
            <div className="text-center">
              <div className="text-5xl">🥇</div>
              <div className="mt-2 text-4xl font-black text-amber-400">
                #{overview.rank}
              </div>
              <div className="text-xs text-neutral-500">
                sur {overview.totalStudents} étudiants actifs
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-neutral-900">
                <div
                  className="h-full bg-gradient-to-r from-amber-400 to-orange-500"
                  style={{
                    width: `${Math.max(
                      5,
                      100 - (overview.rank / Math.max(overview.totalStudents, 1)) * 100
                    )}%`,
                  }}
                />
              </div>
              <div className="mt-2 text-[11px] text-neutral-500">
                Top {Math.round((overview.rank / Math.max(overview.totalStudents, 1)) * 100)}%
              </div>
            </div>
          </div>

          {/* Prochains badges */}
          {data.nextBadges.length > 0 && (
            <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-orange-500/5 p-6">
              <div className="text-xs font-bold uppercase tracking-widest text-amber-400">
                Prochain badge
              </div>
              <div className="mt-2 text-4xl">{data.nextBadges[0].icon}</div>
              <div className="mt-2 text-lg font-bold text-white">
                {data.nextBadges[0].name}
              </div>
              <p className="mt-1 text-xs text-neutral-400">
                Il te reste {data.nextBadges[0].requiredXp - overview.xp} XP.
              </p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-neutral-900">
                <div
                  className="h-full bg-gradient-to-r from-amber-400 to-orange-500"
                  style={{
                    width: `${Math.min(
                      99,
                      (overview.xp / Math.max(data.nextBadges[0].requiredXp, 1)) * 100
                    )}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Candidatures */}
          <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">
                💼 Candidatures
              </h3>
              <Link
                href="/jobs"
                className="text-xs font-semibold text-orange-500 hover:text-orange-400"
              >
                Voir →
              </Link>
            </div>
            {data.applications.length === 0 ? (
              <EmptyState
                emoji="💼"
                text="Aucune candidature. Découvre les offres partenaires !"
              />
            ) : (
              <div className="space-y-2">
                {data.applications.map((a) => (
                  <div
                    key={a.id}
                    className="rounded-lg bg-black/30 p-2 text-xs"
                  >
                    <div className="font-bold text-white">{a.jobTitle}</div>
                    <div className="text-neutral-500">{a.companyName}</div>
                    <div
                      className={`mt-1 inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold ${applicationStatusColor(a.status as ApplicationStatus)}`}
                    >
                      {applicationStatusLabel(a.status as ApplicationStatus)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function DashStat({
  icon,
  label,
  value,
  delta,
  color,
}: {
  icon: string;
  label: string;
  value: string;
  delta: string;
  color: string;
}) {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-5">
      <div className="flex items-center gap-2">
        <span className="text-2xl">{icon}</span>
        <span className={`text-3xl font-black ${color}`}>{value}</span>
      </div>
      <div className="mt-1 text-xs text-neutral-500">{label}</div>
      <div className="mt-2 text-[11px] font-semibold text-emerald-400">
        ↑ {delta}
      </div>
    </div>
  );
}

function CourseProgressRow({ course }: { course: any }) {
  return (
    <Link
      href={`/courses/${course.slug}`}
      className="block rounded-xl border border-neutral-800 bg-black/30 p-4 transition hover:border-orange-500/50"
    >
      <div className="flex items-center gap-3">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-lg ${
            course.domain?.color ?? "bg-orange-500"
          } text-xl`}
        >
          {course.domain?.icon ?? "📚"}
        </div>
        <div className="flex-1">
          <div className="text-sm font-bold text-white">{course.title}</div>
          <div className="text-xs text-neutral-500">
            {course.domain?.name} · {course.durationHours ?? 0}h
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm font-black text-orange-400">
            {course.progress}%
          </div>
        </div>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-neutral-900">
        <div
          className="h-full bg-gradient-to-r from-orange-500 to-amber-500"
          style={{ width: `${course.progress}%` }}
        />
      </div>
    </Link>
  );
}

function EmptyState({
  emoji,
  text,
  cta,
}: {
  emoji: string;
  text: string;
  cta?: { href: string; label: string };
}) {
  return (
    <div className="rounded-xl border border-dashed border-neutral-800 bg-black/20 p-8 text-center">
      <div className="text-3xl">{emoji}</div>
      <p className="mt-2 text-sm text-neutral-400">{text}</p>
      {cta && (
        <Link
          href={cta.href}
          className="mt-3 inline-block text-xs font-bold text-orange-400 hover:text-orange-300"
        >
          {cta.label} →
        </Link>
      )}
    </div>
  );
}
