// ============================================================
// POST /api/v1/payments/[reference]/confirm
// ⚠️ MODE DÉMO UNIQUEMENT (provider mock) : simule la
// confirmation Mobile Money de l'utilisateur (code PIN saisi).
//
// En production, la confirmation vient EXCLUSIVEMENT du
// webhook provider signé (/api/v1/payments/webhook).
// Cette route renvoie 403 si le provider actif n'est pas mock.
// ============================================================

import { NextResponse } from "next/server";
import { requireUser, AuthError } from "@/lib/auth";
import { isMockProvider, PaymentConfigError } from "@/lib/payments/provider";
import {
  findPaymentByReference,
  settlePaymentFailed,
  settlePaymentSuccess,
} from "@/lib/payments/settle";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ reference: string }> };

export async function POST(req: Request, { params }: RouteContext) {
  try {
    // Garde-fou : route de simulation → provider mock exigé ET autorisé
    // (interdit en production sauf dérogation explicite)
    let mockActive = false;
    try {
      mockActive = isMockProvider();
    } catch (error) {
      if (error instanceof PaymentConfigError) {
        return NextResponse.json(
          { ok: false, error: "Confirmation manuelle désactivée hors mode démo" },
          { status: 403 }
        );
      }
      throw error;
    }
    if (!mockActive) {
      return NextResponse.json(
        { ok: false, error: "Confirmation manuelle désactivée hors mode démo" },
        { status: 403 }
      );
    }

    const current = await requireUser();
    const { reference } = await params;

    const payment = await findPaymentByReference(reference);
    if (!payment || payment.userId !== current.userId) {
      return NextResponse.json(
        { ok: false, error: "Paiement introuvable" },
        { status: 404 }
      );
    }

    // La démo permet aussi de simuler un échec : { "outcome": "failed" }
    const body = await req.json().catch(() => ({}));
    const outcome = (body as { outcome?: string }).outcome === "failed"
      ? "failed"
      : "success";

    const result =
      outcome === "success"
        ? await settlePaymentSuccess(reference)
        : await settlePaymentFailed(reference);

    return NextResponse.json({
      ok: true,
      outcome,
      settled: result.settled,
      payment: result.payment
        ? {
            reference: result.payment.providerReference,
            status: result.payment.status,
            amountXof: result.payment.amountXof,
          }
        : null,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: error.status }
      );
    }
    console.error("payment confirm POST error:", error);
    return NextResponse.json(
      { ok: false, error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
