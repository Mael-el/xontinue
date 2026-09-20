// ============================================================
// RATE LIMITING — En mémoire (à remplacer par Redis en prod)
// Clé : IP ou userId + action.
// ============================================================

interface Bucket {
  count: number;
  resetAt: number;
}

const store = new Map<string, Bucket>();

// Nettoyage périodique pour éviter les fuites mémoire
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of store.entries()) {
    if (bucket.resetAt < now) store.delete(key);
  }
}, 60_000).unref?.();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfterMs: number;
}

/**
 * Vérifie qu'une action ne dépasse pas la limite configurée.
 *
 * @param key Clé unique (ex: `login:${ip}`)
 * @param maxAttempts Nombre max d'appels autorisés
 * @param windowMs Fenêtre de temps en ms (ex: 15 * 60 * 1000)
 */
export function checkRateLimit(
  key: string,
  maxAttempts: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  let bucket = store.get(key);

  if (!bucket || bucket.resetAt < now) {
    bucket = { count: 0, resetAt: now + windowMs };
    store.set(key, bucket);
  }

  bucket.count += 1;
  const remaining = Math.max(0, maxAttempts - bucket.count);
  const retryAfterMs = Math.max(0, bucket.resetAt - now);

  return {
    allowed: bucket.count <= maxAttempts,
    remaining,
    resetAt: bucket.resetAt,
    retryAfterMs,
  };
}

/**
 * Réinitialise le rate-limit pour une clé (après succès).
 */
export function resetRateLimit(key: string): void {
  store.delete(key);
}

/**
 * Enregistre un échec d'authentification.
 * Après 10 échecs → blocage du compte (géré côté service).
 */
export function recordFailedAttempt(key: string): number {
  const bucket = store.get(key) ?? {
    count: 0,
    resetAt: Date.now() + 15 * 60 * 1000,
  };
  bucket.count += 1;
  store.set(key, bucket);
  return bucket.count;
}
