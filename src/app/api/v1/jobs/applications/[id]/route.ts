// ============================================================
// /api/v1/jobs/applications/[id]
// GET    — Détail d'une de mes candidatures
// DELETE — Retire ma candidature (statut → withdrawn)
// ============================================================

import { NextResponse } from "next/server";
import { db } from "@/db";
import { companies, jobApplications, jobs } from "@/db/schema";
import { and, eq, ne, sql } from "drizzle-orm";
import { requireUser, AuthError } from "@/lib/auth";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/v1/jobs/applications/[id]
 * Détail complet d'une candidature (propriétaire uniquement).
 */
export async function GET(_req: Request, { params }: RouteContext) {
  try {
    const current = await requireUser();
    const { id } = await params;

    const [application] = await db
      .select({
        id: jobApplications.id,
        status: jobApplications.status,
        coverLetter: jobApplications.coverLetter,
        cvUrl: jobApplications.cvUrl,
        appliedAt: jobApplications.createdAt,
        reviewedAt: jobApplications.reviewedAt,
        job: {
          id: jobs.id,
          slug: jobs.slug,
          title: jobs.title,
          type: jobs.type,
          location: jobs.location,
          isRemote: jobs.isRemote,
          salaryMinXof: jobs.salaryMinXof,
          salaryMaxXof: jobs.salaryMaxXof,
          description: jobs.description,
        },
        company: {
          name: companies.name,
          logoUrl: companies.logoUrl,
          isVerified: companies.isVerified,
          website: companies.website,
        },
      })
      .from(jobApplications)
      .innerJoin(jobs, eq(jobApplications.jobId, jobs.id))
      .leftJoin(companies, eq(jobs.companyId, companies.id))
      .where(
        and(
          eq(jobApplications.id, id),
          eq(jobApplications.userId, current.userId)
        )
      )
      .limit(1);

    if (!application) {
      return NextResponse.json(
        { ok: false, error: "Candidature introuvable" },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, application });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: error.status }
      );
    }
    console.error("application detail GET error:", error);
    return NextResponse.json(
      { ok: false, error: "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/jobs/applications/[id]
 * Retire la candidature : statut → withdrawn (la ligne est
 * conservée pour l'historique) et le compteur de l'offre
 * est décrémenté. Déjà retirée → 404.
 */
export async function DELETE(_req: Request, { params }: RouteContext) {
  try {
    const current = await requireUser();
    const { id } = await params;

    const [updated] = await db
      .update(jobApplications)
      .set({ status: "withdrawn" })
      .where(
        and(
          eq(jobApplications.id, id),
          eq(jobApplications.userId, current.userId),
          ne(jobApplications.status, "withdrawn")
        )
      )
      .returning();

    if (!updated) {
      return NextResponse.json(
        { ok: false, error: "Candidature introuvable ou déjà retirée" },
        { status: 404 }
      );
    }

    await db
      .update(jobs)
      .set({ applicationsCount: sql`greatest(${jobs.applicationsCount} - 1, 0)` })
      .where(eq(jobs.id, updated.jobId));

    return NextResponse.json({ ok: true, application: updated });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: error.status }
      );
    }
    console.error("application DELETE error:", error);
    return NextResponse.json(
      { ok: false, error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
