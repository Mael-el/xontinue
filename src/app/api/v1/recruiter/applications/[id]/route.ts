// ============================================================
// /api/v1/recruiter/applications/[id]
// PATCH — Change le statut d'une candidature reçue
//         (reviewed / shortlisted / interview / accepted / rejected)
//         → notifie le candidat
// ============================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { jobApplications, jobs } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { AuthError } from "@/lib/auth";
import { requireRecruiter } from "@/lib/recruiter";
import { applicationStatusLabel } from "@/lib/format";
import { notifyUser } from "@/lib/notifications";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/** Statuts qu'un recruteur peut appliquer (withdrawn = candidat). */
const updateStatusSchema = z.object({
  status: z.enum([
    "pending",
    "reviewed",
    "shortlisted",
    "interview",
    "accepted",
    "rejected",
  ]),
});

/**
 * PATCH /api/v1/recruiter/applications/[id]
 * Met à jour le statut d'une candidature. La candidature doit
 * appartenir à une offre de MON entreprise (404 sinon).
 * `reviewed_at` est horodaté à chaque action.
 */
export async function PATCH(req: Request, { params }: RouteContext) {
  try {
    const { company } = await requireRecruiter();
    const { id } = await params;

    const body = await req.json().catch(() => ({}));
    const parsed = updateStatusSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Statut invalide" },
        { status: 400 }
      );
    }

    // La candidature doit viser une offre de mon entreprise
    const [application] = await db
      .select({
        id: jobApplications.id,
        userId: jobApplications.userId,
        status: jobApplications.status,
        jobTitle: jobs.title,
        jobSlug: jobs.slug,
      })
      .from(jobApplications)
      .innerJoin(jobs, eq(jobApplications.jobId, jobs.id))
      .where(
        and(
          eq(jobApplications.id, id),
          eq(jobs.companyId, company.id)
        )
      )
      .limit(1);

    if (!application) {
      return NextResponse.json(
        { ok: false, error: "Candidature introuvable" },
        { status: 404 }
      );
    }

    if (application.status === "withdrawn") {
      return NextResponse.json(
        { ok: false, error: "Cette candidature a été retirée par le candidat" },
        { status: 409 }
      );
    }

    const [updated] = await db
      .update(jobApplications)
      .set({ status: parsed.data.status, reviewedAt: new Date() })
      .where(eq(jobApplications.id, application.id))
      .returning();

    // Notifie le candidat du changement de statut (best-effort)
    const label = applicationStatusLabel(parsed.data.status);
    void notifyUser(application.userId, {
      type: "application_status",
      title: `💼 ${label} : ${application.jobTitle}`,
      body: `${company.name} a mis à jour ta candidature pour « ${application.jobTitle} » → ${label}.`,
      href: "/dashboard",
    });

    return NextResponse.json({ ok: true, application: updated });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: error.status }
      );
    }
    console.error("recruiter application PATCH error:", error);
    return NextResponse.json(
      { ok: false, error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
