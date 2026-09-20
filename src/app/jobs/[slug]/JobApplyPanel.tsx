// ============================================================
// COMPOSANT CLIENT — PANNEAU DE CANDIDATURE À UNE OFFRE
// Gère : connexion, statut de candidature, formulaire, retrait.
// ============================================================

"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth/context";
import {
  applicationStatusColor,
  applicationStatusLabel,
  type ApplicationStatus,
} from "@/lib/format";

interface Props {
  jobId: string;
  jobTitle: string;
  /** false si l'offre est expirée */
  isOpen: boolean;
}

interface ApplicationDto {
  id: string;
  status: ApplicationStatus;
  coverLetter: string | null;
  cvUrl: string | null;
  appliedAt: string;
}

export function JobApplyPanel({ jobId, jobTitle, isOpen }: Props) {
  const { isLoading: authLoading, isAuthenticated } = useAuth();

  const [application, setApplication] = useState<ApplicationDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [coverLetter, setCoverLetter] = useState("");
  const [cvUrl, setCvUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Message éphémère de feedback. */
  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }, []);

  /**
   * Charge le statut de candidature (setState uniquement après
   * `await fetch` — pattern fetch-on-mount).
   */
  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/jobs/${jobId}/apply`, {
        credentials: "include",
      });
      const json = await res.json();
      if (json.ok && json.application) {
        setApplication(json.application as ApplicationDto);
      } else {
        setApplication(null);
      }
    } catch {
      setApplication(null);
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isAuthenticated) void load();
  }, [isAuthenticated, load]);

  /** Envoie la candidature. */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch(`/api/v1/jobs/${jobId}/apply`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          coverLetter: coverLetter.trim() || undefined,
          cvUrl: cvUrl.trim() || undefined,
        }),
      });
      const json = await res.json();

      if (json.ok) {
        setApplication({
          id: json.application.id,
          status: json.application.status,
          coverLetter: json.application.coverLetter,
          cvUrl: json.application.cvUrl,
          appliedAt: json.application.createdAt,
        });
        setFormOpen(false);
        showToast("🎉 Candidature envoyée ! Bonne chance.");
        return;
      }

      if (res.status === 409 && json.application) {
        // Déjà candidaté → on affiche l'état existant
        setApplication({
          id: json.application.id,
          status: json.application.status,
          coverLetter: null,
          cvUrl: null,
          appliedAt: json.application.appliedAt,
        });
        setFormOpen(false);
        return;
      }

      setFormError(json.error ?? "Impossible d'envoyer la candidature");
    } catch {
      setFormError("Erreur réseau. Réessaie plus tard.");
    } finally {
      setSubmitting(false);
    }
  }

  /** Retire la candidature (restaure la possibilité de postuler). */
  async function handleWithdraw() {
    if (!application || withdrawing) return;
    if (!confirm("Retirer ta candidature ? Tu pourras postuler à nouveau."))
      return;
    setWithdrawing(true);
    try {
      const res = await fetch(`/api/v1/jobs/applications/${application.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const json = await res.json();
      if (json.ok) {
        // On garde la lettre pour pré-remplir un éventuel nouveau dépôt
        setApplication({
          ...application,
          status: "withdrawn",
        });
        showToast("Candidature retirée.");
      } else {
        showToast(json.error ?? "Impossible de retirer la candidature");
      }
    } catch {
      showToast("Erreur réseau. Réessaie plus tard.");
    } finally {
      setWithdrawing(false);
    }
  }

  /** Ouvre le formulaire, pré-rempli avec l'ancienne lettre si retirée. */
  function openForm() {
    setCoverLetter(application?.coverLetter ?? "");
    setCvUrl(application?.cvUrl ?? "");
    setFormError(null);
    setFormOpen(true);
  }

  // ----------------------------------------------------------
  // États particuliers
  // ----------------------------------------------------------

  if (authLoading || (isAuthenticated && loading)) {
    return (
      <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6">
        <div className="flex items-center gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
          <span className="text-sm text-neutral-500">Chargement…</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6 text-center">
        <div className="text-4xl">🔐</div>
        <p className="mt-3 text-sm text-neutral-400">
          Connecte-toi pour postuler à cette offre.
        </p>
        <Link
          href="/auth/login"
          className="mt-4 block rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-3 text-sm font-bold text-black transition hover:from-orange-400 hover:to-amber-400"
        >
          Se connecter
        </Link>
        <Link
          href="/auth/register"
          className="mt-2 block text-xs text-neutral-500 underline underline-offset-2 hover:text-white"
        >
          Créer un compte gratuit
        </Link>
      </div>
    );
  }

  if (!isOpen) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-6 text-center">
        <div className="text-4xl">⌛</div>
        <div className="mt-2 font-bold text-red-300">Offre expirée</div>
        <p className="mt-1 text-xs text-neutral-500">
          Cette offre n’accepte plus de candidatures.
        </p>
        <Link
          href="/jobs"
          className="mt-4 inline-block text-xs font-semibold text-orange-400 hover:text-orange-300"
        >
          Voir les autres offres →
        </Link>
      </div>
    );
  }

  // ----------------------------------------------------------
  // Candidature active (non retirée)
  // ----------------------------------------------------------

  if (application && application.status !== "withdrawn") {
    return (
      <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-transparent p-6">
        <div className="text-xs font-bold uppercase tracking-wider text-emerald-400">
          Ma candidature
        </div>
        <div className="mt-3 flex items-center justify-between gap-2">
          <span
            className={`rounded-full border px-3 py-1 text-xs font-bold ${applicationStatusColor(application.status)}`}
          >
            {applicationStatusLabel(application.status)}
          </span>
          <span className="text-[11px] text-neutral-500">
            {new Date(application.appliedAt).toLocaleDateString("fr-FR", {
              day: "numeric",
              month: "short",
            })}
          </span>
        </div>
        {application.coverLetter && (
          <p className="mt-4 line-clamp-4 rounded-lg bg-black/40 p-3 text-xs italic text-neutral-400">
            « {application.coverLetter} »
          </p>
        )}
        <p className="mt-4 text-xs text-neutral-500">
          L’entreprise te contactera directement si ton profil est retenu.
          Suis l’évolution depuis ton tableau de bord.
        </p>
        <div className="mt-4 flex gap-2">
          <Link
            href="/dashboard"
            className="flex-1 rounded-lg border border-neutral-700 px-3 py-2.5 text-center text-xs font-bold text-neutral-200 transition hover:border-neutral-500"
          >
            📊 Suivre
          </Link>
          <button
            onClick={handleWithdraw}
            disabled={withdrawing}
            className="rounded-lg border border-neutral-800 px-3 py-2.5 text-xs font-semibold text-neutral-500 transition hover:border-red-500/40 hover:text-red-400 disabled:opacity-50"
          >
            {withdrawing ? "…" : "Retirer"}
          </button>
        </div>
        {toast && (
          <p className="mt-3 rounded-lg bg-neutral-900 p-2 text-center text-xs text-neutral-300">
            {toast}
          </p>
        )}
      </div>
    );
  }

  // ----------------------------------------------------------
  // Formulaire ou bouton "Postuler"
  // ----------------------------------------------------------

  return (
    <div className="rounded-2xl border border-neutral-800 bg-gradient-to-b from-neutral-900 to-neutral-950 p-6 shadow-xl">
      {application?.status === "withdrawn" && (
        <p className="mb-3 rounded-lg bg-neutral-800/60 p-2.5 text-[11px] text-neutral-400">
          Tu avais retiré ta candidature — tu peux postuler à nouveau, ta
          lettre a été conservée.
        </p>
      )}

      {!formOpen ? (
        <>
          <div className="text-xs font-bold uppercase tracking-wider text-neutral-500">
            Intéressé·e ?
          </div>
          <button
            onClick={openForm}
            className="mt-3 w-full rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-3.5 text-sm font-bold text-black shadow-lg shadow-orange-500/30 transition hover:from-orange-400 hover:to-amber-400"
          >
            Postuler à cette offre →
          </button>
          <p className="mt-3 text-center text-[11px] text-neutral-500">
            📄 Lettre de motivation conseillée · CV en lien optionnel
          </p>
        </>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="text-xs font-bold uppercase tracking-wider text-neutral-500">
            Ma candidature
          </div>
          <div className="mt-1 truncate text-sm font-semibold text-white">
            {jobTitle}
          </div>

          <label className="mt-4 block text-xs font-bold uppercase tracking-wider text-neutral-500">
            Lettre de motivation
          </label>
          <textarea
            value={coverLetter}
            onChange={(e) => setCoverLetter(e.target.value)}
            rows={6}
            maxLength={5000}
            placeholder="Présente-toi en quelques lignes : ton parcours, tes badges AfricaSkills, ta motivation…"
            className="mt-2 w-full resize-none rounded-xl border border-neutral-800 bg-black px-4 py-3 text-sm text-white placeholder-neutral-600 outline-none transition focus:border-orange-500"
          />
          <div className="mt-1 text-right text-[10px] text-neutral-600">
            {coverLetter.length}/5000
          </div>

          <label className="mt-2 block text-xs font-bold uppercase tracking-wider text-neutral-500">
            Lien vers ton CV (optionnel)
          </label>
          <input
            type="url"
            value={cvUrl}
            onChange={(e) => setCvUrl(e.target.value)}
            placeholder="https://… (Google Drive, LinkedIn, portfolio)"
            className="mt-2 w-full rounded-xl border border-neutral-800 bg-black px-4 py-3 text-sm text-white placeholder-neutral-600 outline-none transition focus:border-orange-500"
          />

          {formError && (
            <p className="mt-3 rounded-lg bg-red-500/10 p-3 text-xs text-red-300">
              {formError}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="mt-4 w-full rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-3.5 text-sm font-bold text-black shadow-lg shadow-orange-500/30 transition hover:from-orange-400 hover:to-amber-400 disabled:opacity-50"
          >
            {submitting ? "⏳ Envoi…" : "Envoyer ma candidature 🚀"}
          </button>
          <button
            type="button"
            onClick={() => setFormOpen(false)}
            className="mt-2 w-full text-center text-xs text-neutral-500 underline underline-offset-2 hover:text-white"
          >
            Annuler
          </button>
        </form>
      )}

      {toast && (
        <p className="mt-3 rounded-lg bg-neutral-900 p-2 text-center text-xs text-emerald-300">
          {toast}
        </p>
      )}
    </div>
  );
}
