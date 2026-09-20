// ============================================================
// PAGE — Messagerie (liste des conversations, WhatsApp-like)
// Non lus · présence · aperçu du dernier message · recherche
// d'utilisateurs pour démarrer une conversation.
// ============================================================

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/context";
import {
  usePresenceHeartbeat,
  usePresenceUpdates,
  useSocket,
} from "@/lib/realtime/hooks";

interface ConversationItem {
  id: string;
  type: "direct" | "group";
  name: string;
  avatarUrl: string | null;
  peerId: string | null;
  peerPresence: { status: string; lastSeenAt: string | null } | null;
  unreadCount: number;
  lastMessage: {
    senderId: string;
    type: string;
    preview: string;
    createdAt: string;
  } | null;
  lastMessageAt: string | null;
}

export default function MessagesPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuth();
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);

  const { socket } = useSocket("/chat", isAuthenticated);
  usePresenceHeartbeat(socket);
  const { merge: mergePresence } = usePresenceUpdates(socket);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace("/auth/login");
  }, [isLoading, isAuthenticated, router]);

  const refresh = useCallback(() => {
    void fetch("/api/v1/chat/conversations")
      .then((r) => r.json())
      .then((j) => setConversations(j.conversations ?? []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (isAuthenticated) refresh();
  }, [isAuthenticated, refresh]);

  // Rafraîchit la liste à chaque message entrant (aperçu + badge)
  useEffect(() => {
    if (!socket) return;
    const handler = () => refresh();
    socket.on("message:new", handler);
    socket.on("conversation:added", handler);
    return () => {
      socket.off("message:new", handler);
      socket.off("conversation:added", handler);
    };
  }, [socket, refresh]);

  if (isLoading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0A0A0A] text-neutral-400">
        Chargement…
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0A0A0A] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black text-white">Messages</h1>
            <p className="mt-1 text-sm text-neutral-400">
              Discute avec d'autres apprenants et formateurs.
            </p>
          </div>
          <button
            onClick={() => setShowNew(true)}
            className="rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-orange-500/30 hover:bg-orange-400"
          >
            ✏️ Nouveau
          </button>
        </div>

        <div className="mt-6 divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
          {loading &&
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse bg-white/[0.02]" />
            ))}
          {!loading && conversations.length === 0 && (
            <div className="p-14 text-center">
              <p className="text-4xl">💬</p>
              <p className="mt-3 font-semibold text-neutral-300">Aucune conversation</p>
              <p className="mt-1 text-sm text-neutral-500">
                Clique sur « Nouveau » pour écrire à quelqu'un.
              </p>
            </div>
          )}
          {conversations.map((c) => {
            const presence = c.peerId ? mergePresence(c.peerId, c.peerPresence as never) : null;
            const online = presence?.status === "online";
            return (
              <Link
                key={c.id}
                href={`/messages/${c.id}`}
                className="flex items-center gap-3 px-4 py-3.5 transition hover:bg-white/[0.04]"
              >
                <div className="relative shrink-0">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-orange-500/40 to-emerald-500/40 text-sm font-bold text-white">
                    {initials(c.name)}
                  </div>
                  {c.type === "direct" && (
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-[#0b0b0b] ${
                        online ? "bg-emerald-500" : "bg-neutral-600"
                      }`}
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="truncate font-bold text-white">
                      {c.type === "group" ? "👥 " : ""}
                      {c.name}
                    </h3>
                    <span className="shrink-0 text-[11px] text-neutral-500">
                      {c.lastMessage ? timeAgo(new Date(c.lastMessage.createdAt)) : ""}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm text-neutral-400">
                      {c.lastMessage
                        ? `${user && c.lastMessage.senderId === user.id ? "Vous : " : ""}${c.lastMessage.preview}`
                        : "Démarre la conversation"}
                    </p>
                    {c.unreadCount > 0 && (
                      <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-orange-500 px-1.5 text-[11px] font-bold text-white">
                        {c.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {showNew && <NewConversationModal onClose={() => setShowNew(false)} />}
    </main>
  );
}

// ─── Modale nouvelle conversation ────────────────────────────

function NewConversationModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ id: string; fullName: string; emailMasked: string | null }[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [groupName, setGroupName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(() => {
      void fetch(`/api/v1/chat/users/search?q=${encodeURIComponent(q.trim())}`)
        .then((r) => r.json())
        .then((j) => setResults(j.users ?? []));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function start() {
    if (selected.size === 0) return;
    setBusy(true);
    const isGroup = selected.size > 1;
    const res = await fetch("/api/v1/chat/conversations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(
        isGroup
          ? { name: groupName.trim() || "Nouveau groupe", memberIds: [...selected] }
          : { userId: [...selected][0] }
      ),
    });
    const json = await res.json();
    if (res.ok) router.push(`/messages/${json.conversation.id}`);
    setBusy(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl border border-white/10 bg-[#141414] p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-white">Nouvelle conversation</h2>
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher une personne (nom, email)…"
          className="mt-4 w-full rounded-xl border border-white/10 bg-[#0E0E0E] px-4 py-2.5 text-sm outline-none focus:border-orange-500"
        />
        <div className="mt-3 max-h-64 overflow-y-auto">
          {results.map((u) => {
            const active = selected.has(u.id);
            return (
              <button
                key={u.id}
                onClick={() => toggle(u.id)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left ${
                  active ? "bg-orange-500/15" : "hover:bg-white/5"
                }`}
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-orange-500/40 to-emerald-500/40 text-xs font-bold text-white">
                  {initials(u.fullName)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">{u.fullName}</p>
                  {u.emailMasked && (
                    <p className="truncate text-xs text-neutral-500">{u.emailMasked}</p>
                  )}
                </div>
                {active && <span className="text-orange-400">✓</span>}
              </button>
            );
          })}
          {q.trim().length >= 2 && results.length === 0 && (
            <p className="py-6 text-center text-sm text-neutral-500">Aucun résultat</p>
          )}
        </div>

        {selected.size > 1 && (
          <input
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="Nom du groupe (optionnel)"
            className="mt-3 w-full rounded-xl border border-white/10 bg-[#0E0E0E] px-4 py-2.5 text-sm outline-none focus:border-orange-500"
          />
        )}

        <div className="mt-4 flex justify-end gap-3">
          <button onClick={onClose} className="rounded-xl px-4 py-2 text-sm text-neutral-400 hover:bg-white/5">
            Annuler
          </button>
          <button
            onClick={start}
            disabled={selected.size === 0 || busy}
            className="rounded-xl bg-emerald-500 px-5 py-2 text-sm font-bold text-white hover:bg-emerald-400 disabled:opacity-40"
          >
            {busy ? "…" : selected.size > 1 ? `Créer le groupe (${selected.size})` : "Discuter"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Utilitaires ─────────────────────────────────────────────

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function timeAgo(d: Date): string {
  const now = Date.now();
  const diff = now - d.getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `${minutes} min`;
  const today = new Date();
  if (d.toDateString() === today.toDateString()) {
    return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  }
  const yesterday = new Date(now - 86400_000);
  if (d.toDateString() === yesterday.toDateString()) return "hier";
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}
