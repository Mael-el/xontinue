// ============================================================
// SÉCURITÉ DU WEBHOOK DE PAIEMENT
//
// Deux mécanismes acceptés (dans cet ordre) :
//   1. HMAC-SHA256 du corps brut — en-tête `x-fedapay-signature`
//      (format FedaPay) ou `x-signature` (générique). La clé est
//      PAYMENTS_WEBHOOK_SECRET. Formats acceptés : hexadécimal pur
//      ou préfixé « sha256= ».
//   2. Secret partagé en clair — en-tête `x-webhook-secret`
//      (mode mock/machine-à-machine interne, rétro-compatibilité).
//
// La comparaison est TOUJOURS timing-safe.
// ============================================================

import { createHmac, timingSafeEqual } from "crypto";

/** Calcule la signature HMAC-SHA256 hexadécimale d'un corps brut. */
export function computeHmacSignature(rawBody: string, secret: string): string {
  return createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
}

/** Compare deux chaînes en temps constant (padding sur la plus longue). */
function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length === bufB.length) {
    return timingSafeEqual(bufA, bufB);
  }
  // Longueurs différentes : comparer quand même à soi-même pour ne pas
  // fuiter la longueur attendue via le temps de réponse.
  timingSafeEqual(bufA, bufA);
  return false;
}

/** Normalise une valeur d'en-tête : retire le préfixe « sha256= ». */
function normalizeSignature(header: string): string {
  return header.trim().toLowerCase().replace(/^sha256=/, "");
}

/**
 * Vérifie le webhook.
 * @param rawBody corps HTTP BRUT (avant tout parsing JSON)
 * @param headers en-têtes de la requête
 * @param secret  secret partagé (PAYMENTS_WEBHOOK_SECRET)
 */
export function verifyWebhookRequest(
  rawBody: string,
  headers: Headers,
  secret: string
): { ok: true; via: "hmac" | "shared-secret" } | { ok: false } {
  // 1) Signature HMAC (FedaPay ou générique)
  const signatureHeader =
    headers.get("x-fedapay-signature") ?? headers.get("x-signature");
  if (signatureHeader) {
    const expected = computeHmacSignature(rawBody, secret);
    if (safeCompare(normalizeSignature(signatureHeader), expected)) {
      return { ok: true, via: "hmac" };
    }
    // Signature présente mais invalide → rejet sec (pas de repli)
    return { ok: false };
  }

  // 2) Secret partagé en clair (mock et intégrations simples)
  const shared = headers.get("x-webhook-secret");
  if (shared && safeCompare(shared, secret)) {
    return { ok: true, via: "shared-secret" };
  }

  return { ok: false };
}

// ------------------------------------------------------------
// Normalisation des événements provider
// ------------------------------------------------------------

export interface NormalizedPaymentEvent {
  reference: string;
  status: "success" | "failed";
}

/** Statuts FedaPay considérés comme succès / échec définitifs. */
const FEDAPAY_SUCCESS = new Set(["approved"]);
const FEDAPAY_FAILURE = new Set(["declined", "canceled", "refunded"]);

/**
 * Convertit la charge utile d'un provider en événement normalisé.
 * Supporte :
 *   - le format FedaPay { name: "transaction.approved", entity: { id, status } }
 *   - le format simple { reference, status: "success" | "failed" } (mock)
 * Retourne null si l'événement n'est pas un paiement à traiter
 * (événement non transactionnel, statut intermédiaire « pending »…).
 */
export function mapProviderEvent(body: unknown): NormalizedPaymentEvent | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as Record<string, unknown>;

  // ---- Format FedaPay ----
  if (typeof b.name === "string" && typeof b.entity === "object" && b.entity) {
    const eventName = b.name;
    if (!eventName.startsWith("transaction.")) return null; // pas un paiement

    const entity = b.entity as Record<string, unknown>;
    const id = entity.id;
    if (id === undefined || id === null) return null;

    // Le statut de l'entité prime ; sinon déduire du nom d'événement
    const entityStatus = String(entity.status ?? "").toLowerCase();
    const effective = entityStatus || eventName.split(".")[1] || "";

    if (FEDAPAY_SUCCESS.has(effective)) {
      return { reference: String(id), status: "success" };
    }
    if (FEDAPAY_FAILURE.has(effective)) {
      return { reference: String(id), status: "failed" };
    }
    return null; // pending / created → rien à régler
  }

  // ---- Format simple (mock / intégrations internes) ----
  if (typeof b.reference === "string" && b.reference.length > 0) {
    if (b.status === "success" || b.status === "failed") {
      return { reference: b.reference, status: b.status };
    }
  }

  return null;
}
