// ============================================================
// ROUTE API — LISTE DES OFFRES D'EMPLOI
// ============================================================

import { NextResponse } from "next/server";
import { db } from "@/db";
import { jobs, companies } from "@/db/schema";
import { eq, and, gte, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await db
      .select({
        id: jobs.id,
        title: jobs.title,
        slug: jobs.slug,
        description: jobs.description,
        type: jobs.type,
        location: jobs.location,
        isRemote: jobs.isRemote,
        salaryMinXof: jobs.salaryMinXof,
        salaryMaxXof: jobs.salaryMaxXof,
        requiredBadges: jobs.requiredBadges,
        applicationsCount: jobs.applicationsCount,
        createdAt: jobs.createdAt,
        company: {
          name: companies.name,
          industry: companies.industry,
          country: companies.country,
          city: companies.city,
          logoUrl: companies.logoUrl,
          isVerified: companies.isVerified,
        },
      })
      .from(jobs)
      .leftJoin(companies, eq(jobs.companyId, companies.id))
      .where(gte(jobs.expiresAt, new Date()))
      .orderBy(desc(jobs.createdAt));

    return NextResponse.json({ ok: true, jobs: rows });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
