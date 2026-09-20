// ============================================================
// HOOKS TEMPS RÉEL — connexion + présence (React)
// ============================================================

"use client";

import { useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { getSocket, type RealtimeNamespace } from "./client";
import { HEARTBEAT_INTERVAL_MS } from "@/lib/chat/presence-constants";

/** Ouvre (ou réutilise) la socket d'un namespace. */
export function useSocket(ns: RealtimeNamespace, enabled = true) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let s: Socket | null = null;

    getSocket(ns).then((sock) => {
      if (cancelled) return;
      s = sock;
      setSocket(sock);
      const onConnect = () => setConnected(true);
      const onDisconnect = () => setConnected(false);
      sock.on("connect", onConnect);
      sock.on("disconnect", onDisconnect);
      setConnected(sock.connected);
    });

    return () => {
      cancelled = true;
      if (s) {
        s.off("connect");
        s.off("disconnect");
      }
      setSocket(null);
      setConnected(false);
    };
  }, [ns, enabled]);

  return { socket, connected };
}

/**
 * Maintient mon statut « online » côté serveur temps réel :
 * heartbeat applicatif toutes les 30 s (TTL serveur 120 s).
 */
export function usePresenceHeartbeat(socket: Socket | null) {
  useEffect(() => {
    if (!socket || !socket.connected) return;
    socket.emit("presence:heartbeat", { status: "online" });
    const timer = setInterval(() => {
      socket.emit("presence:heartbeat", { status: "online" });
    }, HEARTBEAT_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [socket, socket?.connected]);
}

/** État de présence d'autres utilisateurs (événements + snapshot). */
export interface PresenceState {
  status: "online" | "away" | "dnd" | "offline";
  lastSeenAt: string | null;
}

export function usePresenceUpdates(socket: Socket | null) {
  const [presence, setPresence] = useState<Record<string, PresenceState>>({});

  useEffect(() => {
    if (!socket) return;
    const handler = (data: { userId: string; status: PresenceState["status"]; lastSeenAt: string }) => {
      setPresence((prev) => ({
        ...prev,
        [data.userId]: { status: data.status, lastSeenAt: data.lastSeenAt },
      }));
    };
    socket.on("presence:update", handler);
    return () => {
      socket.off("presence:update", handler);
    };
  }, [socket]);

  const merge = (userId: string, snapshot: PresenceState | null): PresenceState =>
    presence[userId] ?? snapshot ?? { status: "offline", lastSeenAt: null };

  return { presence, merge };
}

/**
 * Indicateur de frappe d'une room (channel/conversation) :
 * clé = userId, valeur = nom affiché, expiry client 4 s.
 */
export function useTyping(socket: Socket | null, roomKey: string | null) {
  const [typers, setTypers] = useState<Record<string, string>>({});
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    if (!socket || !roomKey) return;
    const handler = (data: {
      channelId?: string;
      conversationId?: string;
      userId: string;
      userName: string;
      isTyping: boolean;
    }) => {
      const key = data.channelId ?? data.conversationId ?? null;
      if (key !== roomKey) return;
      setTypers((prev) => {
        const next = { ...prev };
        const existing = timers.current.get(data.userId);
        if (existing) clearTimeout(existing);
        if (data.isTyping) {
          next[data.userId] = data.userName;
          timers.current.set(
            data.userId,
            setTimeout(() => {
              setTypers((p) => {
                const n = { ...p };
                delete n[data.userId];
                return n;
              });
            }, 4000)
          );
        } else {
          delete next[data.userId];
        }
        return next;
      });
    };
    socket.on("typing:update", handler);
    return () => {
      socket.off("typing:update", handler);
    };
  }, [socket, roomKey]);

  return Object.values(typers);
}
