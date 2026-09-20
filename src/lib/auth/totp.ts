// ============================================================
// TOTP — Authentification à 2 facteurs (Google Authenticator)
// Utilise l'API haut niveau de `otplib`.
// ============================================================

import {
  generateSecret,
  generateURI,
  verify as verifyOtpToken,
} from "otplib";

/**
 * Génère un secret TOTP pour un utilisateur.
 * Format : base32, 20 caractères.
 */
export function generateTotpSecret(): string {
  return generateSecret();
}

/**
 * Génère l'URL otpauth:// à encoder en QR code.
 */
export function buildTotpUri(params: {
  secret: string;
  accountName: string;
  issuer?: string;
}): string {
  return generateURI({
    secret: params.secret,
    label: params.accountName,
    issuer: params.issuer ?? "AfricaSkills",
  });
}

/**
 * Vérifie un code TOTP saisi par l'utilisateur (async).
 */
export async function verifyTotp(
  token: string,
  secret: string
): Promise<boolean> {
  try {
    const result = await verifyOtpToken({ token, secret });
    // result peut être booléen ou objet { delta, ... } selon la version
    if (typeof result === "boolean") return result;
    return Boolean(result);
  } catch {
    return false;
  }
}
