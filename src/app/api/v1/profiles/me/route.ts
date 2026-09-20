// ============================================================
// /api/v1/profiles/me
// GET    — Récupère le profil courant
// PATCH  — Met à jour le profil
// DELETE — Supprime le compte
// ============================================================

import { NextResponse } from "next/server";
import { db } from "@/db";
import { users, sessions, otpCodes, payments } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  requireUser,
  AuthError,
  updateProfileSchema,
  clearAuthCookies,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const current = await requireUser();

    const [profile] = await db
      .select({
        id: users.id,
        email: users.email,
        phone: users.phone,
        fullName: users.fullName,
        role: users.role,
        status: users.status,
        country: users.country,
        city: users.city,
        avatarUrl: users.avatarUrl,
        coverUrl: users.coverUrl,
        bio: users.bio,
        birthDate: users.birthDate,
        website: users.website,
        twitter: users.twitter,
        linkedin: users.linkedin,
        github: users.github,
        emailVerified: users.emailVerified,
        phoneVerified: users.phoneVerified,
        twoFactorEnabled: users.twoFactorEnabled,
        isVerifiedIdentity: users.isVerifiedIdentity,
        xp: users.xp,
        streak: users.streak,
        englishLevel: users.englishLevel,
        lastLoginAt: users.lastLoginAt,
        lastActivityAt: users.lastActivityAt,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, current.userId))
      .limit(1);

    if (!profile) {
      return NextResponse.json(
        { ok: false, error: "Profil introuvable" },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, profile });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: error.status }
      );
    }
    return NextResponse.json({ ok: false, error: "Erreur serveur" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const current = await requireUser();
    const body = await req.json();
    const parsed = updateProfileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Données invalides", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data: any = { ...parsed.data, updatedAt: new Date() };
    if (data.birthDate) data.birthDate = new Date(data.birthDate);

    await db.update(users).set(data).where(eq(users.id, current.userId));

    const [updated] = await db
      .select()
      .from(users)
      .where(eq(users.id, current.userId))
      .limit(1);

    return NextResponse.json({
      ok: true,
      profile: updated,
      message: "Profil mis à jour",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: error.status }
      );
    }
    return NextResponse.json({ ok: false, error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const current = await requireUser();
    const body = await req.json().catch(() => ({}));
    if (body.confirm !== "DELETE") {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Confirmation requise. Envoie { confirm: 'DELETE' } pour supprimer ton compte.",
        },
        { status: 400 }
      );
    }

    // Suppression en cascade : sessions, otp, etc.
    await db.delete(sessions).where(eq(sessions.userId, current.userId));
    await db.delete(otpCodes).where(eq(otpCodes.userId, current.userId));
    await db.delete(users).where(eq(users.id, current.userId));

    await clearAuthCookies();

    return NextResponse.json({
      ok: true,
      message: "Compte supprimé. Au revoir 👋",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: error.status }
      );
    }
    return NextResponse.json({ ok: false, error: "Erreur serveur" }, { status: 500 });
  }
}
