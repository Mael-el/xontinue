// ============================================================
// CLIENT TEMPS RÉEL — fabrique de sockets (navigateur)
//
// Auth WS = jeton court « realtime » (GET /api/v1/realtime/token)
// passé en auth.token : fonctionne quel que soit l'hôte du
// serveur temps réel (localhost dev, preview E2B, domaine prod).
// Le cookie httpOnly suffit aussi en même-hôte — le serveur
// accepte les deux.
//
// Une socket PAR NAMESPACE, partagée par toute l'UI (singleton).
// ============================================================

"use client";

import { io, type Socket } from "socket.io-client";

export type RealtimeNamespace = "/workspace" | "/chat";

interface RealtimeAuthResponse {
  ok: boolean;
  token: string;
  expiresIn: number;
  realtimeUrl: string;
}

interface CachedAuth {
  token: string;
  realtimeUrl: string;
  expiresAt: number;
}

let cached: CachedAuth | null = null;
let pending: Promise<CachedAuth> | null = null;

/** Jeton realtime mis en cache (renouvelé 30 s avant expiration). */
export async function getRealtimeAuth(): Promise<CachedAuth> {
  if (cached && cached.expiresAt - 30_000 > Date.now()) return cached;
  if (pending) return pending;

  pending = fetch("/api/v1/realtime/token", { cache: "no-store" })
    .then(async (res) => {
      if (!res.ok) throw new Error(`realtime token: ${res.status}`);
      const json = (await res.json()) as RealtimeAuthResponse;
      const value: CachedAuth = {
        token: json.token,
        realtimeUrl: json.realtimeUrl,
        expiresAt: Date.now() + json.expiresIn * 1000,
      };
      cached = value;
      return value;
    })
    .finally(() => {
      pending = null;
    });

  return pending;
}

const sockets = new Map<RealtimeNamespace, Socket>();

/**
 * Socket du namespace (singleton — créée à la demande).
 * Sur erreur d'auth, le jeton est invalidé : la prochaine
 * reconnexion en récupère un neuf.
 */
export async function getSocket(ns: RealtimeNamespace): Promise<Socket> {
  const existing = sockets.get(ns);
  if (existing && !existing.disconnected) return existing;
  if (existing) {
    existing.removeAllListeners();
    existing.close();
    sockets.delete(ns);
  }

  const auth = await getRealtimeAuth();
  const socket = io(`${auth.realtimeUrl}${ns}`, {
    auth: { token: auth.token },
    withCredentials: true,
    transports: ["websocket", "polling"],
    reconnectionDelayMax: 8000,
  });

  socket.on("connect_error", (err) => {
    if (String(err.message).includes("unauthorized")) {
      cached = null; // jeton expiré → on repartira d'un jeton frais
    }
  });

  sockets.set(ns, socket);
  return socket;
}

/** Ferme proprement les sockets (logout, démontage global). */
export function closeSockets(): void {
  for (const socket of sockets.values()) {
    socket.removeAllListeners();
    socket.close();
  }
  sockets.clear();
  cached = null;
}
