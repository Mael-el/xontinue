// ============================================================
// POST /api/v1/payments/webhook
// Callback appelé par le provider de paiement (FedaPay…) pour
// confirmer ou infirmer un paiement.
//
// Sécurité (voir src/lib/payments/webhook-signature.ts) :
//   - en-tête `x-fedapay-signature` / `x-signature` : HMAC-SHA256
//     du corps brut avec PAYMENTS_WEBHOOK_SECRET (recommandé prod)
//   - en-tête `x-webhook-secret` : secret partagé (mock / legacy)
// En production, PAYMENTS_WEBHOOK_SECRET est OBLIGATOIRE (pas de
// valeur par défaut) et doit être long et aléatoire.
// ============================================================

import { NextResponse } from "next/server";
import {
  verifyWebhookRequest,
  mapProviderEvent,
} from "@/lib/payments/webhook-signature";
import {
  settlePaymentFailed,
  settlePaymentSuccess,
} from "@/lib/payments/settle";
import { checkRateLimit, getClientIp } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    // 0) Rate-limit anti-balayage (60 req/min par IP)
    const ip = getClientIp(req);
    const rl = checkRateLimit(`payments-webhook:${ip}`, 60, 60_000);
    if (!rl.allowed) {
      return NextResponse.json(
        { ok: false, error: "Trop de requêtes" },
        { status: 429 }
      );
    }

    // 1) Lecture du corps BRUT (indispensable pour vérifier la signature)
    const rawBody = await req.text();

    // 2) Vérification HMAC / secret partagé — timing-safe
    const secret = process.env.PAYMENTS_WEBHOOK_SECRET;
    if (!secret) {
      // Pas de secret configuré : si on est en production, c'est une
      // erreur de déploiement — on refuse tout par sécurité.
      if (process.env.NODE_ENV === "production") {
        console.error(
          "PAYMENTS_WEBHOOK_SECRET absent en production — webhook désactivé"
        );
        return NextResponse.json(
          { ok: false, error: "Webhook non configuré" },
          { status: 503 }
        );
      }
    }
    const auth = verifyWebhookRequest(rawBody, req.headers, secret ?? "dev-secret");
    if (!auth.ok) {
      return NextResponse.json(
        { ok: false, error: "Signature invalide" },
        { status: 401 }
      );
    }

    // 3) Normalisation de l'événement (FedaPay ou format simple)
    const body = JSON.parse(rawBody || "{}");
    const event = mapProviderEvent(body);
    if (!event) {
      // Événement non concerné (création, pending…) : acquitté sans règlement
      return NextResponse.json({ ok: true, ignored: true });
    }

    // 4) Règlement idempotent
    const result =
      event.status === "success"
        ? await settlePaymentSuccess(event.reference)
        : await settlePaymentFailed(event.reference);

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
