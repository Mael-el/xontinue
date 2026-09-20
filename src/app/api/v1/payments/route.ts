// ============================================================
// /api/v1/payments
// GET  — Historique de mes paiements
// POST — Initier un paiement pour un cours (→ statut "pending")
//
// Le paiement est confirmé ensuite par :
//   - le webhook provider (production : FedaPay, KkiaPay…)
//   - POST /[reference]/confirm en mode mock (bouton démo)
// ============================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { courses, enrollments, payments } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { requireUser, AuthError } from "@/lib/auth";
import {
  getPaymentProvider,
  isMockProvider,
  PaymentConfigError,
} from "@/lib/payments/provider";

export const dynamic = "force-dynamic";


/** Drapeau « démo » pour l'UI (false si le provider n'est pas résoluble). */
function isDemoMode(): boolean {
  try {
    return isMockProvider();
  } catch {
    return false;
  }
}

/** Récupère le provider ou renvoie une réponse 503 (mauvaise config). */
function tryGetProvider() {
  try {
    return { provider: getPaymentProvider() };
  } catch (error) {
    if (error instanceof PaymentConfigError) {
      console.error("payments config error:", error.message);
      return {
        errorResponse: NextResponse.json(
          { ok: false, error: "Paiements temporairement indisponibles" },
          { status: 503 }
        ),
      };
    }
    throw error;
  }
}


/** Schéma de validation d'initiation de paiement. */
const initiateSchema = z.object({
  courseSlug: z.string().min(1, "courseSlug requis"),
  method: z.enum([
    "mtn_mobile_money",
    "orange_money",
    "moov_money",
    "fingerprint_bank",
    "credit_card",
    "fedapay",
    "kkiapay",
  ]),
  phoneNumber: z
    .string()
    .trim()
    .min(8, "Numéro trop court")
    .max(30, "Numéro trop long"),
});

/**
 * GET /api/v1/payments — Mes 50 derniers paiements (avec le cours).
 */
export async function GET() {
  try {
    const current = await requireUser();

    const rows = await db
      .select({
        id: payments.id,
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
      .where(eq(payments.userId, current.userId))
      .orderBy(desc(payments.createdAt))
      .limit(50);

    return NextResponse.json({ ok: true, payments: rows });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: error.status }
      );
    }
    console.error("payments GET error:", error);
    return NextResponse.json(
      { ok: false, error: "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/payments — Initie un paiement.
 *
 * Règles métier :
 * - Cours gratuit → 400 (utiliser /api/v1/enrollments).
 * - Déjà inscrit (actif) ou déjà payé → 409.
 * - Un paiement "pending" existe → on le renvoie (pas de doublon).
 */
export async function POST(req: Request) {
  try {
    const current = await requireUser();

    const body = await req.json().catch(() => ({}));
    const parsed = initiateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: "Données invalides",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    // 1) Le cours doit exister et être publié
    const [course] = await db
      .select()
      .from(courses)
      .where(eq(courses.slug, parsed.data.courseSlug))
      .limit(1);

    if (!course || course.status !== "published") {
      return NextResponse.json(
        { ok: false, error: "Cours introuvable" },
        { status: 404 }
      );
    }

    // 2) Cours gratuit → passer par l'inscription directe
    if ((course.priceXof ?? 0) === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "Ce cours est gratuit — inscris-toi directement",
          free: true,
        },
        { status: 400 }
      );
    }

    // 3) Déjà inscrit ou déjà payé ?
    const [enrollment] = await db
      .select({ id: enrollments.id })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.userId, current.userId),
          eq(enrollments.courseId, course.id),
          eq(enrollments.status, "active")
        )
      )
      .limit(1);

    if (enrollment) {
      return NextResponse.json(
        { ok: false, error: "Tu es déjà inscrit à ce cours", alreadyEnrolled: true },
        { status: 409 }
      );
    }

    const [paid] = await db
      .select({ id: payments.id })
      .from(payments)
      .where(
        and(
          eq(payments.userId, current.userId),
          eq(payments.courseId, course.id),
          eq(payments.status, "success")
        )
      )
      .limit(1);

    if (paid) {
      return NextResponse.json(
        { ok: false, error: "Ce cours est déjà payé", alreadyPaid: true },
        { status: 409 }
      );
    }

    // 4) Paiement en cours existant → on le renvoie (anti-doublon)
    const [pending] = await db
      .select()
      .from(payments)
      .where(
        and(
          eq(payments.userId, current.userId),
          eq(payments.courseId, course.id),
          eq(payments.status, "pending")
        )
      )
      .orderBy(desc(payments.createdAt))
      .limit(1);

    if (pending) {
      return NextResponse.json({
        ok: true,
        alreadyPending: true,
        payment: {
          reference: pending.providerReference,
          amountXof: pending.amountXof,
          method: pending.method,
          status: pending.status,
          createdAt: pending.createdAt,
        },
        demo: isDemoMode(),
      });
    }

    // 5) Initiation via le provider actif → paiement "pending"
    const providerResult = tryGetProvider();
    if ("errorResponse" in providerResult) return providerResult.errorResponse;
    const { provider } = providerResult;

    let initiated;
    try {
      initiated = await provider.initiate({
        amountXof: course.priceXof,
        method: parsed.data.method,
        phoneNumber: parsed.data.phoneNumber,
        metadata: { userId: current.userId, courseId: course.id },
      });
    } catch (error) {
      // Le provider (FedaPay…) a refusé ou est injoignable → 502 explicite
      console.error("payments initiate provider error:", error);
      return NextResponse.json(
        {
          ok: false,
          error:
            "Le service de paiement est momentanément indisponible. Réessaie dans quelques instants.",
        },
        { status: 502 }
      );
    }

    const [payment] = await db
      .insert(payments)
      .values({
        userId: current.userId,
        courseId: course.id,
        amountXof: course.priceXof,
        method: parsed.data.method,
        status: "pending",
        providerReference: initiated.reference,
        phoneNumber: parsed.data.phoneNumber,
      })
      .returning();

    return NextResponse.json(
      {
        ok: true,
        payment: {
          reference: payment.providerReference,
          amountXof: payment.amountXof,
          method: payment.method,
          status: payment.status,
          createdAt: payment.createdAt,
        },
        instructions: initiated.instructions,
        redirectUrl: initiated.redirectUrl ?? null,
        demo: provider.name === "mock",
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: error.status }
      );
    }
    console.error("payments POST error:", error);
    return NextResponse.json(
      { ok: false, error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
