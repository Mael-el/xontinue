// ============================================================
// /api/v1/recruiter/jobs
// GET  — Offres publiées par mon entreprise
// POST — Publier une nouvelle offre
// ============================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { jobs } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { AuthError } from "@/lib/auth";
import { requireRecruiter } from "@/lib/recruiter";
import { slugify } from "@/lib/format";

export const dynamic = "force-dynamic";

/** Schéma de validation d'une nouvelle offre. */
const createJobSchema = z
  .object({
    title: z.string().trim().min(3, "Titre trop court").max(255),
    description: z.string().trim().max(10000).optional(),
    type: z
      .enum(["full_time", "part_time", "freelance", "internship", "contract"])
      .default("full_time"),
    location: z.string().trim().max(200).optional(),
    isRemote: z.boolean().default(false),
    salaryMinXof: z.number().int().min(0).optional(),
    salaryMaxXof: z.number().int().min(0).optional(),
    requiredBadges: z.array(z.string().trim().max(100)).max(10).default([]),
    /** Durée de validité de l'offre en jours (défaut : 60) */
    expiresInDays: z.number().int().min(1).max(180).default(60),
  })
  .refine(
    (v) =>
      v.salaryMinXof == null ||
      v.salaryMaxXof == null ||
      v.salaryMinXof <= v.salaryMaxXof,
    { message: "Le salaire minimum dépasse le maximum", path: ["salaryMinXof"] }
  );

/**
 * GET /api/v1/recruiter/jobs
 * Toutes les offres de mon entreprise, récentes d'abord.
 */
export async function GET() {
  try {
    const { company } = await requireRecruiter();

    const rows = await db
      .select({
        id: jobs.id,
        slug: jobs.slug,
        title: jobs.title,
        type: jobs.type,
        location: jobs.location,
        isRemote: jobs.isRemote,
        salaryMinXof: jobs.salaryMinXof,
        salaryMaxXof: jobs.salaryMaxXof,
        applicationsCount: jobs.applicationsCount,
        expiresAt: jobs.expiresAt,
        createdAt: jobs.createdAt,
      })
      .from(jobs)
      .where(eq(jobs.companyId, company.id))
      .orderBy(desc(jobs.createdAt))
      .limit(100);

    return NextResponse.json({ ok: true, jobs: rows });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: error.status }
      );
    }
    console.error("recruiter jobs GET error:", error);
    return NextResponse.json(
      { ok: false, error: "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/recruiter/jobs
 * Publie une offre au nom de mon entreprise.
 */
export async function POST(req: Request) {
  try {
    const { company } = await requireRecruiter();

    const body = await req.json().catch(() => ({}));
    const parsed = createJobSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: "Données invalides",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const [job] = await db
      .insert(jobs)
      .values({
        companyId: company.id,
        title: parsed.data.title,
        slug: `${slugify(parsed.data.title)}-${Date.now().toString(36)}`,
        description: parsed.data.description ?? null,
        type: parsed.data.type,
        location: parsed.data.location ?? null,
        isRemote: parsed.data.isRemote,
        salaryMinXof: parsed.data.salaryMinXof ?? null,
        salaryMaxXof: parsed.data.salaryMaxXof ?? null,
        requiredBadges: parsed.data.requiredBadges,
        expiresAt: new Date(
          Date.now() + parsed.data.expiresInDays * 24 * 60 * 60 * 1000
        ),
      })
      .returning();

    return NextResponse.json({ ok: true, job }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: error.status }
      );
    }
    console.error("recruiter jobs POST error:", error);
    return NextResponse.json(
      { ok: false, error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
