// ============================================================
// TESTS — Store de présence en mémoire (TTL 120 s)
// (src/lib/chat/presence.ts — la BDD est mockée : seuls les
// comportements mémoire sont testés ici)
// ============================================================

// Chemins relatifs : la BDD n'existe pas dans les tests unitaires
jest.mock("../../../db", () => ({ db: {} }));
jest.mock("../../../db/schema", () => ({ userPresence: {} }));

import {
  HEARTBEAT_INTERVAL_MS,
  InMemoryPresenceStore,
  PRESENCE_TTL_MS,
} from "@/lib/chat/presence";

describe("constantes du protocole de présence", () => {
  it("TTL = 120 secondes", () => {
    expect(PRESENCE_TTL_MS).toBe(120_000);
  });
  it("heartbeat conseillé = 30 secondes (4× par TTL)", () => {
    expect(HEARTBEAT_INTERVAL_MS).toBe(30_000);
    expect(PRESENCE_TTL_MS % HEARTBEAT_INTERVAL_MS).toBe(0);
  });
});

describe("InMemoryPresenceStore", () => {
  it("heartbeat rend l'utilisateur « online »", () => {
    const store = new InMemoryPresenceStore();
    store.heartbeat("u1");
    expect(store.getAlive("u1")).toBe("online");
    expect(store.aliveCount()).toBe(1);
  });

  it("conserve le statut déclaré (away, dnd)", () => {
    const store = new InMemoryPresenceStore();
    store.heartbeat("u1", "dnd");
    store.heartbeat("u2", "away");
    expect(store.getAlive("u1")).toBe("dnd");
    expect(store.getAlive("u2")).toBe("away");
  });

  it("expire sans heartbeat après le TTL", () => {
    const store = new InMemoryPresenceStore();
    jest.useFakeTimers().setSystemTime(new Date("2026-09-20T12:00:00Z"));
    store.heartbeat("u1");
    expect(store.getAlive("u1")).toBe("online");

    jest.setSystemTime(new Date("2026-09-20T12:01:59Z")); // 119 s
    expect(store.getAlive("u1")).toBe("online");

    jest.setSystemTime(new Date("2026-09-20T12:02:01Z")); // 121 s
    expect(store.getAlive("u1")).toBeNull();
    jest.useRealTimers();
  });

  it("un heartbeat rafraîchit le TTL (fenêtre glissante)", () => {
    const store = new InMemoryPresenceStore();
    jest.useFakeTimers().setSystemTime(new Date("2026-09-20T12:00:00Z"));
    store.heartbeat("u1");
    jest.setSystemTime(new Date("2026-09-20T12:01:30Z")); // 90 s
    store.heartbeat("u1"); // re-beat
    jest.setSystemTime(new Date("2026-09-20T12:03:00Z")); // 90 s après re-beat
    expect(store.getAlive("u1")).toBe("online");
    jest.useRealTimers();
  });

  it("goOffline retire immédiatement le statut", () => {
    const store = new InMemoryPresenceStore();
    store.heartbeat("u1");
    store.goOffline("u1");
    expect(store.getAlive("u1")).toBeNull();
  });

  it("cleanup purge les entrées expirées", () => {
    const store = new InMemoryPresenceStore();
    jest.useFakeTimers().setSystemTime(new Date("2026-09-20T12:00:00Z"));
    store.heartbeat("u1");
    store.heartbeat("u2");
    jest.setSystemTime(new Date("2026-09-20T12:10:00Z"));
    store.heartbeat("u3");
    store.cleanup();
    expect(store.aliveCount()).toBe(1);
    expect(store.getAlive("u3")).toBe("online");
    jest.useRealTimers();
  });
});
