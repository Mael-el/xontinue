// ============================================================
// INSTRUCTOR · LEÇON [lessonId] (propriétaire uniquement)
// DELETE → supprimer la leçon (durée du cours recalculée)
// ============================================================

import { NextResponse } from "next/server";
import { db } from "@/db";
import { lessons } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { requireRole, AuthError } from "@/lib/auth";
import { getOwnedCourse, syncCourseDuration } from "@/lib/instructor";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string; lessonId: string }> };

export async function DELETE(_req: Request, { params }: RouteContext) {
  try {
    const current = await requireRole("instructor", "admin");
    const { id, lessonId } = await params;

    const owned = await getOwnedCourse(id, current.userId);
    if (!owned) {
      return NextResponse.json(
        { ok: false, error: "Formation introuvable" },
        { status: 404 }
      );
    }

    const deleted = await db
      .delete(lessons)
      .where(and(eq(lessons.id, lessonId), eq(lessons.courseId, id)))
      .returning({ id: lessons.id });

    if (deleted.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Leçon introuvable" },
        { status: 404 }
      );
    }

    await syncCourseDuration(id);

    return NextResponse.json({ ok: true, deleted: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: error.status }
      );
    }
    console.error("instructor lesson DELETE error:", error);
    return NextResponse.json(
      { ok: false, error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
