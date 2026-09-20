// ============================================================
// TESTS — Rate limiting en mémoire (src/lib/auth/rate-limit.ts)
// ============================================================

import {
  checkRateLimit,
  resetRateLimit,
  recordFailedAttempt,
} from "@/lib/auth/rate-limit";

describe("checkRateLimit", () => {
  it("autorise les appels dans la limite puis bloque au-delà", () => {
    const key = `test:${Math.random()}`;
    const limit = 3;

    for (let i = 0; i < limit; i++) {
      const r = checkRateLimit(key, limit, 60_000);
      expect(r.allowed).toBe(true);
      expect(r.remaining).toBe(limit - 1 - i);
    }

    // 4e appel → refusé
    const blocked = checkRateLimit(key, limit, 60_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  it("utilise des compteurs indépendants par clé", () => {
    const a = `test:a:${Math.random()}`;
    const b = `test:b:${Math.random()}`;
    checkRateLimit(a, 1, 60_000);
    expect(checkRateLimit(a, 1, 60_000).allowed).toBe(false);
    // une autre clé n'est pas impactée
    expect(checkRateLimit(b, 1, 60_000).allowed).toBe(true);
  });

  it("ré-autorise après l'expiration de la fenêtre", () => {
    jest.useFakeTimers();
    try {
      const key = `test:expire:${Math.random()}`;
      checkRateLimit(key, 1, 1_000);
      expect(checkRateLimit(key, 1, 1_000).allowed).toBe(false);

      jest.advanceTimersByTime(1_500);
      expect(checkRateLimit(key, 1, 1_000).allowed).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });
});

describe("resetRateLimit", () => {
  it("remet le compteur à zéro pour la clé", () => {
    const key = `test:reset:${Math.random()}`;
    checkRateLimit(key, 1, 60_000);
    expect(checkRateLimit(key, 1, 60_000).allowed).toBe(false);

    resetRateLimit(key);
    expect(checkRateLimit(key, 1, 60_000).allowed).toBe(true);
  });
});

describe("recordFailedAttempt", () => {
  it("incrémente et retourne le nombre d'échecs", () => {
    const key = `test:fail:${Math.random()}`;
    expect(recordFailedAttempt(key)).toBe(1);
    expect(recordFailedAttempt(key)).toBe(2);
    expect(recordFailedAttempt(key)).toBe(3);
  });
});
