// ============================================================
// ROUTE API — LISTE DES BADGES
// ============================================================

import { NextResponse } from "next/server";
import { db } from "@/db";
import { badges, domains } from "@/db/schema";
import { eq, asc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await db
      .select({
        id: badges.id,
        slug: badges.slug,
        name: badges.name,
        description: badges.description,
        icon: badges.icon,
        rarity: badges.rarity,
        requiredXp: badges.requiredXp,
        domain: {
          slug: domains.slug,
          name: domains.name,
          icon: domains.icon,
        },
      })
      .from(badges)
      .leftJoin(domains, eq(badges.domainId, domains.id))
      .orderBy(asc(badges.requiredXp));

    return NextResponse.json({ ok: true, badges: rows });
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
