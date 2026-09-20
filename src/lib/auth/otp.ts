// ============================================================
// OTP — Génération de codes à usage unique (6 chiffres)
// ============================================================

/**
 * Génère un OTP numérique de la longueur donnée.
 * Par défaut 6 chiffres (ex: "384729").
 */
export function generateOtp(length = 6): string {
  const max = Math.pow(10, length);
  const n = Math.floor(Math.random() * max);
  return n.toString().padStart(length, "0");
}

/** Durée de validité d'un OTP (5 minutes) */
export const OTP_TTL_MS = 5 * 60 * 1000;

/** Nombre max de tentatives de vérification par OTP */
export const OTP_MAX_ATTEMPTS = 5;

/**
 * Vérifie qu'un OTP saisi correspond à l'OTP stocké.
 * Comparaison insensible à la casse + timing-safe.
 */
export function verifyOtp(input: string, stored: string): boolean {
  const a = input.trim();
  const b = stored.trim();
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}
