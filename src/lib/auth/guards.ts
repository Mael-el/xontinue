// ============================================================
// MIDDLEWARE — Récupération de l'utilisateur courant
// Utilisé dans les Server Components + Route Handlers.
// ============================================================

import { cookies } from "next/headers";
import { verifyToken, type AuthPayload } from "./jwt";

export interface CurrentUser {
  userId: string;
  email?: string;
  phone?: string;
  role: string;
  sessionId: string;
}

/**
 * Récupère l'utilisateur authentifié depuis le cookie `as_access`.
 * Retourne `null` si pas de token ou token invalide.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("as_access")?.value;
    if (!token) return null;

    const payload = await verifyToken<AuthPayload>(token);
    if (payload.type !== "access") return null;
    if (!payload.sub || !payload.sessionId) return null;

    return {
      userId: payload.sub,
      email: payload.email,
      phone: payload.phone,
      role: payload.role,
      sessionId: payload.sessionId,
    };
  } catch {
    return null;
  }
}

/**
 * Exige un utilisateur authentifié. Lance une erreur sinon.
 */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new AuthError("Authentification requise", 401);
  }
  return user;
}

/**
 * Exige un rôle spécifique.
 */
export async function requireRole(
  ...roles: Array<"student" | "instructor" | "mentor" | "company" | "admin">
): Promise<CurrentUser> {
  const user = await requireUser();
  if (!roles.includes(user.role as any)) {
    throw new AuthError("Accès refusé", 403);
  }
  return user;
}

export class AuthError extends Error {
  constructor(
    message: string,
    public status: number = 401
  ) {
    super(message);
  }
}
