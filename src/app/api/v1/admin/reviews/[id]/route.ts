// ============================================================
// DELETE /api/v1/admin/reviews/[id]
// Modération : supprime un avis et recalcule la note du cours
// — **admin uniquement**.
// ============================================================

import { NextResponse } from "next/server";
import { db } from "@/db";
import { courseReviews } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireRole, AuthError } from "@/lib/auth";
import { refreshCourseRating } from "@/lib/reviews";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, { params }: RouteContext) {
  try {
    await requireRole("admin");
    const { id } = await params;

    const deleted = await db
      .delete(courseReviews)
      .where(eq(courseReviews.id, id))
      .returning({ courseId: courseReviews.courseId });

    if (deleted.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Avis introuvable" },
        { status: 404 }
      );
    }

    // La note du cours doit refléter la suppression
    await refreshCourseRating(deleted[0].courseId);

    return NextResponse.json({ ok: true, deleted: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: error.status }
      );
    }
    console.error("admin reviews DELETE error:", error);
    return NextResponse.json(
      { ok: false, error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
