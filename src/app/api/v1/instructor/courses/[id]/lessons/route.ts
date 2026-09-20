// ============================================================
// INSTRUCTOR · LEÇONS d'une formation (propriétaire uniquement)
// GET  → liste ordonnée des leçons
// POST → ajouter une leçon (ordre = à la suite, durée du cours
//        recalculée automatiquement)
// ============================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { lessons } from "@/db/schema";
import { asc, eq, sql } from "drizzle-orm";
import { requireRole, AuthError } from "@/lib/auth";
import { getOwnedCourse, syncCourseDuration } from "@/lib/instructor";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export const lessonSchema = z.object({
  title: z.string().trim().min(3, "Titre trop court").max(200),
  content: z.string().trim().max(20000).optional().or(z.literal("")),
  videoUrl: z
    .string()
    .trim()
    .url("URL vidéo invalide")
    .max(500)
    .optional()
    .or(z.literal("")),
  durationMinutes: z.number().int().min(0).max(600).default(10),
});

export async function GET(_req: Request, { params }: RouteContext) {
  try {
    const current = await requireRole("instructor", "admin");
    const { id } = await params;

    const owned = await getOwnedCourse(id, current.userId);
    if (!owned) {
      return NextResponse.json(
        { ok: false, error: "Formation introuvable" },
        { status: 404 }
      );
    }

    const rows = await db
      .select()
      .from(lessons)
      .where(eq(lessons.courseId, id))
      .orderBy(asc(lessons.order), asc(lessons.createdAt));

    return NextResponse.json({ ok: true, lessons: rows });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: error.status }
      );
    }
    console.error("instructor lessons GET error:", error);
    return NextResponse.json(
      { ok: false, error: "Erreur serveur" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request, { params }: RouteContext) {
  try {
    const current = await requireRole("instructor", "admin");
    const { id } = await params;

    const owned = await getOwnedCourse(id, current.userId);
    if (!owned) {
      return NextResponse.json(
        { ok: false, error: "Formation introuvable" },
        { status: 404 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const parsed = lessonSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Données invalides", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const input = parsed.data;

    // Prochain ordre = max + 1
    const [maxRow] = await db
      .select({ maxOrder: sql<number>`coalesce(max(${lessons.order}), 0)::int` })
      .from(lessons)
      .where(eq(lessons.courseId, id));

    const [created] = await db
      .insert(lessons)
      .values({
        courseId: id,
        title: input.title,
        content: input.content || null,
        videoUrl: input.videoUrl || null,
        order: (maxRow?.maxOrder ?? 0) + 1,
        durationMinutes: input.durationMinutes,
      })
      .returning();

    await syncCourseDuration(id);

    return NextResponse.json(
      { ok: true, lesson: created, message: "Leçon ajoutée ✅" },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: error.status }
      );
    }
    console.error("instructor lessons POST error:", error);
    return NextResponse.json(
      { ok: false, error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
