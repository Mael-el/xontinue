// ============================================================
// POST /api/v1/auth/logout
// Déconnexion — supprime la session courante + cookies
// ============================================================

import { NextResponse } from "next/server";
import { db } from "@/db";
import { sessions } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  getCurrentUser,
  clearAuthCookies,
  getRefreshToken,
  hashToken,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const user = await getCurrentUser();
    const refreshToken = await getRefreshToken();

    // Supprimer la session en DB
    if (user?.sessionId) {
      await db.delete(sessions).where(eq(sessions.id, user.sessionId));
    } else if (refreshToken) {
      const hash = await hashToken(refreshToken);
      await db.delete(sessions).where(eq(sessions.refreshTokenHash, hash));
    }

    await clearAuthCookies();

    return NextResponse.json({ ok: true, message: "Déconnecté" });
  } catch (error) {
    console.error("logout error:", error);
    await clearAuthCookies();
    return NextResponse.json({ ok: true, message: "Déconnecté" });
  }
}
