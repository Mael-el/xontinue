// ============================================================
// /api/v1/recruiter/applications
// GET — Candidatures reçues sur les offres de mon entreprise
//       (filtre optionnel : ?jobId=xxx)
// ============================================================

import { NextResponse } from "next/server";
import { db } from "@/db";
import { jobApplications, jobs, users } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { AuthError } from "@/lib/auth";
import { requireRecruiter } from "@/lib/recruiter";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/recruiter/applications?jobId=
 * Les 100 dernières candidatures reçues, avec les infos du
 * candidat (nom, avatar, pays, XP) et de l'offre concernée.
 */
export async function GET(req: Request) {
  try {
    const { company } = await requireRecruiter();

    const jobId = new URL(req.url).searchParams.get("jobId");

    const rows = await db
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
        },
        candidate: {
          id: users.id,
          fullName: users.fullName,
          avatarUrl: users.avatarUrl,
          country: users.country,
          city: users.city,
          xp: users.xp,
        },
      })
      .from(jobApplications)
      .innerJoin(jobs, eq(jobApplications.jobId, jobs.id))
      .innerJoin(users, eq(jobApplications.userId, users.id))
      .where(
        and(
          eq(jobs.companyId, company.id),
          jobId ? eq(jobs.id, jobId) : undefined
        )
      )
      .orderBy(desc(jobApplications.createdAt))
      .limit(100);

    return NextResponse.json({ ok: true, applications: rows });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: error.status }
      );
    }
    console.error("recruiter applications GET error:", error);
    return NextResponse.json(
      { ok: false, error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
