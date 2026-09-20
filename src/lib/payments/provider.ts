// ============================================================
// PROVIDERS DE PAIEMENT — Abstraction Mobile Money / Carte
//
// Le provider actif est choisi par la variable PAYMENTS_PROVIDER :
//   mock (défaut, simulation locale) | fedapay | kkiapay
// Les clés API sont lues depuis .env — jamais écrites en dur.
//
// Flux normalisé :
//   1. initiate() → référence provider (paiement "pending")
//   2. le provider confirme plus tard → webhook /api/v1/payments/webhook
// En mode mock, la confirmation est simulée par
// POST /api/v1/payments/[reference]/confirm (bouton démo).
// ============================================================

export type PaymentMethod =
  | "mtn_mobile_money"
  | "orange_money"
  | "moov_money"
  | "fingerprint_bank"
  | "credit_card"
  | "fedapay"
  | "kkiapay";

export interface InitiatePaymentInput {
  amountXof: number;
  method: PaymentMethod;
  phoneNumber: string;
  /** Métadonnées utiles à la réconciliation comptable */
  metadata: { userId: string; courseId: string };
}

export interface InitiatePaymentResult {
  /** Référence unique côté provider */
  reference: string;
  /** Instructions affichées à l'utilisateur (push USSD, SMS…) */
  instructions: string;
  /** URL de redirection éventuelle (checkout carte, FedaPay PayPage) */
  redirectUrl?: string;
}

export interface PaymentProvider {
  readonly name: string;
  initiate(input: InitiatePaymentInput): Promise<InitiatePaymentResult>;
}

// ------------------------------------------------------------
// MOCK — Simulation locale (développement et démos)
// Le paiement reste "pending" jusqu'à la confirmation simulée.
// ------------------------------------------------------------

class MockPaymentProvider implements PaymentProvider {
  readonly name = "mock";

  async initiate(input: InitiatePaymentInput): Promise<InitiatePaymentResult> {
    const reference = `MP-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)
      .toUpperCase()}`;
    return {
      reference,
      instructions: `Simulation ${input.method} : un push de confirmation de ${input.amountXof.toLocaleString("fr-FR")} FCFA a été envoyé au ${input.phoneNumber}. Compose ton code PIN Mobile Money pour valider.`,
    };
  }
}

// ------------------------------------------------------------
// FEDAPAY — Intégration réelle (hébergement de la page de paiement)
// Doc : https://docs.fedapay.com
//
// Flux : création d'une transaction → obtention d'un token →
// redirection de l'utilisateur vers la page de paiement FedaPay
// (MTN MoMo, Orange Money, Moov, cartes…). Le résultat arrive
// ensuite par webhook (transaction.approved / .declined / .canceled).
// ------------------------------------------------------------

/** Bases API selon l'environnement FedaPay. */
const FEDAPAY_BASE_URLS = {
  sandbox: "https://sandbox-api.fedapay.com",
  live: "https://api.fedapay.com",
} as const;

const PROVIDER_TIMEOUT_MS = 15_000;

interface FedaPayTransactionResponse {
  "v1/transaction"?: {
    id: number;
    reference?: string;
    status?: string;
  };
  message?: string;
  errors?: Record<string, string[]>;
}

interface FedaPayTokenResponse {
  token?: string;
  url?: string;
  message?: string;
}

class FedaPayProvider implements PaymentProvider {
  readonly name = "fedapay";

  private readonly baseUrl: string;

  constructor(private readonly secretKey: string) {
    const mode = (process.env.FEDAPAY_MODE ?? "sandbox").toLowerCase();
    this.baseUrl =
      mode === "live" ? FEDAPAY_BASE_URLS.live : FEDAPAY_BASE_URLS.sandbox;
  }

  /** Appel HTTPS à l'API FedaPay avec gestion d'erreurs normalisée. */
  private async apiCall<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
    });

    const json = (await res.json().catch(() => ({}))) as T & {
      message?: string;
      errors?: Record<string, string[]>;
    };

    if (!res.ok) {
      const details = json.errors
        ? Object.entries(json.errors)
            .map(([field, msgs]) => `${field}: ${msgs.join(", ")}`)
            .join(" | ")
        : (json.message ?? `HTTP ${res.status}`);
      throw new Error(`FedaPay a refusé la transaction (${res.status}) : ${details}`);
    }
    return json;
  }

  async initiate(input: InitiatePaymentInput): Promise<InitiatePaymentResult> {
    const appUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
    const normalizedPhone = input.phoneNumber.replace(/[^0-9]/g, "");

    // 1) Créer la transaction (montant en FCFA entier)
    const tx = await this.apiCall<FedaPayTransactionResponse>("/v1/transactions", {
      description: `AfricaSkills — paiement formation (${input.metadata.courseId})`,
      amount: input.amountXof,
      currency: { iso: "XOF" },
      // Retour navigateur après paiement + notification serveur (webhook)
      callback_url: `${appUrl}/courses?payment=pending`,
      customer: {
        phone_number: { number: normalizedPhone, country: "bj" },
      },
      custom_metadata: {
        user_id: input.metadata.userId,
        course_id: input.metadata.courseId,
      },
    });

    const transactionId = tx["v1/transaction"]?.id;
    if (!transactionId) {
      throw new Error("FedaPay n'a pas retourné d'identifiant de transaction");
    }

    // 2) Obtenir l'URL de la page de paiement hébergée
    const token = await this.apiCall<FedaPayTokenResponse>(
      `/v1/transactions/${transactionId}/token`,
      {}
    );

    return {
      // La référence stockée = id FedaPay : c'est ce que renvoie le webhook
      reference: String(transactionId),
      instructions: `Clique sur le bouton FedaPay pour payer ${input.amountXof.toLocaleString("fr-FR")} FCFA (Mobile Money ou carte). Tu seras redirigé vers la page sécurisée FedaPay.`,
      redirectUrl: token.url ?? undefined,
    };
  }
}

// ------------------------------------------------------------
// KKiaPAY — Doc : https://docs.kkiapay.me
//
// KkiaPay s'intègre par WIDGET côté client (kkiapay.js) : le SDK
// débite le client puis renvoie un transactionId que le serveur
// vérifie (GET /api/v1/transactions/:id avec la clé privée).
// Ce n'est donc pas un flux « initiate » côté serveur comme FedaPay.
// Utiliser PAYMENTS_PROVIDER=fedapay pour le checkout hébergé ;
// l'intégration KkiaPay passera par un module client dédié.
// ------------------------------------------------------------

class KkiaPayProvider implements PaymentProvider {
  readonly name = "kkiapay";

  constructor(private readonly privateKey: string) {}

  async initiate(input: InitiatePaymentInput): Promise<InitiatePaymentResult> {
    void input;
    throw new Error(
      "KkiaPay exige le widget client kkiapay.js (initiation côté navigateur). " +
        "Utilise PAYMENTS_PROVIDER=fedapay en attendant le module KkiaPay dédié. " +
        `Clé privée : ${this.privateKey ? "présente" : "absente"}.`
    );
  }
}

/** Erreur de configuration des paiements — 503 côté route. */
export class PaymentConfigError extends Error {}

/**
 * Fabrique le provider actif selon les variables d'environnement.
 *
 * Règles de sécurité :
 * - PAYMENTS_PROVIDER=fedapay|kkiapay explicite SANS clé configurée
 *   → erreur (jamais de repli silencieux vers le mock !)
 * - En production, le provider mock est interdit (risque : paiements
 *   auto-confirmés) sauf dérogation explicite PAYMENTS_ALLOW_MOCK_IN_PROD=true
 *   (à réserver à une démo/staging, jamais à la vraie boutique).
 */
export function getPaymentProvider(): PaymentProvider {
  const wanted = (process.env.PAYMENTS_PROVIDER ?? "mock").toLowerCase();

  if (wanted === "fedapay") {
    const key = process.env.FEDAPAY_SECRET_KEY;
    if (!key) {
      throw new PaymentConfigError(
        "PAYMENTS_PROVIDER=fedapay mais FEDAPAY_SECRET_KEY est absente"
      );
    }
    return new FedaPayProvider(key);
  }

  if (wanted === "kkiapay") {
    const key = process.env.KKIAPAY_PRIVATE_KEY;
    if (!key) {
      throw new PaymentConfigError(
        "PAYMENTS_PROVIDER=kkiapay mais KKIAPAY_PRIVATE_KEY est absente"
      );
    }
    return new KkiaPayProvider(key);
  }

  if (wanted !== "mock") {
    throw new PaymentConfigError(
      `PAYMENTS_PROVIDER inconnu « ${wanted} » (mock | fedapay | kkiapay)`
    );
  }

  // Provider mock : interdit en production sans dérogation explicite
  if (
    process.env.NODE_ENV === "production" &&
    process.env.PAYMENTS_ALLOW_MOCK_IN_PROD !== "true"
  ) {
    throw new PaymentConfigError(
      "Le provider mock est interdit en production (PAYMENTS_PROVIDER=mock). " +
        "Configurer FedaPay/KkiaPay, ou PAYMENTS_ALLOW_MOCK_IN_PROD=true pour une démo."
    );
  }

  return new MockPaymentProvider();
}

/** Indique si le provider actif est la simulation locale. */
export function isMockProvider(): boolean {
  return getPaymentProvider().name === "mock";
}
