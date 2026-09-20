// ============================================================
// PONT HTTP → SERVEUR TEMPS RÉEL
//
// Les Route Handlers Next (processus web) n'hébergent pas
// socket.io : elles notifient le serveur temps réel dédié
// (realtime/server.ts, port 3001) par HTTP local.
// Aucun appel ne doit faire échouer la requête REST (best-effort) :
// si le serveur temps réel est arrêté, l'API reste fonctionnelle.
// ============================================================

const DEFAULT_URL = "http://127.0.0.1:3001";
const DEFAULT_SECRET = "dev-realtime-secret-change-me";

function emitBase(): string {
  return (
    process.env.REALTIME_EMIT_URL?.replace(/\/$/, "") ?? DEFAULT_URL
  );
}

function emitSecret(): string {
  return process.env.REALTIME_EMIT_SECRET ?? DEFAULT_SECRET;
}

/** Appel JSON best-effort (timeout court, exceptions avalées). */
async function internalPost(path: string, body: unknown): Promise<void> {
  try {
    await fetch(`${emitBase()}/internal${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${emitSecret()}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(1500),
    });
  } catch {
    // Le temps réel est dégradé → l'API REST reste la source de vérité
  }
}

/**
 * Diffuse un événement socket.io sur une room
 * (ex: room "channel:<id>" / "conversation:<id>" / "user:<id>").
 */
export function emitToRoom(
  namespace: "/workspace" | "/chat",
  room: string,
  event: string,
  data: unknown
): Promise<void> {
  return internalPost("/emit", { namespace, room, event, data });
}

/**
 * Diffuse à plusieurs rooms en un appel (ex: membres d'une conversation
 * + la room conversation).
 */
export function emitToRooms(
  namespace: "/workspace" | "/chat",
  rooms: string[],
  event: string,
  data: unknown
): Promise<void> {
  return internalPost("/emit", { namespace, rooms, event, data });
}

/**
 * Demande les présences « online » vivantes au serveur temps réel
 * (il en est l'autorité — sa mémoire contient les sockets connectés).
 * Retourne null si injoignable (l'appelant retombe sur son store local).
 */
export async function queryRealtimePresence(
  userIds: string[]
): Promise<Record<string, string> | null> {
  try {
    const res = await fetch(`${emitBase()}/internal/presence`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${emitSecret()}`,
      },
      body: JSON.stringify({ userIds }),
      signal: AbortSignal.timeout(1500),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { presence?: Record<string, string> };
    return json.presence ?? null;
  } catch {
    return null;
  }
}
