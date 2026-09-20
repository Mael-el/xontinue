// ============================================================
// PRÉSENCE — constantes de protocole (module PUR, sans BDD)
// Importable côte navigateur (hooks React) ET côté serveur.
// ============================================================

/** TTL du statut online sans heartbeat (ms). */
export const PRESENCE_TTL_MS = 120_000;
/** Intervalle conseillé pour le heartbeat client (ms). */
export const HEARTBEAT_INTERVAL_MS = 30_000;

export type PresenceStatus = "online" | "away" | "dnd" | "offline";
