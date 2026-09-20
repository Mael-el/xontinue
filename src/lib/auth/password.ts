// ============================================================
// HASH & VÉRIFICATION DE MOTS DE PASSE — bcrypt (12 rounds)
// ============================================================

import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

/**
 * Hash un mot de passe avec bcrypt.
 * @param password mot de passe en clair
 * @returns hash bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Vérifie un mot de passe contre un hash bcrypt.
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Génère un token aléatoire sécurisé (pour reset password, etc.)
 */
export function generateSecureToken(length = 32): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Hash SHA-256 d'un token (pour stockage sécurisé en DB).
 */
export async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer), (b) =>
    b.toString(16).padStart(2, "0")
  ).join("");
}
