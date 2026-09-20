// ============================================================
// GET /api/v1/chat/users/search?q=...
// Recherche d'utilisateurs pour démarrer une conversation
// (nom ou email, flou, 10 max — jamais soi-même).
// ============================================================

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { and, asc, eq, ilike, ne, or } from "drizzle-orm";
import { apiErrorResponse } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
    if (q.length < 2) {
      return NextResponse.json({ ok: true, users: [] });
    }

    const pattern = `%${q.replace(/[%_]/g, "")}%`;
    const rows = await db
      .select({
        id: users.id,
        fullName: users.fullName,
        avatarUrl: users.avatarUrl,
        email: users.email,
      })
      .from(users)
      .where(
        and(
          ne(users.id, user.userId),
          eq(users.status, "active"),
          or(ilike(users.fullName, pattern), ilike(users.email, pattern))
        )
      )
      .orderBy(asc(users.fullName))
      .limit(10);

    return NextResponse.json({
      ok: true,
      users: rows.map((r) => ({
        id: r.id,
        fullName: r.fullName,
        avatarUrl: r.avatarUrl,
        // Email masqué (confidentialité) : seule l'initiale du domaine
        emailMasked: r.email
          ? r.email.replace(/^(.{2}).*(@..).*$/, "$1…$2…")
          : null,
      })),
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
