// ============================================================
// POST /api/v1/auth/reset-password
// Réinitialise le mot de passe avec un token
// ============================================================

import { NextResponse } from "next/server";
import { db } from "@/db";
import { users, passwordResets, sessions } from "@/db/schema";
import { eq, gt } from "drizzle-orm";
import {
  resetPasswordSchema,
  hashPassword,
  hashToken,
  checkRateLimit,
  getClientIp,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rl = checkRateLimit(`reset:${ip}`, 5, 15 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      { ok: false, error: "Trop de tentatives" },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();
    const parsed = resetPasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Données invalides", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { token, newPassword } = parsed.data;
    const tokenHash = await hashToken(token);

    const [reset] = await db
      .select()
      .from(passwordResets)
      .where(eq(passwordResets.tokenHash, tokenHash))
      .limit(1);

    if (!reset || reset.usedAt || reset.expiresAt < new Date()) {
      return NextResponse.json(
        { ok: false, error: "Token invalide ou expiré" },
        { status: 400 }
      );
    }

    const passwordHash = await hashPassword(newPassword);

    // Mise à jour atomique : password + invalidation token
    await db
      .update(users)
      .set({
        passwordHash,
        failedAttempts: 0,
        lockedUntil: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, reset.userId));

    await db
      .update(passwordResets)
      .set({ usedAt: new Date() })
      .where(eq(passwordResets.id, reset.id));

    // Invalider TOUTES les sessions actives
    await db.delete(sessions).where(eq(sessions.userId, reset.userId));

    return NextResponse.json({
      ok: true,
      message: "Mot de passe réinitialisé. Tu peux te reconnecter.",
    });
  } catch (error) {
    console.error("reset-password error:", error);
    return NextResponse.json({ ok: false, error: "Erreur serveur" }, { status: 500 });
  }
}
