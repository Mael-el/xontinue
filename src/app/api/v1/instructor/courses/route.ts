// ============================================================
// INSTRUCTOR · FORMATIONS
// GET  /api/v1/instructor/courses → mes formations + stats + domaines
// POST /api/v1/instructor/courses → créer un brouillon
// Rôle requis : instructor (ou admin).
// ============================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { courses, domains } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireRole, AuthError } from "@/lib/auth";
import {
  getInstructorCourses,
  getInstructorStats,
  uniqueCourseSlug,
} from "@/lib/instructor";

export const dynamic = "force-dynamic";

export const courseSchema = z.object({
  title: z.string().trim().min(3, "Titre trop court").max(200),
  subtitle: z.string().trim().max(500).optional().or(z.literal("")),
  description: z.string().trim().max(8000).optional().or(z.literal("")),
  domainId: z.string().uuid("Domaine invalide"),
  level: z
    .enum(["beginner", "intermediate", "advanced", "expert"])
    .default("beginner"),
  priceXof: z.number().int().min(0).max(10_000_000).default(0),
  thumbnailUrl: z
    .string()
    .trim()
    .url("URL d'image invalide")
    .max(500)
    .optional()
    .or(z.literal("")),
  requirements: z
    .array(z.string().trim().min(1).max(200))
    .max(20)
    .default([]),
  whatYouLearn: z
    .array(z.string().trim().min(1).max(200))
    .max(20)
    .default([]),
});

export async function GET() {
  try {
    const current = await requireRole("instructor", "admin");

    const [mine, stats, domainList] = await Promise.all([
      getInstructorCourses(current.userId),
      getInstructorStats(current.userId),
      db
        .select({ id: domains.id, name: domains.name, icon: domains.icon })
        .from(domains)
        .orderBy(domains.name),
    ]);

    return NextResponse.json({
      ok: true,
      courses: mine,
      stats,
      domains: domainList,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: error.status }
      );
    }
    console.error("instructor courses GET error:", error);
    return NextResponse.json(
      { ok: false, error: "Erreur serveur" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const current = await requireRole("instructor", "admin");

    const body = await req.json().catch(() => ({}));
    const parsed = courseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Données invalides", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const input = parsed.data;

    // Le domaine doit exister
    const [domain] = await db
      .select({ id: domains.id })
      .from(domains)
      .where(eq(domains.id, input.domainId))
      .limit(1);
    if (!domain) {
      return NextResponse.json(
        { ok: false, error: "Domaine introuvable" },
        { status: 400 }
      );
    }

    const slug = await uniqueCourseSlug(input.title);

    const [created] = await db
      .insert(courses)
      .values({
        slug,
        title: input.title,
        subtitle: input.subtitle || null,
        description: input.description || null,
        domainId: input.domainId,
        instructorId: current.userId,
        level: input.level,
        priceXof: input.priceXof,
        thumbnailUrl: input.thumbnailUrl || null,
        requirements: input.requirements,
        whatYouLearn: input.whatYouLearn,
        status: "draft",
      })
      .returning({ id: courses.id, slug: courses.slug });

    return NextResponse.json(
      {
        ok: true,
        course: created,
        message: `Brouillon créé — ajoute des leçons puis publie ta formation.`,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: error.status }
      );
    }
    console.error("instructor courses POST error:", error);
    return NextResponse.json(
      { ok: false, error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
