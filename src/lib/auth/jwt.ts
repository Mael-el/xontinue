// ============================================================
// JWT — Access (15 min) + Refresh (7 jours) avec `jose`
// ============================================================

import { SignJWT, jwtVerify, type JWTPayload } from "jose";

/** Durée de vie de l'access token (15 minutes) */
export const ACCESS_TOKEN_TTL = "15m";
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

/** Durée de vie du refresh token (7 jours) */
export const REFRESH_TOKEN_TTL = "7d";
export const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

export interface AuthPayload extends JWTPayload {
  sub: string; // userId
  email?: string;
  phone?: string;
  role: string;
  type: "access" | "refresh";
  sessionId?: string;
}

/** Secret de développement — JAMAIS utilisable en production. */
const DEV_SECRET = "africaskills-dev-secret-change-me-32-chars";

/**
 * Clé de signature HS256.
 * En production, JWT_SECRET est OBLIGATOIRE, distinct du secret de dev
 * et suffisamment long (≥ 32 caractères) — sinon on refuse de signer/
 * vérifier (un secret par défaut permettrait de forger des tokens).
 */
function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET || DEV_SECRET;
  if (process.env.NODE_ENV === "production") {
    if (!process.env.JWT_SECRET || secret === DEV_SECRET) {
      throw new Error(
        "JWT_SECRET est obligatoire en production et ne doit pas être la valeur de développement"
      );
    }
    if (secret.length < 32) {
      throw new Error("JWT_SECRET doit faire au moins 32 caractères en production");
    }
  }
  return new TextEncoder().encode(secret);
}

/**
 * Signe un access token (15 min).
 */
export async function signAccessToken(payload: {
  userId: string;
  email?: string | null;
  phone?: string | null;
  role: string;
  sessionId: string;
}): Promise<string> {
  return new SignJWT({
    sub: payload.userId,
    email: payload.email ?? undefined,
    phone: payload.phone ?? undefined,
    role: payload.role,
    type: "access",
    sessionId: payload.sessionId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_TTL)
    .setIssuer("africaskills")
    .sign(getSecret());
}

/**
 * Signe un refresh token (7 jours).
 */
export async function signRefreshToken(payload: {
  userId: string;
  sessionId: string;
}): Promise<string> {
  return new SignJWT({
    sub: payload.userId,
    type: "refresh",
    sessionId: payload.sessionId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(REFRESH_TOKEN_TTL)
    .setIssuer("africaskills")
    .sign(getSecret());
}

/**
 * Vérifie un JWT (access ou refresh).
 */
export async function verifyToken<T extends JWTPayload = AuthPayload>(
  token: string
): Promise<T> {
  const { payload } = await jwtVerify(token, getSecret(), {
    issuer: "africaskills",
  });
  return payload as T;
}
