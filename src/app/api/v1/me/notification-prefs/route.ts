// ============================================================
// GET  /api/v1/me/notification-prefs → mes préférences (fusion
//        défauts + override utilisateur)
// PATCH /api/v1/me/notification-prefs { learning?|applications?|
//        payments? } → sauvegarder (valeurs manquantes conservées)
// ============================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireUser, AuthError } from "@/lib/auth";
import {
  DEFAULT_NOTIFICATION_PREFS,
  getNotificationPrefs,
} from "@/lib/notifications";

export const dynamic = "force-dynamic";

const patchSchema = z
  .object({
    learning: z.boolean(),
    applications: z.boolean(),
    payments: z.boolean(),
  })
  .partial()
  .refine((obj) => Object.keys(obj).length > 0, {
    message: "Aucune préférence fournie",
  });

export async function GET() {
  try {
    const current = await requireUser();
    const prefs = await getNotificationPrefs(current.userId);
    return NextResponse.json({ ok: true, prefs, defaults: DEFAULT_NOTIFICATION_PREFS });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: error.status }
      );
    }
    console.error("notification-prefs GET error:", error);
    return NextResponse.json(
      { ok: false, error: "Erreur serveur" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const current = await requireUser();

    const body = await req.json().catch(() => ({}));
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Préférences invalides", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Fusion : on conserve les préférences non fournies
    const merged = {
      ...(await getNotificationPrefs(current.userId)),
      ...parsed.data,
    };

    await db
      .update(users)
      .set({ notificationPrefs: merged, updatedAt: new Date() })
      .where(eq(users.id, current.userId));

    return NextResponse.json({ ok: true, prefs: merged });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: error.status }
      );
    }
    console.error("notification-prefs PATCH error:", error);
    return NextResponse.json(
      { ok: false, error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
