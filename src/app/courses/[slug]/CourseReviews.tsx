// ============================================================
// COMPOSANT CLIENT — AVIS & NOTES D'UN COURS
// Agrégats (moyenne, distribution), liste des avis vérifiés,
// formulaire de dépôt/modification pour les étudiants inscrits.
// ============================================================

"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth/context";
import { relativeTime } from "@/lib/format";

// ------------------------------------------------------------
// Types alignés sur GET /api/v1/courses/[slug]/reviews
// ------------------------------------------------------------

interface ReviewDto {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
  timeLabel: string;
  author: {
    fullName: string;
    avatarUrl: string | null;
    country: string | null;
  };
}

interface ReviewsResponse {
  ok: boolean;
  reviews: ReviewDto[];
  stats: {
    average: number;
    count: number;
    distribution: Record<number, number>;
  };
  myReview: {
    id: string;
    rating: number;
    comment: string | null;
    createdAt: string;
  } | null;
  canReview: boolean;
}

/** Étoiles pleines/vides pour une note sur 5. */
function Stars({ value, className = "" }: { value: number; className?: string }) {
  return (
    <span className={`tracking-tight ${className}`} aria-label={`${value}/5`}>
      <span className="text-amber-400">{"★".repeat(value)}</span>
      <span className="text-neutral-700">{"★".repeat(Math.max(0, 5 - value))}</span>
    </span>
  );
}

export function CourseReviews({ courseSlug }: { courseSlug: string }) {
  const { isLoading: authLoading, isAuthenticated } = useAuth();

  const [data, setData] = useState<ReviewsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }, []);

  /** Charge avis + agrégats (setState après `await fetch` uniquement). */
  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/courses/${courseSlug}/reviews`, {
        credentials: "include",
      });
      const json = await res.json();
      if (json.ok) {
        setData({
          ...json,
          reviews: (json.reviews as Omit<ReviewDto, "timeLabel">[]).map(
            (r) => ({ ...r, timeLabel: relativeTime(r.createdAt) })
          ),
        } as ReviewsResponse);
      } else {
        setData(null);
      }
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [courseSlug]);

  // Chargement initial (fetch-on-mount)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  /** Ouvre le formulaire (pré-rempli si un avis existe déjà). */
  function openForm() {
    setRating(data?.myReview?.rating ?? 0);
    setComment(data?.myReview?.comment ?? "");
    setFormError(null);
    setFormOpen(true);
  }

  /** Dépose ou modifie mon avis. */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting || rating === 0) return;
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch(`/api/v1/courses/${courseSlug}/reviews`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating,
          comment: comment.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        setFormOpen(false);
        showToast(
          json.created
            ? "⭐ Merci pour ton avis !"
            : "✅ Avis mis à jour."
        );
        await load();
      } else {
        setFormError(json.error ?? "Impossible d'enregistrer l’avis");
      }
    } catch {
      setFormError("Erreur réseau. Réessaie plus tard.");
    } finally {
      setSubmitting(false);
    }
  }

  /** Supprime mon avis. */
  async function handleDelete() {
    if (deleting || !confirm("Supprimer ton avis définitivement ?")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/v1/courses/${courseSlug}/reviews`, {
        method: "DELETE",
        credentials: "include",
      });
      const json = await res.json();
      if (json.ok) {
        setFormOpen(false);
        showToast("Avis supprimé.");
        await load();
      } else {
        showToast(json.error ?? "Impossible de supprimer l’avis");
      }
    } catch {
      showToast("Erreur réseau. Réessaie plus tard.");
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <section className="mt-10 rounded-2xl border border-neutral-800 bg-neutral-950 p-6">
        <div className="flex items-center gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
          <span className="text-sm text-neutral-500">Chargement des avis…</span>
        </div>
      </section>
    );
  }

  const stats = data?.stats ?? { average: 0, count: 0, distribution: {} };
  const reviews = data?.reviews ?? [];
  const maxDist = Math.max(1, ...Object.values(stats.distribution));

  return (
    <section className="mt-10 rounded-2xl border border-neutral-800 bg-neutral-950 p-6">
      {toast && (
        <div className="mb-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5 text-sm font-semibold text-emerald-300">
          {toast}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-white">⭐ Avis des étudiants</h2>
        {data?.canReview && !formOpen && (
          <button
            onClick={openForm}
            className="rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-2 text-xs font-bold text-black transition hover:from-orange-400 hover:to-amber-400"
          >
            {data.myReview ? "✏️ Modifier mon avis" : "⭐ Laisser un avis"}
          </button>
        )}
      </div>

      {/* Agrégats : moyenne + distribution */}
      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <div className="flex items-center gap-4">
          <div className="text-5xl font-black text-white">
            {stats.average.toFixed(1)}
          </div>
          <div>
            <Stars value={Math.round(stats.average)} className="text-xl" />
            <div className="mt-1 text-xs text-neutral-500">
              {stats.count} avis vérifié{stats.count > 1 ? "s" : ""}
            </div>
          </div>
        </div>
        <div className="space-y-1">
          {[5, 4, 3, 2, 1].map((star) => {
            const n = stats.distribution[star] ?? 0;
            return (
              <div key={star} className="flex items-center gap-2 text-[11px]">
                <span className="w-6 shrink-0 text-neutral-400">{star}★</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-800">
                  <div
                    className="h-full rounded-full bg-amber-400"
                    style={{ width: `${(n / maxDist) * 100}%` }}
                  />
                </div>
                <span className="w-6 shrink-0 text-right text-neutral-500">
                  {n}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Formulaire de dépôt / modification */}
      {formOpen && (
        <form
          onSubmit={handleSubmit}
          className="mt-6 rounded-xl border border-orange-500/30 bg-black/40 p-5"
        >
          <div className="text-xs font-bold uppercase tracking-wider text-neutral-400">
            {data?.myReview ? "Modifier mon avis" : "Ton avis sur cette formation"}
          </div>

          <div className="mt-3 flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                className={`text-3xl transition ${
                  star <= rating
                    ? "text-amber-400"
                    : "text-neutral-700 hover:text-amber-400/60"
                }`}
                aria-label={`${star} étoile${star > 1 ? "s" : ""}`}
              >
                ★
              </button>
            ))}
            <span className="ml-2 text-xs text-neutral-500">
              {rating === 0
                ? "Choisis une note"
                : ["", "😞 Décevant", "😐 Moyen", "🙂 Bien", "😃 Très bien", "🤩 Excellent"][rating]}
            </span>
          </div>

          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="Raconte ton expérience : contenu, rythme, qualité… (optionnel)"
            className="mt-3 w-full resize-none rounded-xl border border-neutral-800 bg-black px-4 py-3 text-sm text-white placeholder-neutral-600 outline-none transition focus:border-orange-500"
          />

          {formError && (
            <p className="mt-3 rounded-lg bg-red-500/10 p-3 text-xs text-red-300">
              {formError}
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={submitting || rating === 0}
              className="rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-2.5 text-xs font-bold text-black transition hover:from-orange-400 hover:to-amber-400 disabled:opacity-50"
            >
              {submitting
                ? "⏳ Envoi…"
                : data?.myReview
                  ? "Mettre à jour"
                  : "Publier mon avis"}
            </button>
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="rounded-xl border border-neutral-700 px-5 py-2.5 text-xs font-semibold text-neutral-300 transition hover:border-neutral-500"
            >
              Annuler
            </button>
            {data?.myReview && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-xl border border-neutral-800 px-5 py-2.5 text-xs font-semibold text-neutral-500 transition hover:border-red-500/40 hover:text-red-400 disabled:opacity-50"
              >
                {deleting ? "…" : "🗑 Supprimer"}
              </button>
            )}
          </div>
        </form>
      )}

      {/* Incitations selon l'état de connexion */}
      {!authLoading && !isAuthenticated && (
        <p className="mt-5 rounded-xl bg-black/40 p-3 text-center text-xs text-neutral-400">
          <Link
            href="/auth/login"
            className="font-semibold text-orange-400 hover:text-orange-300"
          >
            Connecte-toi
          </Link>{" "}
          pour laisser un avis sur cette formation.
        </p>
      )}
      {isAuthenticated && data && !data.canReview && (
        <p className="mt-5 rounded-xl bg-black/40 p-3 text-center text-xs text-neutral-400">
          ✓ Avis vérifiés : seuls les étudiants inscrits à cette formation
          peuvent la noter.
        </p>
      )}

      {/* Liste des avis */}
      <div className="mt-6 space-y-4">
        {reviews.length === 0 ? (
          <p className="py-6 text-center text-sm text-neutral-500">
            Aucun avis pour le moment. Sois le premier à partager ton
            expérience ! 🌟
          </p>
        ) : (
          reviews.map((r) => (
            <div
              key={r.id}
              className="rounded-xl border border-neutral-800 bg-black/30 p-4"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-amber-500 text-sm">
                  👤
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-bold text-white">
                      {r.author.fullName}
                    </span>
                    <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-bold text-emerald-400">
                      ✓ Avis vérifié
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-[11px] text-neutral-500">
                    <Stars value={r.rating} className="text-xs" />
                    <span>·</span>
                    <span>{r.timeLabel}</span>
                    {r.author.country && (
                      <>
                        <span>·</span>
                        <span>{r.author.country}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              {r.comment && (
                <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-neutral-300">
                  {r.comment}
                </p>
              )}
            </div>
          ))
        )}
      </div>
    </section>
  );
}
