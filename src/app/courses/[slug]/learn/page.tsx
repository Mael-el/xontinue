// ============================================================
// PAGE — ESPACE D'APPRENTISSAGE D'UN COURS (/courses/[slug]/learn)
// Liste des leçons, progression, XP, badges et certificat.
// ============================================================

"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth/context";
import { formatXof, levelLabel } from "@/lib/format";

// ------------------------------------------------------------
// Types alignés sur les réponses de /api/v1/enrollments
// ------------------------------------------------------------

interface CourseInfo {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  level: "beginner" | "intermediate" | "advanced" | "expert";
  durationHours: number | null;
  priceXof: number;
  domain: { name: string; icon: string | null; color: string | null };
}

interface LessonDto {
  id: string;
  title: string;
  order: number;
  durationMinutes: number | null;
  xpReward: number;
  hasVideo: boolean;
  completed: boolean;
  completedAt: string | null;
}

interface EnrolledData {
  ok: true;
  enrolled: true;
  course: CourseInfo;
  enrollment: {
    id: string;
    status: "active" | "completed" | "cancelled";
    progress: number;
    enrolledAt: string;
    completedAt: string | null;
  };
  lessons: LessonDto[];
  stats: {
    totalLessons: number;
    completedLessons: number;
    xp: number;
    streak: number;
  };
}

interface NotEnrolledData {
  ok: true;
  enrolled: false;
  requiresPayment: boolean;
  course: CourseInfo;
}

type EnrollmentData = EnrolledData | NotEnrolledData;

interface AwardedBadge {
  slug: string;
  name: string;
  icon: string | null;
  rarity: string;
}

const RARITY_STYLE: Record<string, string> = {
  common: "border-neutral-500 text-neutral-300",
  rare: "border-sky-400 text-sky-300",
  epic: "border-violet-400 text-violet-300",
  legendary: "border-amber-400 text-amber-300",
};

export default function CourseLearnPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const { isLoading: authLoading, isAuthenticated } = useAuth();

  const [data, setData] = useState<EnrollmentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [unenrolling, setUnenrolling] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [newBadges, setNewBadges] = useState<AwardedBadge[]>([]);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Affiche un message éphémère en haut de page. */
  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }, []);

  /**
   * Charge l'inscription + les leçons depuis l'API.
   * Les setState ont lieu après le `await` (jamais de façon
   * synchrone dans un effet React).
   */
  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/enrollments/${slug}`, {
        credentials: "include",
      });
      const json = await res.json();
      if (!json.ok) {
        setData(null);
        setError(json.error ?? "Impossible de charger le cours");
      } else {
        setError(null);
        setData(json as EnrollmentData);
      }
    } catch {
      setData(null);
      setError("Erreur réseau. Réessaie plus tard.");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    // Chargement initial depuis l'API : `load` ne fait des setState
    // qu'après `await fetch` (fetch-on-mount, pas de cascade synchrone).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isAuthenticated) void load();
  }, [isAuthenticated, load]);

  /** Inscription à un cours gratuit. */
  async function handleEnroll() {
    setEnrolling(true);
    try {
      const res = await fetch("/api/v1/enrollments", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseSlug: slug }),
      });
      const json = await res.json();
      if (json.ok) {
        showToast("🎉 Inscription confirmée. Bon apprentissage !");
        await load();
      } else {
        showToast(json.error ?? "Impossible de s'inscrire");
      }
    } catch {
      showToast("Erreur réseau. Réessaie plus tard.");
    } finally {
      setEnrolling(false);
    }
  }

  /** Marque une leçon comme terminée. */
  async function handleComplete(lessonId: string) {
    if (completingId || !data?.enrolled) return;
    setCompletingId(lessonId);
    try {
      const res = await fetch(
        `/api/v1/enrollments/${slug}/lessons/${lessonId}/complete`,
        { method: "POST", credentials: "include" }
      );
      const json = await res.json();
      if (!json.ok) {
        showToast(json.error ?? "Erreur lors de la validation");
        return;
      }

      setData((prev) =>
        prev?.enrolled
          ? {
              ...prev,
              enrollment: {
                ...prev.enrollment,
                progress: json.progress,
                status: json.courseCompleted
                  ? "completed"
                  : prev.enrollment.status,
                completedAt: json.courseCompleted
                  ? new Date().toISOString()
                  : prev.enrollment.completedAt,
              },
              lessons: prev.lessons.map((l) =>
                l.id === lessonId
                  ? { ...l, completed: true, completedAt: new Date().toISOString() }
                  : l
              ),
              stats: {
                ...prev.stats,
                completedLessons:
                  prev.stats.completedLessons +
                  (json.alreadyCompleted ? 0 : 1),
                xp: typeof json.xp === "number" ? json.xp : prev.stats.xp,
                streak:
                  typeof json.streak === "number"
                    ? json.streak
                    : prev.stats.streak,
              },
            }
          : prev
      );

      if (!json.alreadyCompleted) {
        const total = (json.xpGained ?? 0) + (json.bonusXp ?? 0);
        showToast(
          json.bonusXp
            ? `🏆 Cours terminé ! +${total} XP (bonus inclus)`
            : `✅ Leçon validée ! +${json.xpGained} XP`
        );
      }
      if (Array.isArray(json.newBadges) && json.newBadges.length > 0) {
        setNewBadges(json.newBadges);
      }
    } catch {
      showToast("Erreur réseau. Réessaie plus tard.");
    } finally {
      setCompletingId(null);
    }
  }

  /** Se désinscrire du cours (progression conservée côté serveur). */
  async function handleUnenroll() {
    if (!confirm("Te désinscrire de ce cours ? Ta progression sera conservée."))
      return;
    setUnenrolling(true);
    try {
      const res = await fetch(`/api/v1/enrollments/${slug}`, {
        method: "DELETE",
        credentials: "include",
      });
      const json = await res.json();
      if (json.ok) {
        showToast("Inscription annulée.");
        await load();
      } else {
        showToast(json.error ?? "Impossible de se désinscrire");
      }
    } catch {
      showToast("Erreur réseau. Réessaie plus tard.");
    } finally {
      setUnenrolling(false);
    }
  }

  // ----------------------------------------------------------
  // États de chargement / erreur / authentification
  // ----------------------------------------------------------

  if (authLoading) {
    return (
      <div className="mx-auto flex max-w-4xl flex-col items-center px-4 py-24">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
        <p className="mt-4 text-sm text-neutral-500">Chargement…</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <CenteredCard
        icon="🔐"
        title="Connexion requise"
        text="Connecte-toi pour accéder à ton espace d'apprentissage."
        action={{ href: "/auth/login", label: "Se connecter" }}
        secondary={{ href: `/courses/${slug}`, label: "Retour au cours" }}
      />
    );
  }

  if (loading) {
    return (
      <div className="mx-auto flex max-w-4xl flex-col items-center px-4 py-24">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
        <p className="mt-4 text-sm text-neutral-500">Chargement du cours…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <CenteredCard
        icon="😕"
        title="Cours introuvable"
        text={error ?? "Ce cours n'existe pas ou n'est plus disponible."}
        action={{ href: "/courses", label: "Voir le catalogue" }}
      />
    );
  }

  // ----------------------------------------------------------
  // Paywall / inscription (pas encore inscrit)
  // ----------------------------------------------------------

  if (!data.enrolled) {
    const { course } = data;
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <Link
          href={`/courses/${slug}`}
          className="text-sm text-neutral-500 hover:text-white"
        >
          ← Retour à la présentation
        </Link>
        <div className="mt-6 rounded-2xl border border-neutral-800 bg-neutral-950 p-8 text-center">
          <div className="text-6xl">{course.domain?.icon ?? "📚"}</div>
          <h1 className="mt-4 text-2xl font-black text-white">
            {course.title}
          </h1>
          <p className="mt-2 text-sm text-neutral-400">
            {course.domain?.name} · {levelLabel(course.level)} ·{" "}
            {course.durationHours ?? 0}h de contenu
          </p>

          {data.requiresPayment ? (
            <div className="mt-8">
              <div className="text-3xl font-black text-white">
                {formatXof(course.priceXof)}
              </div>
              <p className="mt-2 text-sm text-neutral-500">
                Cette formation est payante. Règle par Mobile Money pour
                débloquer toutes les leçons.
              </p>
              <Link
                href={`/courses/${slug}`}
                className="mt-5 inline-block rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-3 text-sm font-bold text-black shadow-lg shadow-orange-500/30 transition hover:from-orange-400 hover:to-amber-400"
              >
                💳 Acheter la formation
              </Link>
            </div>
          ) : (
            <div className="mt-8">
              <div className="text-3xl font-black text-emerald-400">
                Gratuit
              </div>
              <p className="mt-2 text-sm text-neutral-500">
                Inscris-toi pour suivre ta progression et gagner de l’XP.
              </p>
              <button
                onClick={handleEnroll}
                disabled={enrolling}
                className="mt-5 rounded-xl bg-emerald-500 px-6 py-3 text-sm font-bold text-black transition hover:bg-emerald-400 disabled:opacity-50"
              >
                {enrolling ? "⏳ Inscription…" : "🚀 Commencer gratuitement"}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ----------------------------------------------------------
  // Espace d'apprentissage (inscrit)
  // ----------------------------------------------------------

  const { course, enrollment, lessons, stats } = data;
  const completed = enrollment.status === "completed";
  const nextLesson = lessons.find((l) => !l.completed);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      {/* Toast de feedback */}
      {toast && (
        <div className="fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-xl border border-emerald-500/40 bg-neutral-900 px-5 py-3 text-sm font-semibold text-emerald-300 shadow-2xl">
          {toast}
        </div>
      )}

      {/* Nouveaux badges débloqués */}
      {newBadges.length > 0 && (
        <div className="mb-6 rounded-2xl border border-amber-400/40 bg-gradient-to-br from-amber-500/10 to-transparent p-5">
          <div className="text-sm font-bold uppercase tracking-wider text-amber-300">
            🏅 Nouveau{newBadges.length > 1 ? "x" : ""} badge
            {newBadges.length > 1 ? "s" : ""} débloqué
            {newBadges.length > 1 ? "s" : ""} !
          </div>
          <div className="mt-3 flex flex-wrap gap-3">
            {newBadges.map((b) => (
              <div
                key={b.slug}
                className={`flex items-center gap-2 rounded-xl border bg-black/40 px-4 py-2 text-sm font-semibold ${RARITY_STYLE[b.rarity] ?? RARITY_STYLE.common}`}
              >
                <span className="text-xl">{b.icon ?? "🏅"}</span>
                <span>{b.name}</span>
              </div>
            ))}
            <Link
              href="/badges"
              className="flex items-center rounded-xl border border-neutral-700 px-4 py-2 text-sm text-neutral-400 transition hover:border-neutral-500 hover:text-white"
            >
              Voir mes badges →
            </Link>
          </div>
        </div>
      )}

      {/* En-tête */}
      <Link
        href={`/courses/${slug}`}
        className="text-sm text-neutral-500 hover:text-white"
      >
        ← {course.title}
      </Link>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <span className="text-4xl">{course.domain?.icon ?? "📚"}</span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-black text-white">
            {course.title}
          </h1>
          <p className="text-sm text-neutral-500">
            {course.domain?.name} · {levelLabel(course.level)}
          </p>
        </div>
        <div className="flex gap-2 text-xs font-bold">
          <span className="rounded-full bg-amber-500/15 px-3 py-1.5 text-amber-300">
            ⚡ {stats.xp} XP
          </span>
          <span className="rounded-full bg-orange-500/15 px-3 py-1.5 text-orange-300">
            🔥 {stats.streak} jour{stats.streak > 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Barre de progression */}
      <div className="mt-6 rounded-2xl border border-neutral-800 bg-neutral-950 p-5">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold text-white">
            {stats.completedLessons}/{stats.totalLessons} leçons
          </span>
          <span
            className={`font-black ${completed ? "text-emerald-400" : "text-orange-400"}`}
          >
            {enrollment.progress}%
          </span>
        </div>
        <div className="mt-3 h-3 overflow-hidden rounded-full bg-neutral-800">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              completed
                ? "bg-gradient-to-r from-emerald-500 to-emerald-400"
                : "bg-gradient-to-r from-orange-500 to-amber-400"
            }`}
            style={{ width: `${enrollment.progress}%` }}
          />
        </div>
        {completed && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
            <span className="text-sm font-bold text-emerald-300">
              🏆 Formation terminée — bravo !
            </span>
            <div className="flex items-center gap-3">
              <Link
                href={`/certificates/${enrollment.id}`}
                className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-black transition hover:bg-emerald-400"
              >
                📜 Mon certificat
              </Link>
              <Link
                href="/dashboard"
                className="text-xs font-bold text-emerald-200 underline underline-offset-2 hover:text-white"
              >
                Tableau de bord →
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Liste des leçons */}
      <div className="mt-6 space-y-3">
        {lessons.length === 0 && (
          <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-8 text-center text-sm text-neutral-500">
            Les leçons de ce cours arrivent bientôt. 🚧
          </div>
        )}
        {lessons.map((lesson) => {
          const isNext = nextLesson?.id === lesson.id;
          return (
            <div
              key={lesson.id}
              className={`flex items-center gap-4 rounded-2xl border p-4 transition ${
                lesson.completed
                  ? "border-emerald-500/20 bg-neutral-950"
                  : isNext
                    ? "border-orange-500/50 bg-gradient-to-r from-orange-500/5 to-transparent"
                    : "border-neutral-800 bg-neutral-950"
              }`}
            >
              {/* Pastille d'état */}
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-black ${
                  lesson.completed
                    ? "bg-emerald-500/20 text-emerald-400"
                    : isNext
                      ? "bg-orange-500/20 text-orange-400"
                      : "bg-neutral-800 text-neutral-500"
                }`}
              >
                {lesson.completed ? "✓" : lesson.order}
              </div>

              {/* Infos leçon */}
              <div className="min-w-0 flex-1">
                <div
                  className={`truncate text-sm font-semibold ${
                    lesson.completed ? "text-neutral-400" : "text-white"
                  }`}
                >
                  {lesson.title}
                </div>
                <div className="mt-0.5 flex flex-wrap gap-2 text-[11px] text-neutral-500">
                  {lesson.durationMinutes ? (
                    <span>⏱️ {lesson.durationMinutes} min</span>
                  ) : null}
                  <span>⚡ +{lesson.xpReward} XP</span>
                  {lesson.hasVideo && <span>🎬 Vidéo</span>}
                </div>
              </div>

              {/* Action */}
              {lesson.completed ? (
                <span className="shrink-0 rounded-lg bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-400">
                  Terminée
                </span>
              ) : (
                <button
                  onClick={() => handleComplete(lesson.id)}
                  disabled={completingId !== null}
                  className={`shrink-0 rounded-lg px-3 py-2 text-xs font-bold transition disabled:opacity-50 ${
                    isNext
                      ? "bg-gradient-to-r from-orange-500 to-amber-500 text-black hover:from-orange-400 hover:to-amber-400"
                      : "border border-neutral-700 text-neutral-300 hover:border-neutral-500 hover:text-white"
                  }`}
                >
                  {completingId === lesson.id
                    ? "⏳…"
                    : isNext
                      ? "▶ Valider"
                      : "Valider"}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Désinscription discrète */}
      <div className="mt-10 text-center">
        <button
          onClick={handleUnenroll}
          disabled={unenrolling}
          className="text-xs text-neutral-600 underline underline-offset-2 transition hover:text-red-400 disabled:opacity-50"
        >
          {unenrolling ? "Annulation…" : "Se désinscrire de ce cours"}
        </button>
      </div>
    </div>
  );
}

/** Carte centrée générique (erreurs, connexion requise…). */
function CenteredCard({
  icon,
  title,
  text,
  action,
  secondary,
}: {
  icon: string;
  title: string;
  text: string;
  action: { href: string; label: string };
  secondary?: { href: string; label: string };
}) {
  return (
    <div className="mx-auto max-w-md px-4 py-24">
      <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-8 text-center">
        <div className="text-5xl">{icon}</div>
        <h1 className="mt-4 text-xl font-black text-white">{title}</h1>
        <p className="mt-2 text-sm text-neutral-400">{text}</p>
        <Link
          href={action.href}
          className="mt-6 inline-block rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-3 text-sm font-bold text-black transition hover:from-orange-400 hover:to-amber-400"
        >
          {action.label}
        </Link>
        {secondary && (
          <div className="mt-3">
            <Link
              href={secondary.href}
              className="text-xs text-neutral-500 underline underline-offset-2 hover:text-white"
            >
              {secondary.label}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
