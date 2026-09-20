// ============================================================
// INVITATIONS WORKSPACE — codes partageables (type Discord)
// Format : 8 caractères alphanumériques lisibles (sans 0/O/1/I
// pour éviter les confusions). Ex: « K7M2-QX9D » → « K7M2QX9D ».
// ============================================================

import type { workspaceInvites } from "@/db/schema";

type InviteRow = typeof workspaceInvites.$inferSelect;

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Génère un code d'invitation (8 caractères, groupe de 4 lisible). */
export function generateInviteCode(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

/** Normalise un code saisi (majuscules, sans tirets/espaces). */
export function normalizeInviteCode(code: string): string {
  return code.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

export type InviteValidity =
  | { ok: true }
  | { ok: false; reason: "expired" | "exhausted" };

/**
 * Vérifie qu'une invitation est encore utilisable
 * (date d'expiration et nombre maximal d'utilisations).
 */
export function checkInviteValidity(
  invite: Pick<InviteRow, "expiresAt" | "maxUses" | "usesCount">,
  now = new Date()
): InviteValidity {
  if (invite.expiresAt && new Date(invite.expiresAt).getTime() < now.getTime()) {
    return { ok: false, reason: "expired" };
  }
  if (invite.maxUses !== null && invite.usesCount >= invite.maxUses) {
    return { ok: false, reason: "exhausted" };
  }
  return { ok: true };
}
