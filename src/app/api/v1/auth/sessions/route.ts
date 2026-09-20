// ============================================================
// GET    /api/v1/auth/sessions — Liste des sessions actives
// DELETE /api/v1/auth/sessions?id=xxx — Supprime une session
// ============================================================

import { NextResponse } from "next/server";
import { db } from "@/db";
import { sessions } from "@/db/schema";
import { eq, and, gt, desc } from "drizzle-orm";
import { requireUser, AuthError } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireUser();

    const list = await db
      .select({
        id: sessions.id,
        device: sessions.device,
        os: sessions.os,
        browser: sessions.browser,
        ip: sessions.ip,
        country: sessions.country,
        isCurrent: sessions.isCurrent,
        isSuspicious: sessions.isSuspicious,
        lastUsedAt: sessions.lastUsedAt,
        expiresAt: sessions.expiresAt,
        createdAt: sessions.createdAt,
      })
      .from(sessions)
      .where(
        and(
          eq(sessions.userId, user.userId),
          gt(sessions.expiresAt, new Date())
        )
      )
      .orderBy(desc(sessions.lastUsedAt));

    return NextResponse.json({
      ok: true,
      sessions: list.map((s) => ({
        ...s,
        isCurrent: s.id === user.sessionId,
      })),
      count: list.length,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    return NextResponse.json({ ok: false, error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await requireUser();
    const url = new URL(req.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { ok: false, error: "id requis" },
        { status: 400 }
      );
    }

    // Sécurité : ne supprimer que ses propres sessions
    const [session] = await db
      .select({ id: sessions.id })
      .from(sessions)
      .where(and(eq(sessions.id, id), eq(sessions.userId, user.userId)))
      .limit(1);

    if (!session) {
      return NextResponse.json(
        { ok: false, error: "Session introuvable" },
        { status: 404 }
      );
    }

    await db.delete(sessions).where(eq(sessions.id, id));

    return NextResponse.json({ ok: true, message: "Session révoquée" });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    return NextResponse.json({ ok: false, error: "Erreur serveur" }, { status: 500 });
  }
}
