// ============================================================
// PATCH /api/v1/admin/users/[id]   { status: "active" | "suspended" }
// Suspendre / réactiver un compte — **admin uniquement**.
// Impossible de modifier son propre compte ou un autre admin.
// ============================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireRole, AuthError } from "@/lib/auth";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  status: z.enum(["active", "suspended"]),
});

export async function PATCH(req: Request, { params }: RouteContext) {
  try {
    const current = await requireRole("admin");
    const { id } = await params;

    const body = await req.json().catch(() => ({}));
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Statut invalide (active | suspended)" },
        { status: 400 }
      );
    }

    // Protections : jamais soi-même, jamais un autre admin
    if (id === current.userId) {
      return NextResponse.json(
        { ok: false, error: "Tu ne peux pas modifier ton propre compte" },
        { status: 400 }
      );
    }

    const [target] = await db
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (!target) {
      return NextResponse.json(
        { ok: false, error: "Utilisateur introuvable" },
        { status: 404 }
      );
    }
    if (target.role === "admin") {
      return NextResponse.json(
        { ok: false, error: "Impossible de modifier un compte administrateur" },
        { status: 403 }
      );
    }

    const [updated] = await db
      .update(users)
      .set({ status: parsed.data.status, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning({ id: users.id, status: users.status });

    return NextResponse.json({ ok: true, user: updated });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: error.status }
      );
    }
    console.error("admin users PATCH error:", error);
    return NextResponse.json(
      { ok: false, error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
