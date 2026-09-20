// ============================================================
// /api/v1/jobs/applications
// GET — Liste des candidatures de l'utilisateur connecté
// ============================================================

import { NextResponse } from "next/server";
import { db } from "@/db";
import { companies, jobApplications, jobs } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { requireUser, AuthError } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/jobs/applications
 * Toutes les candidatures de l'utilisateur, avec les infos
 * de l'offre et de l'entreprise, les plus récentes d'abord.
 */
export async function GET() {
  try {
    const current = await requireUser();

    const applications = await db
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
          expiresAt: jobs.expiresAt,
        },
        company: {
          name: companies.name,
          logoUrl: companies.logoUrl,
          isVerified: companies.isVerified,
        },
      })
      .from(jobApplications)
      .innerJoin(jobs, eq(jobApplications.jobId, jobs.id))
      .leftJoin(companies, eq(jobs.companyId, companies.id))
      .where(eq(jobApplications.userId, current.userId))
      .orderBy(desc(jobApplications.createdAt));

    return NextResponse.json({ ok: true, applications });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: error.status }
      );
    }
    console.error("job applications GET error:", error);
    return NextResponse.json(
      { ok: false, error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
