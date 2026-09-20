// ============================================================
// PRÉSENCE EN LIGNE — statut + « vu à » (last seen)
//
// Conception : le statut « online » vit en MÉMOIRE avec un TTL
// de 120 s, rafraîchi par un heartbeat client toutes les 30 s.
// La dernière activité est persistée en base (user_presence)
// pour survivre aux redémarrages.
//
// L'interface (set/get avec TTL) est compatible Redis :
// remplacer InMemoryPresenceStore par un client ioredis suffit
// pour passer en multi-instances sans toucher aux appelants.
// ============================================================

import { db } from "@/db";
import { userPresence } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { PRESENCE_TTL_MS, type PresenceStatus } from "./presence-constants";

// Constantes partageables côté navigateur (module pur, sans BDD)
export { PRESENCE_TTL_MS, HEARTBEAT_INTERVAL_MS } from "./presence-constants";
export type { PresenceStatus } from "./presence-constants";

interface PresenceEntry {
  status: PresenceStatus;
  /** Horodatage epoch ms où l'entrée expire sans heartbeat. */
  expiresAt: number;
}

export interface PublicPresence {
  status: PresenceStatus;
  lastSeenAt: string | null;
}

/**
 * Store en mémoire (par processus). Clef = userId.
 * Sweep périodique pour purger les entrées expirées.
 */
export class InMemoryPresenceStore {
  private entries = new Map<string, PresenceEntry>();
  private sweeping = false;

  /** Démarre le balayage périodique (idempotent). */
  startSweep(): void {
    if (this.sweeping) return;
    this.sweeping = true;
    const t = setInterval(() => this.cleanup(), PRESENCE_TTL_MS / 2);
    // Ne bloque pas la fin du processus (tests, scripts)
    if (typeof t.unref === "function") t.unref();
  }

  /** (Ré)active un utilisateur pour PRESENCE_TTL_MS. */
  heartbeat(userId: string, status: PresenceStatus = "online"): void {
    this.entries.set(userId, {
      status,
      expiresAt: Date.now() + PRESENCE_TTL_MS,
    });
  }

  /** Statut mémorisé si encore valide, sinon null. */
  getAlive(userId: string): PresenceStatus | null {
    const e = this.entries.get(userId);
    if (!e) return null;
    if (e.expiresAt < Date.now()) {
      this.entries.delete(userId);
      return null;
    }
    return e.status;
  }

  /** Retire définitivement un utilisateur (ex: toutes sessions fermées). */
  goOffline(userId: string): void {
    this.entries.delete(userId);
  }

  /** Purge les entrées expirées. */
  cleanup(): void {
    const now = Date.now();
    for (const [k, v] of this.entries) {
      if (v.expiresAt < now) this.entries.delete(k);
    }
  }

  /** Nombre d'entrées vivantes (diagnostic/tests). */
  aliveCount(): number {
    this.cleanup();
    return this.entries.size;
  }
}

/** Instance partagée du processus. */
export const presenceStore = new InMemoryPresenceStore();
presenceStore.startSweep();

/**
 * Persiste la dernière activité en base (blocage possible → à appeler
 * sans attendre dans les chemins temps réel).
 */
export async function persistLastSeen(
  userId: string,
  status: PresenceStatus = "online"
): Promise<void> {
  const now = new Date();
  await db
    .insert(userPresence)
    .values({ userId, status, lastSeenAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: userPresence.userId,
      set: { status, lastSeenAt: now, updatedAt: now },
    });
}

/**
 * Présence effective d'un utilisateur :
 * mémoire (TTL) en priorité, sinon base (offline + lastSeenAt).
 */
export async function getPresence(userId: string): Promise<PublicPresence> {
  const alive = presenceStore.getAlive(userId);
  if (alive) {
    return { status: alive, lastSeenAt: new Date().toISOString() };
  }
  const [row] = await db
    .select({ status: userPresence.status, lastSeenAt: userPresence.lastSeenAt })
    .from(userPresence)
    .where(eq(userPresence.userId, userId))
    .limit(1);
  return {
    status: "offline",
    lastSeenAt: row?.lastSeenAt?.toISOString() ?? null,
  };
}

/** Présences de plusieurs utilisateurs (une seule requête DB). */
export async function getPresenceMany(
  userIds: string[]
): Promise<Record<string, PublicPresence>> {
  const result: Record<string, PublicPresence> = {};
  const missing: string[] = [];
  const now = new Date().toISOString();
  for (const id of userIds) {
    const alive = presenceStore.getAlive(id);
    if (alive) {
      result[id] = { status: alive, lastSeenAt: now };
    } else {
      missing.push(id);
    }
  }
  if (missing.length > 0) {
    const rows = await db
      .select({
        userId: userPresence.userId,
        lastSeenAt: userPresence.lastSeenAt,
      })
      .from(userPresence)
      .where(inArray(userPresence.userId, missing));
    const byId = new Map(rows.map((r) => [r.userId, r.lastSeenAt]));
    for (const id of missing) {
      const seen = byId.get(id);
      result[id] = {
        status: "offline",
        lastSeenAt: seen ? seen.toISOString() : null,
      };
    }
  }
  return result;
}

/**
 * Marque un utilisateur hors ligne (appelée à la déconnexion WS :
 * purge mémoire + persist Date.now() comme « vu à »).
 */
export async function markOffline(userId: string): Promise<void> {
  presenceStore.goOffline(userId);
  await persistLastSeen(userId, "offline");
}
