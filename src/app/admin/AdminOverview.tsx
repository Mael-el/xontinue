// ============================================================
// COMPOSANT CLIENT — ADMIN · VUE D'ENSEMBLE
// KPIs plateforme + revenus + satisfaction + mini-graphe des
// nouvelles inscriptions (14 jours).
// ============================================================

"use client";

import { useEffect, useState } from "react";
import { formatXof } from "@/lib/format";

interface Overview {
  users: {
    total: number;
    active: number;
    pending: number;
    suspended: number;
    students: number;
    instructors: number;
    companies: number;
  };
  courses: { published: number; draft: number };
  enrollments: { total: number; active: number; completed: number };
  payments: { succeeded: number; pending: number };
  revenueXof: number;
  applications: number;
  reviews: { total: number; average: number };
  lessonsCompleted: number;
  signups14d: { date: string; count: number }[];
}

export function AdminOverview() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/v1/admin/overview", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setData(d);
        else setError(d.error ?? "Erreur de chargement");
      })
      .catch(() => setError("Erreur réseau"));
  }, []);

  if (error) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-300">
        {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-xl border border-neutral-800 bg-neutral-950"
          />
        ))}
      </div>
    );
  }

  const tiles = [
    {
      icon: "👥",
      value: data.users.active,
      label: "Utilisateurs actifs",
      sub: `${data.users.pending} en attente · ${data.users.suspended} suspendus`,
    },
    { icon: "🎓", value: data.users.students, label: "Étudiants" },
    { icon: "🧑‍🏫", value: data.users.instructors, label: "Formateurs" },
    { icon: "🏢", value: data.users.companies, label: "Entreprises" },
    {
      icon: "📚",
      value: data.courses.published,
      label: "Formations publiées",
      sub: `${data.courses.draft} brouillons`,
    },
    {
      icon: "🎫",
      value: data.enrollments.active,
      label: "Inscriptions actives",
      sub: `${data.enrollments.completed} terminées`,
    },
    { icon: "✅", value: data.lessonsCompleted, label: "Leçons validées" },
    { icon: "💼", value: data.applications, label: "Candidatures" },
  ];

  const maxSignup = Math.max(...data.signups14d.map((d) => d.count), 1);

  return (
    <div className="space-y-6">
      {/* Tuiles KPI */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map((t) => (
          <div
            key={t.label}
            className="rounded-xl border border-neutral-800 bg-neutral-950 p-4"
          >
            <div className="flex items-center gap-2">
              <span className="text-xl">{t.icon}</span>
              <span className="text-xl font-black text-white">{t.value}</span>
            </div>
            <div className="mt-1 text-[11px] text-neutral-500">{t.label}</div>
            {t.sub && (
              <div className="mt-0.5 text-[10px] text-neutral-600">{t.sub}</div>
            )}
          </div>
        ))}
      </div>

      {/* Revenus · Satisfaction · Inscriptions 14j */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-neutral-950 p-5">
          <div className="text-2xl">💰</div>
          <div className="mt-1 text-2xl font-black text-emerald-400">
            {formatXof(data.revenueXof)}
          </div>
          <div className="text-xs text-neutral-400">Revenus encaissés</div>
          <div className="mt-2 text-[10px] text-neutral-500">
            {data.payments.succeeded} paiements confirmés ·{" "}
            {data.payments.pending} en attente
          </div>
        </div>

        <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-neutral-950 p-5">
          <div className="text-2xl">⭐</div>
          <div className="mt-1 text-2xl font-black text-amber-400">
            {data.reviews.average > 0 ? data.reviews.average : "—"} / 5
          </div>
          <div className="text-xs text-neutral-400">Satisfaction moyenne</div>
          <div className="mt-2 text-[10px] text-neutral-500">
            {data.reviews.total} avis vérifiés publiés
          </div>
        </div>

        <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-5">
          <div className="mb-3 flex items-baseline justify-between">
            <div>
              <div className="text-2xl font-black text-white">
                {data.signups14d.reduce((s, d) => s + d.count, 0)}
              </div>
              <div className="text-xs text-neutral-400">
                Nouveaux inscrits · 14 jours
              </div>
            </div>
            <span className="text-2xl">📈</span>
          </div>
          <div className="flex h-16 items-end gap-[3px]">
            {data.signups14d.map((d) => (
              <div
                key={d.date}
                className="flex-1 rounded-t bg-gradient-to-t from-orange-500 to-amber-400"
                style={{
                  height:
                    d.count > 0
                      ? `${Math.max((d.count / maxSignup) * 100, 10)}%`
                      : "2px",
                  opacity: d.count > 0 ? 1 : 0.25,
                }}
                title={`${new Date(d.date + "T00:00:00Z").toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} : ${d.count}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
