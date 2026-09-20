// ============================================================
// PAGE — ESPACE RECRUTEUR
// Création d'entreprise, publication d'offres, traitement
// des candidatures reçues (changement de statut + notification).
// ============================================================

"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth/context";
import {
  applicationStatusColor,
  applicationStatusLabel,
  formatXof,
  jobTypeLabel,
  relativeTime,
  type ApplicationStatus,
} from "@/lib/format";

// ------------------------------------------------------------
// Types alignés sur l'API /api/v1/recruiter
// ------------------------------------------------------------

interface Company {
  id: string;
  name: string;
  country: string | null;
  city: string | null;
  industry: string | null;
  logoUrl: string | null;
  isVerified: boolean | null;
}

interface CompanyState {
  hasCompany: boolean;
  company: Company | null;
  ownerName?: string | null;
  stats?: { jobsCount: number; applicationsCount: number; pendingCount: number };
}

interface RecruiterJob {
  id: string;
  slug: string;
  title: string;
  type: "full_time" | "part_time" | "freelance" | "internship" | "contract";
  location: string | null;
  isRemote: boolean;
  salaryMinXof: number | null;
  salaryMaxXof: number | null;
  applicationsCount: number;
  expiresAt: string | null;
  createdAt: string;
}

interface ReceivedApplication {
  id: string;
  status: ApplicationStatus;
  coverLetter: string | null;
  cvUrl: string | null;
  appliedAt: string;
  appliedLabel: string;
  job: { id: string; slug: string; title: string };
  candidate: {
    id: string;
    fullName: string;
    avatarUrl: string | null;
    country: string | null;
    city: string | null;
    xp: number;
  };
}

type Tab = "overview" | "jobs" | "applications" | "publish";

/** Statuts modifiables par le recruteur. */
const EDITABLE_STATUSES: ApplicationStatus[] = [
  "pending",
  "reviewed",
  "shortlisted",
  "interview",
  "accepted",
  "rejected",
];

export default function RecruiterPage() {
  const { isLoading: authLoading, isAuthenticated } = useAuth();

  const [tab, setTab] = useState<Tab>("overview");
  const [companyState, setCompanyState] = useState<CompanyState | null>(null);
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<RecruiterJob[] | null>(null);
  const [applications, setApplications] = useState<ReceivedApplication[] | null>(
    null
  );
  const [jobFilter, setJobFilter] = useState<string>("");
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }, []);

  /** Charge l'entreprise + stats (setState après fetch). */
  const loadCompany = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/recruiter/company", {
        credentials: "include",
      });
      const json = await res.json();
      if (json.ok) setCompanyState(json as CompanyState);
      else setCompanyState({ hasCompany: false, company: null });
    } catch {
      setCompanyState({ hasCompany: false, company: null });
    } finally {
      setLoading(false);
    }
  }, []);

  /** Charge les offres de l'entreprise. */
  const loadJobs = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/recruiter/jobs", {
        credentials: "include",
      });
      const json = await res.json();
      setJobs(json.ok ? (json.jobs as RecruiterJob[]) : []);
    } catch {
      setJobs([]);
    }
  }, []);

  /** Charge les candidatures reçues (filtre jobId optionnel). */
  const loadApplications = useCallback(async (jobId?: string) => {
    try {
      const url = jobId
        ? `/api/v1/recruiter/applications?jobId=${jobId}`
        : "/api/v1/recruiter/applications";
      const res = await fetch(url, { credentials: "include" });
      const json = await res.json();
      setApplications(
        json.ok
          ? (json.applications as Omit<ReceivedApplication, "appliedLabel">[]).map(
              (a) => ({ ...a, appliedLabel: relativeTime(a.appliedAt) })
            )
          : []
      );
    } catch {
      setApplications([]);
    }
  }, []);

  // Chargement initial
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isAuthenticated) void loadCompany();
  }, [isAuthenticated, loadCompany]);

  // Offres + candidatures dès que l'entreprise existe
  const hasCompany = Boolean(companyState?.hasCompany);
  useEffect(() => {
    if (hasCompany) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void Promise.all([loadJobs(), loadApplications()]);
    }
  }, [hasCompany, loadJobs, loadApplications]);

  /** Filtre les candidatures par offre. */
  function handleJobFilter(jobId: string) {
    setJobFilter(jobId);
    void loadApplications(jobId || undefined);
  }

  /** Change le statut d'une candidature reçue. */
  async function updateStatus(id: string, status: ApplicationStatus) {
    const previous = applications;
    setApplications(
      (prev) =>
        prev?.map((a) => (a.id === id ? { ...a, status } : a)) ?? prev
    );
    try {
      const res = await fetch(`/api/v1/recruiter/applications/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (json.ok) {
        showToast(`✅ Statut mis à jour : ${applicationStatusLabel(status)}`);
        void loadCompany(); // rafraîchit les compteurs
      } else {
        setApplications(previous);
        showToast(json.error ?? "Impossible de changer le statut");
      }
    } catch {
      setApplications(previous);
      showToast("Erreur réseau. Réessaie plus tard.");
    }
  }

  // ----------------------------------------------------------
  // États de chargement / connexion
  // ----------------------------------------------------------

  if (authLoading || (isAuthenticated && loading)) {
    return (
      <div className="mx-auto flex max-w-4xl flex-col items-center px-4 py-24">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
        <p className="mt-4 text-sm text-neutral-500">
          Chargement de l’espace recruteur…
        </p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-md px-4 py-24">
        <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-8 text-center">
          <div className="text-5xl">🔐</div>
          <h1 className="mt-4 text-xl font-black text-white">
            Connexion requise
          </h1>
          <p className="mt-2 text-sm text-neutral-400">
            Connecte-toi pour accéder à l’espace recruteur.
          </p>
          <Link
            href="/auth/login"
            className="mt-6 inline-block rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-3 text-sm font-bold text-black transition hover:from-orange-400 hover:to-amber-400"
          >
            Se connecter
          </Link>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------------
  // Pas d'entreprise → formulaire de création
  // ----------------------------------------------------------

  if (!companyState?.hasCompany || !companyState.company) {
    return (
      <CreateCompanyForm
        onCreated={async () => {
          showToast("🎉 Entreprise créée ! Publie ta première offre.");
          await loadCompany();
          setTab("publish");
        }}
      />
    );
  }

  const { company, stats } = companyState;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      {toast && (
        <div className="fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-xl border border-emerald-500/40 bg-neutral-900 px-5 py-3 text-sm font-semibold text-emerald-300 shadow-2xl">
          {toast}
        </div>
      )}

      {/* En-tête entreprise */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 text-3xl">
          {company.logoUrl ?? "🏢"}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-2xl font-black text-white">
              {company.name}
            </h1>
            {company.isVerified ? (
              <span className="rounded-full bg-sky-500/20 px-2 py-0.5 text-[10px] font-bold text-sky-400">
                ✓ Vérifié
              </span>
            ) : (
              <span className="rounded-full bg-neutral-800 px-2 py-0.5 text-[10px] font-bold text-neutral-400">
                En attente de vérification
              </span>
            )}
          </div>
          <p className="text-sm text-neutral-500">
            {[company.city, company.country].filter(Boolean).join(", ")}
            {company.industry ? ` · ${company.industry}` : ""}
          </p>
        </div>
        <button
          onClick={() => setTab("publish")}
          className="rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-2.5 text-sm font-bold text-black shadow-lg shadow-orange-500/30 transition hover:from-orange-400 hover:to-amber-400"
        >
          + Publier une offre
        </button>
      </div>

      {/* Statistiques */}
      <div className="mt-6 grid grid-cols-3 gap-3">
        <StatCard icon="📢" label="Offres publiées" value={stats?.jobsCount ?? 0} />
        <StatCard
          icon="📨"
          label="Candidatures reçues"
          value={stats?.applicationsCount ?? 0}
        />
        <StatCard
          icon="⏳"
          label="En attente de revue"
          value={stats?.pendingCount ?? 0}
        />
      </div>

      {/* Onglets */}
      <div className="mt-8 flex gap-1 overflow-x-auto rounded-xl border border-neutral-800 bg-neutral-950 p-1">
        {(
          [
            ["overview", "📊 Aperçu"],
            ["jobs", `📢 Offres (${jobs?.length ?? "…"})`],
            ["applications", `📨 Candidatures (${applications?.length ?? "…"})`],
            ["publish", "➕ Publier"],
          ] as Array<[Tab, string]>
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold transition ${
              tab === key
                ? "bg-gradient-to-r from-orange-500 to-amber-500 text-black"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "overview" && (
          <OverviewTab
            applications={applications}
            onSeeAll={() => setTab("applications")}
          />
        )}

        {tab === "jobs" && (
          <JobsTab
            jobs={jobs}
            onFilterApplications={(jobId) => {
              setTab("applications");
              handleJobFilter(jobId);
            }}
          />
        )}

        {tab === "applications" && (
          <ApplicationsTab
            applications={applications}
            jobs={jobs}
            jobFilter={jobFilter}
            onFilter={handleJobFilter}
            onUpdateStatus={updateStatus}
          />
        )}

        {tab === "publish" && (
          <PublishJobForm
            onPublished={async (slug) => {
              showToast("🎉 Offre publiée ! Elle est visible sur /jobs.");
              await Promise.all([loadJobs(), loadCompany()]);
              setTab("jobs");
              void slug;
            }}
          />
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// Carte statistique
// ------------------------------------------------------------

function StatCard({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <span className="text-xl sm:text-2xl">{icon}</span>
        <span className="text-xl font-black text-white sm:text-2xl">
          {value}
        </span>
      </div>
      <div className="mt-1 text-[11px] text-neutral-500 sm:text-xs">{label}</div>
    </div>
  );
}

// ------------------------------------------------------------
// Onglet Aperçu — dernières candidatures
// ------------------------------------------------------------

function OverviewTab({
  applications,
  onSeeAll,
}: {
  applications: ReceivedApplication[] | null;
  onSeeAll: () => void;
}) {
  const recent = applications?.slice(0, 5) ?? [];
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">
          📨 Dernières candidatures
        </h2>
        <button
          onClick={onSeeAll}
          className="text-xs font-semibold text-orange-400 hover:text-orange-300"
        >
          Tout voir →
        </button>
      </div>
      {recent.length === 0 ? (
        <p className="mt-6 py-8 text-center text-sm text-neutral-500">
          Aucune candidature pour le moment. Partage tes offres pour attirer
          les talents ! 🌍
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {recent.map((a) => (
            <div
              key={a.id}
              className="flex flex-wrap items-center gap-3 rounded-xl bg-black/40 p-3"
            >
              <span className="text-xl">👤</span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold text-white">
                  {a.candidate.fullName}
                </div>
                <div className="truncate text-xs text-neutral-500">
                  {a.job.title} · {a.appliedLabel}
                </div>
              </div>
              <span
                className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${applicationStatusColor(a.status)}`}
              >
                {applicationStatusLabel(a.status)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------
// Onglet Offres
// ------------------------------------------------------------

function JobsTab({
  jobs,
  onFilterApplications,
}: {
  jobs: RecruiterJob[] | null;
  onFilterApplications: (jobId: string) => void;
}) {
  if (!jobs) {
    return <p className="py-10 text-center text-sm text-neutral-500">Chargement…</p>;
  }
  if (jobs.length === 0) {
    return (
      <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-12 text-center">
        <div className="text-4xl">📢</div>
        <p className="mt-3 text-sm text-neutral-400">
          Aucune offre publiée. Utilise l’onglet « Publier » pour ta première
          annonce.
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {jobs.map((j) => (
        <div
          key={j.id}
          className="flex flex-wrap items-center gap-4 rounded-2xl border border-neutral-800 bg-neutral-950 p-4"
        >
          <div className="min-w-0 flex-1">
            <Link
              href={`/jobs/${j.slug}`}
              className="truncate font-bold text-white hover:text-orange-400"
            >
              {j.title}
            </Link>
            <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-neutral-500">
              <span className="rounded-full bg-neutral-800 px-2 py-0.5">
                {jobTypeLabel(j.type)}
              </span>
              {j.location && <span>📍 {j.location}</span>}
              {j.isRemote && <span>🌍 Remote</span>}
              {j.salaryMinXof != null && j.salaryMaxXof != null && (
                <span>
                  💰 {formatXof(j.salaryMinXof)} — {formatXof(j.salaryMaxXof)}
                </span>
              )}
              {j.expiresAt && (
                <span>
                  ⌛ jusqu’au{" "}
                  {new Date(j.expiresAt).toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "short",
                  })}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={() => onFilterApplications(j.id)}
            className="rounded-xl border border-neutral-700 px-4 py-2 text-xs font-bold text-neutral-200 transition hover:border-orange-500/50 hover:text-orange-300"
          >
            📨 {j.applicationsCount} candidature
            {j.applicationsCount > 1 ? "s" : ""}
          </button>
        </div>
      ))}
    </div>
  );
}

// ------------------------------------------------------------
// Onglet Candidatures — traitement + changement de statut
// ------------------------------------------------------------

function ApplicationsTab({
  applications,
  jobs,
  jobFilter,
  onFilter,
  onUpdateStatus,
}: {
  applications: ReceivedApplication[] | null;
  jobs: RecruiterJob[] | null;
  jobFilter: string;
  onFilter: (jobId: string) => void;
  onUpdateStatus: (id: string, status: ApplicationStatus) => void;
}) {
  return (
    <div>
      {/* Filtre par offre */}
      <div className="mb-4 flex items-center gap-3">
        <label className="text-xs font-bold uppercase tracking-wider text-neutral-500">
          Offre :
        </label>
        <select
          value={jobFilter}
          onChange={(e) => onFilter(e.target.value)}
          className="rounded-lg border border-neutral-800 bg-black px-3 py-2 text-sm text-white outline-none focus:border-orange-500"
        >
          <option value="">Toutes les offres</option>
          {jobs?.map((j) => (
            <option key={j.id} value={j.id}>
              {j.title}
            </option>
          ))}
        </select>
      </div>

      {!applications ? (
        <p className="py-10 text-center text-sm text-neutral-500">Chargement…</p>
      ) : applications.length === 0 ? (
        <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-12 text-center">
          <div className="text-4xl">📭</div>
          <p className="mt-3 text-sm text-neutral-400">
            Aucune candidature {jobFilter ? "sur cette offre" : "reçue"}.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {applications.map((a) => (
            <div
              key={a.id}
              className="rounded-2xl border border-neutral-800 bg-neutral-950 p-5"
            >
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-amber-500 text-lg">
                  👤
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-bold text-white">
                    {a.candidate.fullName}
                  </div>
                  <div className="text-xs text-neutral-500">
                    {[a.candidate.city, a.candidate.country]
                      .filter(Boolean)
                      .join(", ") || "—"}{" "}
                    · ⚡ {a.candidate.xp} XP · {a.appliedLabel}
                  </div>
                </div>
                <span
                  className={`rounded-full border px-3 py-1 text-[11px] font-bold ${applicationStatusColor(a.status)}`}
                >
                  {applicationStatusLabel(a.status)}
                </span>
              </div>

              <div className="mt-3 text-xs text-neutral-400">
                Candidature pour{" "}
                <Link
                  href={`/jobs/${a.job.slug}`}
                  className="font-semibold text-orange-400 hover:text-orange-300"
                >
                  {a.job.title}
                </Link>
              </div>

              {a.coverLetter && (
                <details className="mt-3 rounded-xl bg-black/40 p-3">
                  <summary className="cursor-pointer text-xs font-semibold text-neutral-300">
                    📄 Lettre de motivation
                  </summary>
                  <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-neutral-400">
                    {a.coverLetter}
                  </p>
                </details>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-3">
                {a.cvUrl && (
                  <a
                    href={a.cvUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border border-neutral-700 px-3 py-2 text-xs font-semibold text-neutral-200 transition hover:border-sky-500/50 hover:text-sky-300"
                  >
                    📎 Voir le CV
                  </a>
                )}
                <div className="flex items-center gap-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                    Statut :
                  </label>
                  <select
                    value={a.status}
                    onChange={(e) =>
                      onUpdateStatus(a.id, e.target.value as ApplicationStatus)
                    }
                    disabled={a.status === "withdrawn"}
                    className="rounded-lg border border-neutral-800 bg-black px-3 py-2 text-xs font-semibold text-white outline-none focus:border-orange-500 disabled:opacity-50"
                  >
                    {a.status === "withdrawn" ? (
                      <option value="withdrawn">Retirée</option>
                    ) : (
                      EDITABLE_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {applicationStatusLabel(s)}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------
// Formulaire de création d'entreprise
// ------------------------------------------------------------

function CreateCompanyForm({ onCreated }: { onCreated: () => Promise<void> }) {
  const [name, setName] = useState("");
  const [country, setCountry] = useState("Bénin");
  const [city, setCity] = useState("");
  const [industry, setIndustry] = useState("");
  const [logoEmoji, setLogoEmoji] = useState("🏢");
  const [website, setWebsite] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/recruiter/company", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          country: country.trim() || "Bénin",
          city: city.trim() || undefined,
          industry: industry.trim() || undefined,
          logoEmoji: logoEmoji.trim() || undefined,
          website: website.trim() || undefined,
          description: description.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        await onCreated();
      } else {
        setError(json.error ?? "Impossible de créer l’entreprise");
      }
    } catch {
      setError("Erreur réseau. Réessaie plus tard.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <div className="mb-8 text-center">
        <div className="text-xs font-bold uppercase tracking-[0.2em] text-orange-500">
          Espace recruteur
        </div>
        <h1 className="mt-2 text-3xl font-black text-white">
          🏢 Crée ton entreprise
        </h1>
        <p className="mt-3 text-neutral-400">
          Une minute pour accéder à +12 000 talents certifiés AfricaSkills.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6 sm:p-8"
      >
        <FormField label="Nom de l’entreprise *">
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex : Wave, MTN, MaStartup…"
            className={inputClass}
          />
        </FormField>

        <div className="mt-4 grid grid-cols-2 gap-4">
          <FormField label="Pays">
            <input
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className={inputClass}
            />
          </FormField>
          <FormField label="Ville">
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Cotonou"
              className={inputClass}
            />
          </FormField>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4">
          <FormField label="Secteur">
            <input
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              placeholder="Fintech, E-commerce…"
              className={inputClass}
            />
          </FormField>
          <FormField label="Logo (emoji)">
            <input
              value={logoEmoji}
              onChange={(e) => setLogoEmoji(e.target.value)}
              maxLength={4}
              className={inputClass}
            />
          </FormField>
        </div>

        <div className="mt-4">
          <FormField label="Site web (optionnel)">
            <input
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://…"
              className={inputClass}
            />
          </FormField>
        </div>

        <div className="mt-4">
          <FormField label="Description (optionnel)">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Que fait votre entreprise ?"
              className={`${inputClass} resize-none`}
            />
          </FormField>
        </div>

        {error && (
          <p className="mt-4 rounded-xl bg-red-500/10 p-3 text-sm text-red-300">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || name.trim().length < 2}
          className="mt-6 w-full rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-3.5 text-sm font-bold text-black shadow-lg shadow-orange-500/30 transition hover:from-orange-400 hover:to-amber-400 disabled:opacity-50"
        >
          {loading ? "⏳ Création…" : "Créer mon entreprise 🚀"}
        </button>
      </form>
    </div>
  );
}

// ------------------------------------------------------------
// Formulaire de publication d'offre
// ------------------------------------------------------------

function PublishJobForm({
  onPublished,
}: {
  onPublished: (slug: string) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<RecruiterJob["type"]>("full_time");
  const [location, setLocation] = useState("");
  const [isRemote, setIsRemote] = useState(false);
  const [salaryMin, setSalaryMin] = useState("");
  const [salaryMax, setSalaryMax] = useState("");
  const [badges, setBadges] = useState("");
  const [description, setDescription] = useState("");
  const [expiresInDays, setExpiresInDays] = useState(60);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/recruiter/jobs", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          type,
          location: location.trim() || undefined,
          isRemote,
          salaryMinXof: salaryMin ? Number(salaryMin) : undefined,
          salaryMaxXof: salaryMax ? Number(salaryMax) : undefined,
          requiredBadges: badges
            .split(",")
            .map((b) => b.trim())
            .filter(Boolean),
          description: description.trim() || undefined,
          expiresInDays,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        await onPublished(json.job.slug);
      } else {
        setError(json.error ?? "Impossible de publier l’offre");
      }
    } catch {
      setError("Erreur réseau. Réessaie plus tard.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto max-w-3xl rounded-2xl border border-neutral-800 bg-neutral-950 p-6 sm:p-8"
    >
      <h2 className="text-lg font-bold text-white">➕ Nouvelle offre</h2>

      <div className="mt-5">
        <FormField label="Intitulé du poste *">
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex : Développeur React Senior"
            className={inputClass}
          />
        </FormField>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <FormField label="Type de contrat">
          <select
            value={type}
            onChange={(e) => setType(e.target.value as RecruiterJob["type"])}
            className={inputClass}
          >
            <option value="full_time">Temps plein</option>
            <option value="part_time">Temps partiel</option>
            <option value="freelance">Freelance</option>
            <option value="internship">Stage</option>
            <option value="contract">CDD / Mission</option>
          </select>
        </FormField>
        <FormField label="Lieu">
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Cotonou, Bénin"
            className={inputClass}
          />
        </FormField>
      </div>

      <label className="mt-4 flex cursor-pointer items-center gap-3 text-sm text-neutral-300">
        <input
          type="checkbox"
          checked={isRemote}
          onChange={(e) => setIsRemote(e.target.checked)}
          className="h-4 w-4 accent-orange-500"
        />
        🌍 Poste ouvert au remote
      </label>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <FormField label="Salaire min annuel (FCFA)">
          <input
            type="number"
            min={0}
            value={salaryMin}
            onChange={(e) => setSalaryMin(e.target.value)}
            placeholder="800000"
            className={inputClass}
          />
        </FormField>
        <FormField label="Salaire max annuel (FCFA)">
          <input
            type="number"
            min={0}
            value={salaryMax}
            onChange={(e) => setSalaryMax(e.target.value)}
            placeholder="1500000"
            className={inputClass}
          />
        </FormField>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <FormField label="Badges requis (séparés par des virgules)">
          <input
            value={badges}
            onChange={(e) => setBadges(e.target.value)}
            placeholder="fullstack-hero, data-analyst"
            className={inputClass}
          />
        </FormField>
        <FormField label="Validité (jours)">
          <input
            type="number"
            min={1}
            max={180}
            value={expiresInDays}
            onChange={(e) => setExpiresInDays(Number(e.target.value) || 60)}
            className={inputClass}
          />
        </FormField>
      </div>

      <div className="mt-4">
        <FormField label="Description du poste">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            placeholder="Missions, stack, profil recherché…"
            className={`${inputClass} resize-none`}
          />
        </FormField>
      </div>

      {error && (
        <p className="mt-4 rounded-xl bg-red-500/10 p-3 text-sm text-red-300">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading || title.trim().length < 3}
        className="mt-6 w-full rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-3.5 text-sm font-bold text-black shadow-lg shadow-orange-500/30 transition hover:from-orange-400 hover:to-amber-400 disabled:opacity-50"
      >
        {loading ? "⏳ Publication…" : "Publier l’offre 📢"}
      </button>
    </form>
  );
}

// ------------------------------------------------------------
// Petits utilitaires de formulaire
// ------------------------------------------------------------

const inputClass =
  "w-full rounded-xl border border-neutral-800 bg-black px-4 py-2.5 text-sm text-white placeholder-neutral-600 outline-none transition focus:border-orange-500";

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-neutral-500">
        {label}
      </span>
      {children}
    </label>
  );
}
