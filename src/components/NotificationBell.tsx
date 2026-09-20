// ============================================================
// CLOCHE DE NOTIFICATIONS — Navbar
// Affiche le compteur de non lues + panneau déroulant.
// ============================================================

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/context";
import { relativeTime } from "@/lib/format";

interface NotificationItem {
  id: string;
  type:
    | "badge_earned"
    | "course_completed"
    | "application_status"
    | "enrollment"
    | "payment_success"
    | "system";
  title: string;
  body: string | null;
  href: string | null;
  readAt: string | null;
  createdAt: string;
  /** Libellé de temps relatif calculé au chargement (hors rendu) */
  timeLabel: string;
}

/** Icône associée à chaque type de notification. */
const TYPE_ICON: Record<NotificationItem["type"], string> = {
  badge_earned: "🏅",
  course_completed: "🏆",
  application_status: "💼",
  enrollment: "🚀",
  payment_success: "💳",
  system: "🔔",
};

export function NotificationBell() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);

  /** Charge les notifications (setState après `await fetch` uniquement). */
  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/notifications", {
        credentials: "include",
      });
      const json = await res.json();
      if (!json.ok) return;
      setItems(
        (json.notifications as Omit<NotificationItem, "timeLabel">[]).map(
          (n) => ({ ...n, timeLabel: relativeTime(n.createdAt) })
        )
      );
      setUnread(json.unreadCount ?? 0);
    } catch {
      // Silencieux : la cloche ne doit pas casser la navigation
    }
  }, []);

  // Chargement initial (fetch-on-mount)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isAuthenticated) void load();
  }, [isAuthenticated, load]);

  // Ferme le panneau au clic extérieur
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  /** Marque une notification comme lue puis navigue vers sa cible. */
  async function openItem(n: NotificationItem) {
    if (!n.readAt) {
      setItems((prev) =>
        prev.map((i) =>
          i.id === n.id ? { ...i, readAt: new Date().toISOString() } : i
        )
      );
      setUnread((u) => Math.max(0, u - 1));
      void fetch("/api/v1/notifications", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: n.id }),
      });
    }
    setOpen(false);
    if (n.href) router.push(n.href);
  }

  /** Marque toutes les notifications comme lues. */
  async function markAllRead() {
    setItems((prev) =>
      prev.map((i) => ({ ...i, readAt: i.readAt ?? new Date().toISOString() }))
    );
    setUnread(0);
    void fetch("/api/v1/notifications", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
  }

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) void load(); // rafraîchit à l'ouverture
  }

  if (!isAuthenticated) return null;

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={toggle}
        className="relative rounded-lg border border-neutral-800 px-2.5 py-1.5 text-sm transition hover:border-orange-500/50"
        title="Notifications"
        aria-label="Notifications"
      >
        🔔
        {unread > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-gradient-to-r from-orange-500 to-amber-500 px-1 text-[10px] font-black text-black">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 max-w-[90vw] overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950 shadow-2xl">
          <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
            <span className="text-sm font-bold text-white">Notifications</span>
            {unread > 0 && (
              <button
                onClick={markAllRead}
                className="text-[11px] font-semibold text-orange-400 hover:text-orange-300"
              >
                Tout marquer lu
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <div className="p-8 text-center">
                <div className="text-3xl">📭</div>
                <p className="mt-2 text-xs text-neutral-500">
                  Aucune notification pour le moment.
                </p>
              </div>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => openItem(n)}
                  className={`flex w-full items-start gap-3 border-b border-neutral-900 px-4 py-3 text-left transition hover:bg-neutral-900 ${
                    n.readAt ? "opacity-60" : ""
                  }`}
                >
                  <span className="mt-0.5 text-lg">
                    {TYPE_ICON[n.type] ?? "🔔"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-bold text-white">
                      {n.title}
                    </span>
                    {n.body && (
                      <span className="mt-0.5 line-clamp-2 block text-[11px] text-neutral-400">
                        {n.body}
                      </span>
                    )}
                    <span className="mt-1 block text-[10px] text-neutral-600">
                      {n.timeLabel}
                    </span>
                  </span>
                  {!n.readAt && (
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-orange-500" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
