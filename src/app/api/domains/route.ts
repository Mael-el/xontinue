// ============================================================
// ROUTE API — LISTE DES DOMAINES
// ============================================================

import { NextResponse } from "next/server";
import { db } from "@/db";
import { domains, courses } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await db
      .select({
        id: domains.id,
        slug: domains.slug,
        name: domains.name,
        description: domains.description,
        icon: domains.icon,
        color: domains.color,
        coursesCount: sql<number>`count(${courses.id})::int`,
      })
      .from(domains)
      .leftJoin(courses, eq(courses.domainId, domains.id))
      .groupBy(domains.id)
      .orderBy(domains.name);

    return NextResponse.json({ ok: true, domains: rows });
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
