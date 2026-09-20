// ============================================================
// COOKIES — Gestion centralisée des cookies d'auth
// ============================================================

import { cookies } from "next/headers";
import {
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
} from "./jwt";

const COOKIE_PREFIX = "as_"; // AfricaSkills
const IS_PROD = process.env.NODE_ENV === "production";

/**
 * Définit les cookies d'authentification (access + refresh).
 */
export async function setAuthCookies(params: {
  accessToken: string;
  refreshToken: string;
}): Promise<void> {
  const store = await cookies();

  store.set(`${COOKIE_PREFIX}access`, params.accessToken, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: "lax",
    path: "/",
    maxAge: ACCESS_TOKEN_TTL_SECONDS,
  });

  store.set(`${COOKIE_PREFIX}refresh`, params.refreshToken, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: "lax",
    path: "/",
    maxAge: REFRESH_TOKEN_TTL_SECONDS,
  });
}

/**
 * Supprime les cookies d'authentification (logout).
 */
export async function clearAuthCookies(): Promise<void> {
  const store = await cookies();
  store.delete(`${COOKIE_PREFIX}access`);
  store.delete(`${COOKIE_PREFIX}refresh`);
}

/**
 * Récupère le refresh token depuis les cookies.
 */
export async function getRefreshToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(`${COOKIE_PREFIX}refresh`)?.value ?? null;
}
