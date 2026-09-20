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

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET || "africaskills-dev-secret-change-me-32-chars";
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
