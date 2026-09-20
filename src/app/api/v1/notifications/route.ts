// ============================================================
// /api/v1/notifications
// GET   — Mes notifications (50 dernières) + compteur non lues
// PATCH — Marquer comme lues : { id } | { ids: [] } | { all: true }
// ============================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { requireUser, AuthError } from "@/lib/auth";

export const dynamic = "force-dynamic";

const markReadSchema = z.object({
  id: z.string().uuid().optional(),
  ids: z.array(z.string().uuid()).max(100).optional(),
  all: z.literal(true).optional(),
});

/**
 * GET /api/v1/notifications
 * Retourne les 50 dernières notifications et le nombre de non lues.
 */
export async function GET() {
  try {
    const current = await requireUser();

    const [items, [unread]] = await Promise.all([
      db
        .select({
          id: notifications.id,
          type: notifications.type,
          title: notifications.title,
          body: notifications.body,
          href: notifications.href,
          readAt: notifications.readAt,
          createdAt: notifications.createdAt,
        })
        .from(notifications)
        .where(eq(notifications.userId, current.userId))
        .orderBy(desc(notifications.createdAt))
        .limit(50),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, current.userId),
            isNull(notifications.readAt)
          )
        ),
    ]);

    return NextResponse.json({
      ok: true,
      notifications: items,
      unreadCount: unread?.count ?? 0,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: error.status }
      );
    }
    console.error("notifications GET error:", error);
    return NextResponse.json(
      { ok: false, error: "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/v1/notifications
 * Marque des notifications comme lues (readAt = now).
 * Corps accepté : { id } (une seule), { ids: [...] } (liste)
 * ou { all: true } (toutes les non lues de l'utilisateur).
 */
export async function PATCH(req: Request) {
  try {
    const current = await requireUser();

    const body = await req.json().catch(() => ({}));
    const parsed = markReadSchema.safeParse(body);
    if (!parsed.success || (!parsed.data.id && !parsed.data.ids && !parsed.data.all)) {
      return NextResponse.json(
        { ok: false, error: "Corps invalide : fournir id, ids ou all" },
        { status: 400 }
      );
    }

    const now = new Date();
    const baseWhere = and(
      eq(notifications.userId, current.userId),
      isNull(notifications.readAt)
    );

    let updated;
    if (parsed.data.all) {
      updated = await db
        .update(notifications)
        .set({ readAt: now })
        .where(baseWhere)
        .returning({ id: notifications.id });
    } else {
      const ids = parsed.data.ids ?? [parsed.data.id!];
      updated = await db
        .update(notifications)
        .set({ readAt: now })
        .where(and(baseWhere, inArray(notifications.id, ids)))
        .returning({ id: notifications.id });
    }

    return NextResponse.json({ ok: true, markedRead: updated.length });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: error.status }
      );
    }
    console.error("notifications PATCH error:", error);
    return NextResponse.json(
      { ok: false, error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
