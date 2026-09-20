// ============================================================
// POST /api/v1/auth/register/phone
// Inscription par téléphone — renvoie un OTP SMS
// ============================================================

import { NextResponse } from "next/server";
import { db } from "@/db";
import { users, otpCodes } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  registerPhoneSchema,
  hashPassword,
  generateOtp,
  OTP_TTL_MS,
  checkRateLimit,
  getClientIp,
} from "@/lib/auth";
import { sendSms, otpSmsTemplate } from "@/lib/messaging/sms";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const ip = getClientIp(req);

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
    const parsed = registerPhoneSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Données invalides", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { phone, fullName, password, role, country } = parsed.data;
    const normalizedPhone = phone.replace(/\s/g, "");

    // Vérifier unicité phone
    const [existing] = await db
      .select({
        id: users.id,
        status: users.status,
        phoneVerified: users.phoneVerified,
      })
      .from(users)
      .where(eq(users.phone, normalizedPhone))
      .limit(1);

    if (existing) {
      if (existing.status === "pending" && !existing.phoneVerified) {
        const otp = generateOtp();
        await db.insert(otpCodes).values({
          userId: existing.id,
          code: otp,
          type: "phone_verification",
          target: normalizedPhone,
          expiresAt: new Date(Date.now() + OTP_TTL_MS),
        });

        // Envoi réel (Africa's Talking si configuré, console en dev)
        void sendSms({ to: normalizedPhone, message: otpSmsTemplate(otp) });

        return NextResponse.json({
          ok: true,
          userId: existing.id,
          phone: normalizedPhone,
          message: "Compte en attente. Un nouveau code OTP a été envoyé par SMS.",
          devOtp: process.env.NODE_ENV !== "production" ? otp : undefined,
        });
      }

      return NextResponse.json(
        { ok: false, error: "Un compte existe déjà avec ce numéro" },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);

    const [user] = await db
      .insert(users)
      .values({
        phone: normalizedPhone,
        fullName,
        passwordHash,
        role,
        country: country ?? "Bénin",
        status: "pending",
        phoneVerified: false,
      })
      .returning();

    const otp = generateOtp();
    await db.insert(otpCodes).values({
      userId: user.id,
      code: otp,
      type: "phone_verification",
      target: normalizedPhone,
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    });

    // Envoi réel (Africa's Talking si configuré, console en dev) —
    // best-effort : l'inscription ne doit pas dépendre du provider SMS.
    void sendSms({ to: normalizedPhone, message: otpSmsTemplate(otp) });

    return NextResponse.json({
      ok: true,
      userId: user.id,
      phone: normalizedPhone,
      message: "Compte créé. Vérifie ton téléphone avec le code OTP reçu.",
      devOtp: process.env.NODE_ENV !== "production" ? otp : undefined,
    });
  } catch (error) {
    console.error("register/phone error:", error);
    return NextResponse.json({ ok: false, error: "Erreur serveur" }, { status: 500 });
  }
}
