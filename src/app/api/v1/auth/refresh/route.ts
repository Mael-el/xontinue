// ============================================================
// POST /api/v1/auth/refresh
// Rafraîchit l'access token avec le refresh token
// ============================================================

import { NextResponse } from "next/server";
import { db } from "@/db";
import { users, sessions } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import {
  verifyToken,
  signAccessToken,
  signRefreshToken,
  hashToken,
  setAuthCookies,
  getRefreshToken,
  type AuthPayload,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const refreshToken = await getRefreshToken();
    if (!refreshToken) {
      return NextResponse.json(
        { ok: false, error: "Refresh token manquant" },
        { status: 401 }
      );
    }

    // Vérifier le token
    let payload: AuthPayload;
    try {
      payload = await verifyToken<AuthPayload>(refreshToken);
    } catch {
      return NextResponse.json(
        { ok: false, error: "Refresh token invalide" },
        { status: 401 }
      );
    }

    if (payload.type !== "refresh" || !payload.sub || !payload.sessionId) {
      return NextResponse.json(
        { ok: false, error: "Token non-refresh" },
        { status: 401 }
      );
    }

    // Vérifier la session en DB
    const hash = await hashToken(refreshToken);
    const [session] = await db
      .select()
      .from(sessions)
      .where(
        and(
          eq(sessions.id, payload.sessionId),
          eq(sessions.refreshTokenHash, hash)
        )
      )
      .limit(1);

    if (!session || session.expiresAt < new Date()) {
      return NextResponse.json(
        { ok: false, error: "Session expirée" },
        { status: 401 }
      );
    }

    // Récupérer l'utilisateur
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, payload.sub))
      .limit(1);

    if (!user || user.status !== "active") {
      return NextResponse.json(
        { ok: false, error: "Compte invalide" },
        { status: 401 }
      );
    }

    // Générer de nouveaux tokens (rotation)
    const newRefresh = await signRefreshToken({
      userId: user.id,
      sessionId: session.id,
    });
    const newHash = await hashToken(newRefresh);
    await db
      .update(sessions)
      .set({
        refreshTokenHash: newHash,
        lastUsedAt: new Date(),
      })
      .where(eq(sessions.id, session.id));

    const newAccess = await signAccessToken({
      userId: user.id,
      email: user.email,
      phone: user.phone,
      role: user.role,
      sessionId: session.id,
    });

    await setAuthCookies({
      accessToken: newAccess,
      refreshToken: newRefresh,
    });

    return NextResponse.json({
      ok: true,
      accessToken: newAccess,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    });
  } catch (error) {
    console.error("refresh error:", error);
    return NextResponse.json({ ok: false, error: "Erreur serveur" }, { status: 500 });
  }
}
