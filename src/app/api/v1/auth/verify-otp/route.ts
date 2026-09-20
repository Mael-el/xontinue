// ============================================================
// POST /api/v1/auth/verify-otp
// Vérification d'un OTP (email, phone, password_reset, 2fa)
// ============================================================

import { NextResponse } from "next/server";
import { db } from "@/db";
import { users, otpCodes, sessions } from "@/db/schema";
import { eq, and, gt, desc } from "drizzle-orm";
import {
  verifyOtpSchema,
  verifyOtp as verifyOtpCode,
  OTP_MAX_ATTEMPTS,
  checkRateLimit,
  getClientIp,
  signAccessToken,
  signRefreshToken,
  hashToken,
  setAuthCookies,
  parseUserAgent,
} from "@/lib/auth";
import { REFRESH_TOKEN_TTL_SECONDS } from "@/lib/auth/jwt";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rl = checkRateLimit(`verify-otp:${ip}`, 10, 15 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      { ok: false, error: "Trop de tentatives", retryAfterMs: rl.retryAfterMs },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();
    const parsed = verifyOtpSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Données invalides", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { userId, code, type } = parsed.data;

    // Récupérer le dernier OTP non expiré pour ce user/type
    const [otpEntry] = await db
      .select()
      .from(otpCodes)
      .where(
        and(
          eq(otpCodes.userId, userId),
          eq(otpCodes.type, type),
          eq(otpCodes.verified, false),
          gt(otpCodes.expiresAt, new Date())
        )
      )
      .orderBy(desc(otpCodes.createdAt))
      .limit(1);

    if (!otpEntry) {
      return NextResponse.json(
        { ok: false, error: "Aucun OTP valide. Renvoie un nouveau code." },
        { status: 404 }
      );
    }

    // Incrémenter le compteur de tentatives
    await db
      .update(otpCodes)
      .set({ attempts: otpEntry.attempts + 1 })
      .where(eq(otpCodes.id, otpEntry.id));

    if (otpEntry.attempts >= OTP_MAX_ATTEMPTS) {
      return NextResponse.json(
        { ok: false, error: "Trop de tentatives. Renvoie un nouveau code." },
        { status: 429 }
      );
    }

    // Vérifier le code
    if (!verifyOtpCode(code, otpEntry.code)) {
      return NextResponse.json(
        { ok: false, error: "Code OTP incorrect" },
        { status: 400 }
      );
    }

    // Marquer l'OTP comme vérifié
    await db
      .update(otpCodes)
      .set({ verified: true })
      .where(eq(otpCodes.id, otpEntry.id));

    // Effet de bord selon le type
    if (type === "email_verification") {
      await db
        .update(users)
        .set({ emailVerified: true, status: "active" })
        .where(eq(users.id, userId));
    } else if (type === "phone_verification") {
      await db
        .update(users)
        .set({ phoneVerified: true, status: "active" })
        .where(eq(users.id, userId));
    }

    if (type === "email_verification" || type === "phone_verification") {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (user) {
        const ua = req.headers.get("user-agent");
        const { device, os, browser } = parseUserAgent(ua);

        const refreshToken = await signRefreshToken({
          userId: user.id,
          sessionId: "",
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
            isSuspicious: false,
            expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000),
          })
          .returning();

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

        await setAuthCookies({
          accessToken,
          refreshToken: finalRefreshToken,
        });
      }
    }

    return NextResponse.json({
      ok: true,
      verified: true,
      type,
      message: "Vérification réussie",
    });
  } catch (error) {
    console.error("verify-otp error:", error);
    return NextResponse.json({ ok: false, error: "Erreur serveur" }, { status: 500 });
  }
}
