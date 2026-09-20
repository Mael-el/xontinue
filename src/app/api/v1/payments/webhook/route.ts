// ============================================================
// POST /api/v1/payments/webhook
// Callback appelé par le provider de paiement (FedaPay, KkiaPay…)
// pour confirmer ou infirmer un paiement.
//
// Sécurité : en-tête `x-webhook-secret` devant correspondre à
// PAYMENTS_WEBHOOK_SECRET (.env). En production avec FedaPay,
// remplacer par la vérification HMAC de la signature du corps brut
// (x-fedapay-signature) — voir https://docs.fedapay.com/webhooks
// ============================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import {
  settlePaymentFailed,
  settlePaymentSuccess,
} from "@/lib/payments/settle";

export const dynamic = "force-dynamic";

const webhookSchema = z.object({
  reference: z.string().min(1),
  status: z.enum(["success", "failed"]),
});

export async function POST(req: Request) {
  try {
    // 1) Vérification du secret partagé (remplacer par HMAC en prod)
    const secret = req.headers.get("x-webhook-secret");
    const expected = process.env.PAYMENTS_WEBHOOK_SECRET ?? "dev-secret";
    if (secret !== expected) {
      return NextResponse.json(
        { ok: false, error: "Signature invalide" },
        { status: 401 }
      );
    }

    // 2) Validation de la charge utile
    const body = await req.json().catch(() => ({}));
    const parsed = webhookSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Charge utile invalide" },
        { status: 400 }
      );
    }

    // 3) Règlement idempotent
    const { reference, status } = parsed.data;
    const result =
      status === "success"
        ? await settlePaymentSuccess(reference)
        : await settlePaymentFailed(reference);

    if (!result.payment) {
      // 404 : référence inconnue — le provider réessaiera
      return NextResponse.json(
        { ok: false, error: "Référence inconnue" },
        { status: 404 }
      );
    }

    // Toujours 200 quand l'événement est traité (même si doublon)
    return NextResponse.json({ ok: true, settled: result.settled });
  } catch (error) {
    console.error("payments webhook error:", error);
    return NextResponse.json(
      { ok: false, error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
