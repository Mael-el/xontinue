// ============================================================
// /api/v1/payments/[reference]
// GET — Statut d'un de mes paiements (pour polling côté checkout)
// ============================================================

import { NextResponse } from "next/server";
import { db } from "@/db";
import { courses, payments } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireUser, AuthError } from "@/lib/auth";
import { isMockProvider } from "@/lib/payments/provider";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ reference: string }> };

export async function GET(_req: Request, { params }: RouteContext) {
  try {
    const current = await requireUser();
    const { reference } = await params;

    const [payment] = await db
      .select({
        id: payments.id,
        userId: payments.userId,
        amountXof: payments.amountXof,
        method: payments.method,
        status: payments.status,
        reference: payments.providerReference,
        createdAt: payments.createdAt,
        course: {
          slug: courses.slug,
          title: courses.title,
        },
      })
      .from(payments)
      .leftJoin(courses, eq(payments.courseId, courses.id))
      .where(eq(payments.providerReference, reference))
      .limit(1);

    // Propriétaire uniquement (et on ne révèle pas l'existence sinon)
    if (!payment || payment.userId !== current.userId) {
      return NextResponse.json(
        { ok: false, error: "Paiement introuvable" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      payment: {
        reference: payment.reference,
        amountXof: payment.amountXof,
        method: payment.method,
        status: payment.status,
        createdAt: payment.createdAt,
        course: payment.course,
      },
      demo: isMockProvider(),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: error.status }
      );
    }
    console.error("payment status GET error:", error);
    return NextResponse.json(
      { ok: false, error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
