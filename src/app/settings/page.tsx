// ============================================================
// PAGE — RÉGLAGES · NOTIFICATIONS
// Interrupteurs par catégorie, sauvegarde immédiate (PATCH),
// rappel que les messages système sont toujours livrés.
// ============================================================

"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth/context";

interface Prefs {
  learning: boolean;
  applications: boolean;
  payments: boolean;
}

const CATEGORIES: {
  key: keyof Prefs;
  icon: string;
  title: string;
  description: string;
}[] = [
  {
    key: "learning",
    icon: "🎓",
    title: "Apprentissage",
    description:
      "Badges gagnés, formations terminées, inscriptions confirmées et rappels de progression.",
  },
  {
    key: "applications",
    icon: "💼",
    title: "Candidatures",
    description:
      "Changements de statut de tes candidatures (vue, entretien, acceptée, refusée).",
  },
  {
    key: "payments",
    icon: "💳",
    title: "Paiements",
    description:
      "Confirmations et échecs de paiement Mobile Money pour les formations payantes.",
  },
];

export default function SettingsPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(message: string) {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  }

  useEffect(() => {
    if (!isAuthenticated) return;
    fetch("/api/v1/me/notification-prefs", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setPrefs(d.prefs);
      })
      .catch(() => undefined);
  }, [isAuthenticated]);

  async function toggle(key: keyof Prefs) {
    if (!prefs || savingKey) return;
    const next = !prefs[key];
    // Mise à jour optimiste
    setPrefs({ ...prefs, [key]: next });
    setSavingKey(key);
    try {
      const res = await fetch("/api/v1/me/notification-prefs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ [key]: next }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setPrefs({ ...prefs }); // retour arrière
        showToast(data.error ?? "Enregistrement impossible");
        return;
      }
      setPrefs(data.prefs);
      showToast("✅ Préférences enregistrées");
    } catch {
      setPrefs({ ...prefs });
      showToast("Erreur réseau");
    } finally {
      setSavingKey(null);
    }
  }

  if (authLoading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <div className="h-8 w-52 animate-pulse rounded bg-neutral-900" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <div className="text-6xl">⚙️</div>
        <h1 className="mt-4 text-2xl font-black text-white">
          Connecte-toi pour gérer tes réglages
        </h1>
        <Link
          href="/auth/login"
          className="mt-6 inline-block rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-3 text-sm font-bold text-black transition hover:from-orange-400 hover:to-amber-400"
        >
          Se connecter
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      {/* En-tête */}
      <div className="mb-8">
        <div className="text-xs font-bold uppercase tracking-[0.2em] text-orange-500">
          Mon compte
        </div>
        <h1 className="mt-2 text-3xl font-black text-white">
          ⚙️ Réglages des notifications
        </h1>
        <p className="mt-2 text-sm text-neutral-400">
          Choisis les catégories de notifications 🔔 que tu veux recevoir dans
          ta cloche.
        </p>
      </div>

      {/* Cartes catégories */}
      {!prefs ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-2xl border border-neutral-800 bg-neutral-950"
            />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {CATEGORIES.map((cat) => {
            const enabled = prefs[cat.key];
            return (
              <div
                key={cat.key}
                className={`flex items-center gap-4 rounded-2xl border p-5 transition ${
                  enabled
                    ? "border-neutral-800 bg-neutral-950"
                    : "border-neutral-800/60 bg-neutral-950/60"
                }`}
              >
                <span className="text-2xl">{cat.icon}</span>
                <div className="min-w-0 flex-1">
                  <div
                    className={`text-sm font-bold ${enabled ? "text-white" : "text-neutral-400"}`}
                  >
                    {cat.title}
                  </div>
                  <div className="mt-0.5 text-xs leading-relaxed text-neutral-500">
                    {cat.description}
                  </div>
                </div>

                {/* Interrupteur */}
                <button
                  role="switch"
                  aria-checked={enabled}
                  aria-label={`Notifications ${cat.title}`}
                  onClick={() => toggle(cat.key)}
                  disabled={savingKey !== null}
                  className={`relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-50 ${
                    enabled ? "bg-emerald-500" : "bg-neutral-700"
                  }`}
                >
                  <span
                    className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${
                      enabled ? "left-6" : "left-1"
                    }`}
                  />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-xs text-emerald-300">
          {toast}
        </div>
      )}

      {/* Notes */}
      <div className="mt-6 space-y-2 rounded-2xl border border-neutral-800 bg-neutral-950 p-5 text-xs text-neutral-500">
        <p>
          🛡️ Les messages <b className="text-neutral-300">système</b> (compte,
          sécurité, annonces importantes) sont toujours livrés.
        </p>
        <p>
          💡 La cloche 🔔 de la barre de navigation n’affiche jamais les
          catégories désactivées : les nouvelles ne sont tout simplement pas
          créées.
        </p>
      </div>
    </div>
  );
}
