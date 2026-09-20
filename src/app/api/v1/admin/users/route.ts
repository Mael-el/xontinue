// ============================================================
// GET /api/v1/admin/users?q=&role=
// Recherche/liste des utilisateurs — **admin uniquement**.
// ============================================================

import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { and, desc, eq, ilike, or, SQL } from "drizzle-orm";
import { requireRole, AuthError } from "@/lib/auth";

export const dynamic = "force-dynamic";

const ROLE_WHITELIST = ["student", "instructor", "mentor", "company", "admin"] as const;

export async function GET(req: Request) {
  try {
    await requireRole("admin");

    const url = new URL(req.url);
    const q = (url.searchParams.get("q") ?? "").trim().slice(0, 80);
    const role = url.searchParams.get("role") ?? "";

    const conditions: SQL[] = [];
    if (q) {
      const pattern = `%${q.replace(/[%_]/g, (c) => "\\" + c)}%`;
      conditions.push(
        or(ilike(users.fullName, pattern), ilike(users.email, pattern))!
      );
    }
    if (ROLE_WHITELIST.includes(role as (typeof ROLE_WHITELIST)[number])) {
      conditions.push(eq(users.role, role as (typeof ROLE_WHITELIST)[number]));
    }

    const rows = await db
      .select({
        id: users.id,
        fullName: users.fullName,
        email: users.email,
        role: users.role,
        status: users.status,
        xp: users.xp,
        country: users.country,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(users.createdAt))
      .limit(25);

    return NextResponse.json({ ok: true, users: rows });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: error.status }
      );
    }
    console.error("admin users GET error:", error);
    return NextResponse.json(
      { ok: false, error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
