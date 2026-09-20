// ============================================================
// /api/v1/profiles/me/domains
// GET  — Domaines suivis
// POST — Ajoute un domaine d'intérêt
// ============================================================

import { NextResponse } from "next/server";
import { db } from "@/db";
import { userDomains, domains } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireUser, AuthError, addUserDomainSchema } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const current = await requireUser();
    const list = await db
      .select({
        id: userDomains.id,
        level: userDomains.level,
        interestScore: userDomains.interestScore,
        domain: {
          slug: domains.slug,
          name: domains.name,
          icon: domains.icon,
          color: domains.color,
        },
      })
      .from(userDomains)
      .innerJoin(domains, eq(userDomains.domainId, domains.id))
      .where(eq(userDomains.userId, current.userId));
    return NextResponse.json({ ok: true, domains: list });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    return NextResponse.json({ ok: false, error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const current = await requireUser();
    const body = await req.json();
    const parsed = addUserDomainSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Données invalides" },
        { status: 400 }
      );
    }

    // Récupérer le domain par slug
    const [domain] = await db
      .select({ id: domains.id })
      .from(domains)
      .where(eq(domains.slug, parsed.data.domainSlug))
      .limit(1);

    if (!domain) {
      return NextResponse.json(
        { ok: false, error: "Domaine introuvable" },
        { status: 404 }
      );
    }

    // Upsert
    await db
      .insert(userDomains)
      .values({
        userId: current.userId,
        domainId: domain.id,
        level: parsed.data.level,
      })
      .onConflictDoUpdate({
        target: [userDomains.userId, userDomains.domainId],
        set: { level: parsed.data.level },
      });

    return NextResponse.json({ ok: true, message: "Domaine ajouté" });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    return NextResponse.json({ ok: false, error: "Erreur serveur" }, { status: 500 });
  }
}
