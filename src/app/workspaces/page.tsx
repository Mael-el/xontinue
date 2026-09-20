// ============================================================
// PAGE — Mes espaces de travail (Discord-like)
// Tes espaces + création + rejoindre par code d'invitation.
// ============================================================

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/context";

interface WorkspaceItem {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  description: string | null;
  memberCount: number;
  ownerId: string;
}

export default function WorkspacesPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuth();
  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace("/auth/login");
  }, [isLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!isAuthenticated) return;
    void fetch("/api/v1/workspaces")
      .then((r) => r.json())
      .then((j) => setWorkspaces(j.workspaces ?? []))
      .catch(() => setError("Impossible de charger tes espaces"))
      .finally(() => setLoading(false));
  }, [isAuthenticated]);

  async function createWorkspace(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/v1/workspaces", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        description: form.get("description") || undefined,
        icon: form.get("icon") || undefined,
      }),
    });
    const json = await res.json();
    setBusy(false);
    if (res.ok) {
      router.push(`/workspaces/${json.workspace.id}`);
    } else {
      setError(json.error ?? "Création impossible");
    }
  }

  async function joinByCode(e: React.FormEvent) {
    e.preventDefault();
    const code = joinCode.trim().replaceAll(" ", "");
    if (!code) return;
    setBusy(true);
    const res = await fetch(`/api/v1/workspaces/invite/${encodeURIComponent(code)}`, {
      method: "POST",
    });
    const json = await res.json();
    setBusy(false);
    if (res.ok) router.push(`/workspaces/${json.workspace.id}`);
    else setError(json.error ?? "Code invalide");
  }

  if (isLoading || !user) {
    return <PageShell>Chargement…</PageShell>;
  }

  return (
    <main className="min-h-screen bg-[#0A0A0A] px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-white">Espaces de travail</h1>
            <p className="mt-1 text-sm text-neutral-400">
              Communautés, cohortes, équipes — salons texte, vocaux et annonces.
            </p>
          </div>
          <button
            onClick={() => setShowCreate((v) => !v)}
            className="rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-orange-500/30 hover:bg-orange-400"
          >
            + Créer un espace
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {showCreate && (
          <form
            onSubmit={createWorkspace}
            className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-6"
          >
            <h2 className="text-lg font-bold text-white">Nouvel espace</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-[80px_1fr]">
              <div>
                <label className="text-xs font-semibold text-neutral-400">Icône</label>
                <input
                  name="icon"
                  defaultValue="🚀"
                  maxLength={4}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-[#111] px-3 py-2.5 text-center text-xl text-white outline-none focus:border-orange-500"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-neutral-400">Nom</label>
                <input
                  name="name"
                  required
                  minLength={2}
                  maxLength={120}
                  placeholder="Ex: Cohorte Data Science 2026"
                  className="mt-1 w-full rounded-xl border border-white/10 bg-[#111] px-3 py-2.5 text-sm text-white outline-none focus:border-orange-500"
                />
              </div>
            </div>
            <div className="mt-4">
              <label className="text-xs font-semibold text-neutral-400">Description</label>
              <textarea
                name="description"
                rows={2}
                placeholder="Objectif de l'espace, règles…"
                className="mt-1 w-full rounded-xl border border-white/10 bg-[#111] px-3 py-2.5 text-sm text-white outline-none focus:border-orange-500"
              />
            </div>
            <div className="mt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="rounded-xl px-4 py-2 text-sm font-semibold text-neutral-300 hover:bg-white/5"
              >
                Annuler
              </button>
              <button
                disabled={busy}
                className="rounded-xl bg-emerald-500 px-5 py-2 text-sm font-bold text-white hover:bg-emerald-400 disabled:opacity-50"
              >
                {busy ? "Création…" : "Créer"}
              </button>
            </div>
          </form>
        )}

        {/* Rejoindre par code */}
        <form onSubmit={joinByCode} className="mt-6 flex gap-3">
          <input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="Code d'invitation (ex: K7M2QX9D)"
            className="flex-1 rounded-xl border border-white/10 bg-[#111] px-4 py-2.5 font-mono text-sm tracking-widest text-white outline-none focus:border-orange-500"
          />
          <button
            disabled={busy || !joinCode.trim()}
            className="rounded-xl border border-orange-500/40 bg-orange-500/10 px-4 py-2.5 text-sm font-bold text-orange-300 hover:bg-orange-500/20 disabled:opacity-40"
          >
            Rejoindre
          </button>
        </form>

        {/* Liste */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {loading &&
            Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-32 animate-pulse rounded-2xl bg-white/5" />
            ))}
          {!loading && workspaces.length === 0 && (
            <div className="col-span-full rounded-2xl border border-dashed border-white/10 p-10 text-center">
              <p className="text-4xl">🏕️</p>
              <p className="mt-3 font-semibold text-neutral-300">
                Aucun espace pour l'instant
              </p>
              <p className="mt-1 text-sm text-neutral-500">
                Crée le tien ou rejoins-en un avec un code d'invitation.
              </p>
            </div>
          )}
          {workspaces.map((ws) => (
            <Link
              key={ws.id}
              href={`/workspaces/${ws.id}`}
              className="group rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-orange-500/40 hover:bg-white/[0.05]"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500/30 to-emerald-500/30 text-2xl">
                  {ws.icon ?? "🏢"}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate font-bold text-white group-hover:text-orange-300">
                      {ws.name}
                    </h3>
                    {ws.ownerId === user.id && (
                      <span className="rounded-md bg-orange-500/15 px-1.5 py-0.5 text-[10px] font-bold text-orange-300">
                        PROPRIÉTAIRE
                      </span>
                    )}
                  </div>
                  {ws.description && (
                    <p className="mt-1 line-clamp-2 text-xs text-neutral-400">
                      {ws.description}
                    </p>
                  )}
                  <p className="mt-2 text-xs text-neutral-500">
                    👥 {ws.memberCount} membre{ws.memberCount > 1 ? "s" : ""}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0A0A0A] text-neutral-400">
      {children}
    </main>
  );
}
