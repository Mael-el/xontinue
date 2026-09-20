// ============================================================
// POST /api/v1/auth/login
// Connexion email/téléphone + mot de passe (+ 2FA optionnel)
// ============================================================

import { NextResponse } from "next/server";
import { db } from "@/db";
import { users, sessions } from "@/db/schema";
import { eq, or, sql } from "drizzle-orm";
import {
  loginSchema,
  verifyPassword,
  signAccessToken,
  signRefreshToken,
  hashToken,
  setAuthCookies,
  checkRateLimit,
  resetRateLimit,
  recordFailedAttempt,
  getClientIp,
  parseUserAgent,
  isSuspiciousLogin,
  verifyTotp,
} from "@/lib/auth";
import { REFRESH_TOKEN_TTL_SECONDS } from "@/lib/auth/jwt";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const ua = req.headers.get("user-agent");

  // Rate limit : 5 tentatives / 15 min par IP
  const rl = checkRateLimit(`login:${ip}`, 10, 15 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      {
        ok: false,
        error: "Trop de tentatives de connexion. Réessaie dans 15 minutes.",
        retryAfterMs: rl.retryAfterMs,
      },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Données invalides", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { identifier, password, totpCode } = parsed.data;
    const normalizedId = identifier.trim().toLowerCase();

    // Recherche par email OU téléphone
    const [user] = await db
      .select()
      .from(users)
      .where(
        or(
          eq(users.email, normalizedId),
          eq(users.phone, identifier.replace(/\s/g, ""))
        )
      )
      .limit(1);

    if (!user || !user.passwordHash) {
      return NextResponse.json(
        { ok: false, error: "Identifiants incorrects" },
        { status: 401 }
      );
    }

    // Vérifier le blocage
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const remainingMs = user.lockedUntil.getTime() - Date.now();
      return NextResponse.json(
        {
          ok: false,
          error: `Compte verrouillé. Réessaie dans ${Math.ceil(
            remainingMs / 60000
          )} minutes.`,
        },
        { status: 423 }
      );
    }

    // Vérifier le statut
    if (user.status === "banned") {
      return NextResponse.json(
        { ok: false, error: "Compte banni. Contacte le support." },
        { status: 403 }
      );
    }

    // Vérifier le mot de passe
    const passwordOk = await verifyPassword(password, user.passwordHash);
    if (!passwordOk) {
      // Incrémenter les échecs
      const attempts = user.failedAttempts + 1;
      const updates: any = { failedAttempts: attempts };
      if (attempts >= 10) {
        updates.lockedUntil = new Date(Date.now() + 30 * 60 * 1000);
      }
      await db.update(users).set(updates).where(eq(users.id, user.id));
      recordFailedAttempt(`login-fail:${user.id}`);
      return NextResponse.json(
        {
          ok: false,
          error: "Identifiants incorrects",
          remainingAttempts: Math.max(0, 10 - attempts),
        },
        { status: 401 }
      );
    }

    // 2FA si activé
    if (user.twoFactorEnabled && user.twoFactorSecret) {
      if (!totpCode) {
        return NextResponse.json(
          {
            ok: false,
            error: "2FA requis",
            require2fa: true,
            userId: user.id,
          },
          { status: 401 }
        );
      }
      const totpOk = await verifyTotp(totpCode, user.twoFactorSecret);
      if (!totpOk) {
        return NextResponse.json(
          { ok: false, error: "Code 2FA invalide" },
          { status: 401 }
        );
      }
    }

    // Réinitialiser les échecs
    await db
      .update(users)
      .set({
        failedAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
        lastLoginIp: ip,
        lastLoginDevice: ua,
        lastActivityAt: new Date(),
      })
      .where(eq(users.id, user.id));

    resetRateLimit(`login:${ip}`);
    resetRateLimit(`login-fail:${user.id}`);

    // Détection connexion suspecte
    const { device, os, browser } = parseUserAgent(ua);
    const suspicious = isSuspiciousLogin({
      previousIp: user.lastLoginIp,
      currentIp: ip,
      previousCountry: user.country,
      currentCountry: user.country, // en prod : géolocalisation
    });

    // Créer la session
    const refreshToken = await signRefreshToken({
      userId: user.id,
      sessionId: "", // sera rempli après insert
    });
    const refreshTokenHash = await hashToken(refreshToken);

    const [session] = await db
      .insert(sessions)
      .values({
        userId: user.id,
        refreshTokenHash,
        device,
        os,
        browser,
        ip,
        country: user.country,
        userAgent: ua,
        isCurrent: true,
        isSuspicious: suspicious,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000),
      })
      .returning();

    // Régénérer avec le sessionId
    const finalRefreshToken = await signRefreshToken({
      userId: user.id,
      sessionId: session.id,
    });
    const finalHash = await hashToken(finalRefreshToken);
    await db
      .update(sessions)
      .set({ refreshTokenHash: finalHash })
      .where(eq(sessions.id, session.id));

    const accessToken = await signAccessToken({
      userId: user.id,
      email: user.email,
      phone: user.phone,
      role: user.role,
      sessionId: session.id,
    });

    // Poser les cookies
    await setAuthCookies({
      accessToken,
      refreshToken: finalRefreshToken,
    });

    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        fullName: user.fullName,
        role: user.role,
        avatarUrl: user.avatarUrl,
        emailVerified: user.emailVerified,
        phoneVerified: user.phoneVerified,
        twoFactorEnabled: user.twoFactorEnabled,
      },
      sessionId: session.id,
      suspicious,
      message: suspicious
        ? "Connexion détectée depuis un nouvel appareil. Vérifie ta sécurité."
        : "Connexion réussie",
    });
  } catch (error) {
    console.error("login error:", error);
    return NextResponse.json({ ok: false, error: "Erreur serveur" }, { status: 500 });
  }
}
