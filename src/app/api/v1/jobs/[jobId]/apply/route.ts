// ============================================================
// /api/v1/jobs/[jobId]/apply
// GET  — Statut de ma candidature pour cette offre
// POST — Postuler à l'offre (lettre de motivation + CV optionnel)
// ============================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { jobApplications, jobs } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { requireUser, AuthError } from "@/lib/auth";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ jobId: string }> };

/** Schéma de validation de la candidature. */
const applySchema = z.object({
  coverLetter: z.string().trim().max(5000).optional(),
  cvUrl: z
    .string()
    .trim()
    .url("URL de CV invalide")
    .max(500)
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

/** Une offre est postulable si elle n'est pas expirée. */
function isJobOpen(expiresAt: Date | null): boolean {
  return !expiresAt || expiresAt.getTime() > Date.now();
}

/**
 * GET /api/v1/jobs/[jobId]/apply
 * Indique si l'utilisateur connecté a déjà postulé à cette offre.
 */
export async function GET(_req: Request, { params }: RouteContext) {
  try {
    const current = await requireUser();
    const { jobId } = await params;

    const [application] = await db
      .select({
        id: jobApplications.id,
        status: jobApplications.status,
        coverLetter: jobApplications.coverLetter,
        cvUrl: jobApplications.cvUrl,
        appliedAt: jobApplications.createdAt,
      })
      .from(jobApplications)
      .where(
        and(
          eq(jobApplications.userId, current.userId),
          eq(jobApplications.jobId, jobId)
        )
      )
      .limit(1);

    return NextResponse.json({
      ok: true,
      applied: Boolean(application),
      application: application ?? null,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: error.status }
      );
    }
    console.error("job apply GET error:", error);
    return NextResponse.json(
      { ok: false, error: "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/jobs/[jobId]/apply
 * Crée une candidature.
 *
 * Règles métier :
 * - L'offre doit exister et ne pas être expirée (410 Gone sinon).
 * - Une seule candidature par utilisateur et par offre (409 sinon,
 *   avec la candidature existante pour affichage).
 * - Le compteur dénormalisé `applications_count` est incrémenté.
 */
export async function POST(req: Request, { params }: RouteContext) {
  try {
    const current = await requireUser();
    const { jobId } = await params;

    const body = await req.json().catch(() => ({}));
    const parsed = applySchema.safeParse(body);
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

    // 1) L'offre doit exister
    const [job] = await db
      .select({
        id: jobs.id,
        title: jobs.title,
        expiresAt: jobs.expiresAt,
      })
      .from(jobs)
      .where(eq(jobs.id, jobId))
      .limit(1);

    if (!job) {
      return NextResponse.json(
        { ok: false, error: "Offre introuvable" },
        { status: 404 }
      );
    }

    // 2) Offre expirée → 410 Gone
    if (!isJobOpen(job.expiresAt)) {
      return NextResponse.json(
        { ok: false, error: "Cette offre est expirée", expired: true },
        { status: 410 }
      );
    }

    // 3) Déjà candidaté ? → 409 avec la candidature existante
    const [existing] = await db
      .select()
      .from(jobApplications)
      .where(
        and(
          eq(jobApplications.userId, current.userId),
          eq(jobApplications.jobId, job.id)
        )
      )
      .limit(1);

    if (existing) {
      // Une candidature retirée peut être re-déposée :
      // on la réactive avec la nouvelle lettre plutôt que de bloquer.
      if (existing.status === "withdrawn") {
        const [reactivated] = await db
          .update(jobApplications)
          .set({
            status: "pending",
            coverLetter: parsed.data.coverLetter ?? existing.coverLetter,
            cvUrl: parsed.data.cvUrl ?? existing.cvUrl,
            createdAt: new Date(),
          })
          .where(eq(jobApplications.id, existing.id))
          .returning();

        await db
          .update(jobs)
          .set({
            applicationsCount: sql`greatest(${jobs.applicationsCount} + 1, 0)`,
          })
          .where(eq(jobs.id, job.id));

        return NextResponse.json(
          { ok: true, application: reactivated, reactivated: true },
          { status: 201 }
        );
      }

      return NextResponse.json(
        {
          ok: false,
          error: "Tu as déjà postulé à cette offre",
          alreadyApplied: true,
          application: {
            id: existing.id,
            status: existing.status,
            appliedAt: existing.createdAt,
          },
        },
        { status: 409 }
      );
    }

    // 4) Créer la candidature + compteur de l'offre
    const [application] = await db
      .insert(jobApplications)
      .values({
        userId: current.userId,
        jobId: job.id,
        coverLetter: parsed.data.coverLetter ?? null,
        cvUrl: parsed.data.cvUrl ?? null,
      })
      .returning();

    await db
      .update(jobs)
      .set({ applicationsCount: sql`greatest(${jobs.applicationsCount} + 1, 0)` })
      .where(eq(jobs.id, job.id));

    return NextResponse.json(
      { ok: true, application },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: error.status }
      );
    }
    console.error("job apply POST error:", error);
    return NextResponse.json(
      { ok: false, error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
