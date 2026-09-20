// ============================================================
// POST /api/v1/auth/register/email
// Inscription par email — renvoie un OTP de vérification
// ============================================================

import { NextResponse } from "next/server";
import { db } from "@/db";
import { users, otpCodes } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  registerEmailSchema,
  hashPassword,
  generateOtp,
  OTP_TTL_MS,
  checkRateLimit,
  getClientIp,
} from "@/lib/auth";
import { sendEmail, otpEmailTemplate } from "@/lib/messaging/email";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const ip = getClientIp(req);

  // Rate limit : 5 inscriptions / 15 min par IP
  const rl = checkRateLimit(`register:${ip}`, 5, 15 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      {
        ok: false,
        error: "Trop de tentatives. Réessaie dans 15 minutes.",
        retryAfterMs: rl.retryAfterMs,
      },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();
    const parsed = registerEmailSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Données invalides", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { email, fullName, password, role, country } = parsed.data;

    // Vérifier unicité email
    const [existing] = await db
      .select({
        id: users.id,
        status: users.status,
        emailVerified: users.emailVerified,
      })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existing) {
      if (existing.status === "pending" && !existing.emailVerified) {
        const otp = generateOtp();
        await db.insert(otpCodes).values({
          userId: existing.id,
          code: otp,
          type: "email_verification",
          target: email,
          expiresAt: new Date(Date.now() + OTP_TTL_MS),
        });

        // Envoi réel (Resend si configuré, console en dev) — best-effort
        const tpl = otpEmailTemplate(otp, "Confirme ton email");
        void sendEmail({ to: email, ...tpl });

        return NextResponse.json({
          ok: true,
          userId: existing.id,
          email,
          message: "Compte en attente. Un nouveau code OTP a été envoyé.",
          devOtp: process.env.NODE_ENV !== "production" ? otp : undefined,
        });
      }

      return NextResponse.json(
        { ok: false, error: "Un compte existe déjà avec cet email" },
        { status: 409 }
      );
    }

    // Hash du mot de passe
    const passwordHash = await hashPassword(password);

    // Créer l'utilisateur (status = pending jusqu'à vérification email)
    const [user] = await db
      .insert(users)
      .values({
        email,
        fullName,
        passwordHash,
        role,
        country: country ?? "Bénin",
        status: "pending",
        emailVerified: false,
      })
      .returning();

    // Générer un OTP de vérification email
    const otp = generateOtp();
    await db.insert(otpCodes).values({
      userId: user.id,
      code: otp,
      type: "email_verification",
      target: email,
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    });

    // Envoi réel (Resend si configuré, console en dev) — best-effort :
    // l'inscription ne doit pas échouer si le provider email est en panne.
    const tpl = otpEmailTemplate(otp, "Bienvenue sur AfricaSkills 🎉");
    void sendEmail({ to: email, ...tpl });

    return NextResponse.json({
      ok: true,
      userId: user.id,
      email,
      message: "Compte créé. Vérifie ton email avec le code OTP reçu.",
      // En dev seulement — à retirer en prod
      devOtp: process.env.NODE_ENV !== "production" ? otp : undefined,
    });
  } catch (error) {
    console.error("register/email error:", error);
    return NextResponse.json(
      { ok: false, error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
