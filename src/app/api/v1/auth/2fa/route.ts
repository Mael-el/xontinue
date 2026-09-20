// ============================================================
// POST /api/v1/auth/2fa/setup — Génère le secret + QR
// POST /api/v1/auth/2fa/verify — Vérifie le code et active 2FA
// ============================================================

import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import QRCode from "qrcode";
import {
  requireUser,
  AuthError,
  generateTotpSecret,
  buildTotpUri,
  verifyTotp,
  verify2faSchema,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/auth/2fa/setup
 * Génère un nouveau secret TOTP et retourne le QR code en base64.
 * Le secret est stocké immédiatement (désactivé) en attendant vérification.
 */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const url = new URL(req.url);
    const action = url.searchParams.get("action") ?? "setup";

    if (action === "verify") {
      // Vérification du code pour activer 2FA
      const body = await req.json();
      const parsed = verify2faSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { ok: false, error: "Code invalide" },
          { status: 400 }
        );
      }

      const [dbUser] = await db
        .select({ twoFactorSecret: users.twoFactorSecret })
        .from(users)
        .where(eq(users.id, user.userId))
        .limit(1);

      if (!dbUser?.twoFactorSecret) {
        return NextResponse.json(
          { ok: false, error: "Aucun secret 2FA en attente. Appelle setup d'abord." },
          { status: 400 }
        );
      }

      const ok = await verifyTotp(parsed.data.code, dbUser.twoFactorSecret);
      if (!ok) {
        return NextResponse.json(
          { ok: false, error: "Code TOTP incorrect" },
          { status: 400 }
        );
      }

      await db
        .update(users)
        .set({ twoFactorEnabled: true })
        .where(eq(users.id, user.userId));

      return NextResponse.json({
        ok: true,
        message: "2FA activée avec succès",
        twoFactorEnabled: true,
      });
    }

    // SETUP : générer le secret
    const [dbUser] = await db
      .select({ email: users.email, phone: users.phone })
      .from(users)
      .where(eq(users.id, user.userId))
      .limit(1);

    const secret = generateTotpSecret();
    const accountName = dbUser?.email ?? dbUser?.phone ?? user.userId;
    const uri = buildTotpUri({ secret, accountName });

    // Stocker le secret (pas encore activé)
    await db
      .update(users)
      .set({ twoFactorSecret: secret, twoFactorEnabled: false })
      .where(eq(users.id, user.userId));

    // Générer le QR code en data URL
    const qrDataUrl = await QRCode.toDataURL(uri, {
      width: 280,
      margin: 2,
      color: { dark: "#F97316", light: "#FFFFFF" },
    });

    return NextResponse.json({
      ok: true,
      secret,
      uri,
      qrDataUrl,
      message:
        "Scanne le QR code avec Google Authenticator, puis vérifie avec /api/v1/auth/2fa?action=verify",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    console.error("2fa setup error:", error);
    return NextResponse.json({ ok: false, error: "Erreur serveur" }, { status: 500 });
  }
}
