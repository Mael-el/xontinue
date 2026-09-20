// ============================================================
// /api/v1/recruiter/company
// GET  — Mon entreprise + statistiques (offres, candidatures)
// POST — Créer mon entreprise (une seule par compte)
// ============================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { companies, jobApplications, jobs } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { requireUser, AuthError } from "@/lib/auth";
import { getRecruiterCompany } from "@/lib/recruiter";
import { slugify } from "@/lib/format";

export const dynamic = "force-dynamic";

/** Schéma de validation de création d'entreprise. */
const createCompanySchema = z.object({
  name: z.string().trim().min(2, "Nom trop court").max(255),
  country: z.string().trim().max(100).default("Bénin"),
  city: z.string().trim().max(100).optional(),
  industry: z.string().trim().max(100).optional(),
  description: z.string().trim().max(5000).optional(),
  website: z
    .string()
    .trim()
    .url("URL invalide")
    .max(500)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  /** Emoji affiché comme logo (convention du seed) */
  logoEmoji: z.string().trim().max(8).optional(),
});

/**
 * GET /api/v1/recruiter/company
 * Retourne { hasCompany: false } ou l'entreprise avec ses stats :
 * nombre d'offres, candidatures totales et en attente.
 */
export async function GET() {
  try {
    const current = await requireUser();
    const found = await getRecruiterCompany(current.userId);

    if (!found) {
      return NextResponse.json({ ok: true, hasCompany: false, company: null });
    }

    const [stats] = await db
      .select({
        jobsCount: sql<number>`count(distinct ${jobs.id})::int`,
        applicationsCount: sql<number>`count(${jobApplications.id})::int`,
        pendingCount: sql<number>`count(${jobApplications.id}) filter (where ${jobApplications.status} = 'pending')::int`,
      })
      .from(jobs)
      .leftJoin(jobApplications, eq(jobApplications.jobId, jobs.id))
      .where(eq(jobs.companyId, found.company.id));

    return NextResponse.json({
      ok: true,
      hasCompany: true,
      company: found.company,
      ownerName: found.ownerName,
      stats: {
        jobsCount: stats?.jobsCount ?? 0,
        applicationsCount: stats?.applicationsCount ?? 0,
        pendingCount: stats?.pendingCount ?? 0,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: error.status }
      );
    }
    console.error("recruiter company GET error:", error);
    return NextResponse.json(
      { ok: false, error: "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/recruiter/company
 * Crée l'entreprise du compte connecté (409 si déjà existante).
 */
export async function POST(req: Request) {
  try {
    const current = await requireUser();

    const existing = await getRecruiterCompany(current.userId);
    if (existing) {
      return NextResponse.json(
        { ok: false, error: "Tu as déjà une entreprise", alreadyExists: true },
        { status: 409 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const parsed = createCompanySchema.safeParse(body);
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

    const [company] = await db
      .insert(companies)
      .values({
        userId: current.userId,
        name: parsed.data.name,
        slug: `${slugify(parsed.data.name)}-${Date.now().toString(36)}`,
        country: parsed.data.country,
        city: parsed.data.city ?? null,
        industry: parsed.data.industry ?? null,
        description: parsed.data.description ?? null,
        website: parsed.data.website ?? null,
        logoUrl: parsed.data.logoEmoji ?? "🏢",
        isVerified: false,
      })
      .returning();

    return NextResponse.json(
      { ok: true, hasCompany: true, company },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: error.status }
      );
    }
    console.error("recruiter company POST error:", error);
    return NextResponse.json(
      { ok: false, error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
