// ============================================================
// POST /api/v1/auth/forgot-password
// Envoie un lien de reset par email (ou SMS)
// ============================================================

import { NextResponse } from "next/server";
import { db } from "@/db";
import { users, passwordResets } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  forgotPasswordSchema,
  generateSecureToken,
  hashToken,
  checkRateLimit,
  getClientIp,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Durée de validité du token de reset : 1 heure */
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rl = checkRateLimit(`forgot:${ip}`, 3, 15 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      { ok: false, error: "Trop de demandes. Réessaie plus tard." },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();
    const parsed = forgotPasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Email invalide" },
        { status: 400 }
      );
    }

    const { email } = parsed.data;

    // Toujours répondre OK pour ne pas divulguer l'existence du compte
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (user) {
      const token = generateSecureToken(32);
      const tokenHash = await hashToken(token);

      // Invalider tous les anciens tokens de reset
      await db.delete(passwordResets).where(eq(passwordResets.userId, user.id));

      await db.insert(passwordResets).values({
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      });

      // En production : envoi via Resend avec le lien contenant `token`
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
      const resetLink = `${baseUrl}/auth/reset-password?token=${token}`;
      console.log(`[DEV] Reset password link pour ${email} : ${resetLink}`);
    }

    return NextResponse.json({
      ok: true,
      message: "Si un compte existe avec cet email, un lien a été envoyé.",
    });
  } catch (error) {
    console.error("forgot-password error:", error);
    return NextResponse.json({ ok: false, error: "Erreur serveur" }, { status: 500 });
  }
}
