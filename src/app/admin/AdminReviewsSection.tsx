// ============================================================
// COMPOSANT CLIENT — ADMIN · MODÉRATION DES AVIS
// Liste des derniers avis + suppression (la note du cours est
// recalculée automatiquement côté serveur).
// ============================================================

"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

interface AdminReview {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  user: { fullName: string };
  course: { slug: string; title: string };
}

export function AdminReviewsSection() {
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(message: string) {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }

  useEffect(() => {
    fetch("/api/v1/admin/reviews", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setReviews(d.reviews);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  async function removeReview(review: AdminReview) {
    const message = review.comment
      ? review.comment.slice(0, 80) + (review.comment.length > 80 ? "…" : "")
      : "(sans commentaire)";
    if (
      !window.confirm(
        `Supprimer l'avis de ${review.user.fullName} sur « ${review.course.title} » ?\n\n« ${message} »`
      )
    ) {
      return;
    }
    try {
      const res = await fetch(`/api/v1/admin/reviews/${review.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        showToast(data.error ?? "Suppression impossible");
        return;
      }
      setReviews((prev) => prev.filter((r) => r.id !== review.id));
      showToast("🗑️ Avis supprimé — note du cours recalculée");
    } catch {
      showToast("Erreur réseau");
    }
  }

  return (
    <section className="mt-10">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">
          ⭐ Modération des avis{" "}
          <span className="text-sm font-normal text-neutral-500">
            (30 plus récents)
          </span>
        </h2>
        {toast && (
          <span className="rounded-lg bg-neutral-900 px-3 py-2 text-xs text-emerald-300">
            {toast}
          </span>
        )}
      </div>

      {!loaded ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-xl border border-neutral-800 bg-neutral-950"
            />
          ))}
        </div>
      ) : reviews.length === 0 ? (
        <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-8 text-center text-sm text-neutral-500">
          Aucun avis publié pour le moment.
        </div>
      ) : (
        <div className="space-y-2">
          {reviews.map((r) => (
            <div
              key={r.id}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-neutral-800 bg-neutral-950 px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-white">
                    {r.user.fullName}
                  </span>
                  <span className="text-xs leading-none">
                    <span className="text-amber-400">
                      {"★".repeat(r.rating)}
                    </span>
                    <span className="text-neutral-700">
                      {"★".repeat(5 - r.rating)}
                    </span>
                  </span>
                  <span className="text-[10px] text-neutral-600">sur</span>
                  <Link
                    href={`/courses/${r.course.slug}`}
                    className="truncate text-xs font-semibold text-orange-400 hover:text-orange-300"
                  >
                    {r.course.title}
                  </Link>
                </div>
                {r.comment && (
                  <p className="mt-1 line-clamp-1 text-xs text-neutral-400">
                    {r.comment}
                  </p>
                )}
              </div>
              <span className="text-[10px] text-neutral-600">
                {new Date(r.createdAt).toLocaleDateString("fr-FR")}
              </span>
              <button
                onClick={() => removeReview(r)}
                className="rounded-lg border border-red-500/30 px-3 py-1.5 text-xs font-bold text-red-400 transition hover:bg-red-500/10"
              >
                🗑️ Supprimer
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
