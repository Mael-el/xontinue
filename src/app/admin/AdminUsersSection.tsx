// ============================================================
// COMPOSANT CLIENT — ADMIN · GESTION DES UTILISATEURS
// Recherche (nom/email) + filtre rôle, suspendre / réactiver.
// ==============================================

"use client";

import { useEffect, useRef, useState } from "react";

interface AdminUser {
  id: string;
  fullName: string;
  email: string | null;
  role: string;
  status: string;
  xp: number;
  country: string | null;
  createdAt: string;
}

const ROLE_LABELS: Record<string, string> = {
  student: "🎓 Étudiant",
  instructor: "🧑‍🏫 Formateur",
  mentor: "🤝 Mentor",
  company: "🏢 Entreprise",
  admin: "🛡️ Admin",
};

const ROLE_COLORS: Record<string, string> = {
  student: "border-sky-500/40 text-sky-300",
  instructor: "border-orange-500/40 text-orange-300",
  mentor: "border-emerald-500/40 text-emerald-300",
  company: "border-violet-500/40 text-violet-300",
  admin: "border-red-500/40 text-red-300",
};

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: "bg-emerald-500/15 text-emerald-300",
    pending: "bg-amber-500/15 text-amber-300",
    suspended: "bg-red-500/15 text-red-300",
    banned: "bg-red-500/15 text-red-300",
  };
  const labels: Record<string, string> = {
    active: "Actif",
    pending: "En attente",
    suspended: "Suspendu",
    banned: "Banni",
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${styles[status] ?? "bg-neutral-800 text-neutral-400"}`}
    >
      {labels[status] ?? status}
    </span>
  );
}

export function AdminUsersSection({ currentUserId }: { currentUserId: string }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(message: string) {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }

  function load(search: string, roleFilter: string) {
    const params = new URLSearchParams();
    if (search.trim()) params.set("q", search.trim());
    if (roleFilter) params.set("role", roleFilter);
    fetch(`/api/v1/admin/users?${params.toString()}`, {
      credentials: "include",
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setUsers(data.users);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }

  useEffect(() => {
    load("", "");
  }, []);

  async function toggleStatus(user: AdminUser) {
    const next = user.status === "suspended" ? "active" : "suspended";
    if (
      next === "suspended" &&
      !window.confirm(`Suspendre le compte de ${user.fullName} ?`)
    ) {
      return;
    }
    try {
      const res = await fetch(`/api/v1/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: next }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        showToast(data.error ?? "Action impossible");
        return;
      }
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, status: next } : u))
      );
      showToast(
        next === "suspended"
          ? `🚫 ${user.fullName} suspendu`
          : `✅ ${user.fullName} réactivé`
      );
    } catch {
      showToast("Erreur réseau");
    }
  }

  return (
    <section className="mt-10">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-white">
          👥 Gestion des utilisateurs
        </h2>
        {toast && (
          <span className="rounded-lg bg-neutral-900 px-3 py-2 text-xs text-emerald-300">
            {toast}
          </span>
        )}
      </div>

      {/* Recherche + filtre rôle */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          load(q, role);
        }}
        className="mb-3 flex flex-wrap items-center gap-2"
      >
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Nom ou email…"
          className="w-56 rounded-xl border border-neutral-800 bg-neutral-950 px-4 py-2.5 text-sm text-white placeholder:text-neutral-600 focus:border-orange-500 focus:outline-none"
        />
        <select
          value={role}
          onChange={(e) => {
            setRole(e.target.value);
            load(q, e.target.value);
          }}
          className="rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2.5 text-sm text-white focus:border-orange-500 focus:outline-none"
        >
          <option value="">Tous les rôles</option>
          {Object.entries(ROLE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-2.5 text-xs font-bold text-black transition hover:from-orange-400 hover:to-amber-400"
        >
          Rechercher
        </button>
      </form>

      {!loaded ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-14 animate-pulse rounded-xl border border-neutral-800 bg-neutral-950"
            />
          ))}
        </div>
      ) : users.length === 0 ? (
        <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-8 text-center text-sm text-neutral-500">
          Aucun utilisateur ne correspond à cette recherche.
        </div>
      ) : (
        <div className="space-y-2">
          {users.map((u) => {
            const isSelf = u.id === currentUserId;
            const isAdmin = u.role === "admin";
            return (
              <div
                key={u.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-neutral-800 bg-neutral-950 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-bold text-white">
                      {u.fullName}
                    </span>
                    {isSelf && (
                      <span className="rounded-full bg-orange-500/20 px-2 py-0.5 text-[9px] font-bold text-orange-300">
                        TOI
                      </span>
                    )}
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${ROLE_COLORS[u.role] ?? "border-neutral-700 text-neutral-400"}`}
                    >
                      {ROLE_LABELS[u.role] ?? u.role}
                    </span>
                    <StatusPill status={u.status} />
                  </div>
                  <div className="mt-0.5 text-[11px] text-neutral-500">
                    {u.email ?? "—"} · ⚡ {u.xp} XP ·{" "}
                    {u.country ?? "Afrique"} · depuis le{" "}
                    {new Date(u.createdAt).toLocaleDateString("fr-FR")}
                  </div>
                </div>
                {!isSelf && !isAdmin && (
                  <button
                    onClick={() => toggleStatus(u)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition ${
                      u.status === "suspended"
                        ? "border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10"
                        : "border-red-500/30 text-red-400 hover:bg-red-500/10"
                    }`}
                  >
                    {u.status === "suspended" ? "✅ Réactiver" : "🚫 Suspendre"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
