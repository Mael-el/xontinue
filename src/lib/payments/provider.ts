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
// FEDAPAY — Squelette prêt pour l'intégration réelle
// Doc : https://docs.fedapay.com
// ------------------------------------------------------------

class FedaPayProvider implements PaymentProvider {
  readonly name = "fedapay";

  constructor(private readonly secretKey: string) {}

  async initiate(input: InitiatePaymentInput): Promise<InitiatePaymentResult> {
    // TODO prod : POST https://api.fedapay.com/v1/transactions
    //   Authorization: Bearer ${this.secretKey}
    //   { amount, currency: "XOF", customer, callback_url, metadata }
    // puis renvoyer { reference: transaction.id, redirectUrl: token.url }
    void input;
    throw new Error(
      `Provider FedaPay configuré (clé : ${this.secretKey ? "présente" : "absente"}) mais appel API non implémenté — utiliser PAYMENTS_PROVIDER=mock en attendant.`
    );
  }
}

// ------------------------------------------------------------
// KKiaPAY — Squelette prêt pour l'intégration réelle
// Doc : https://docs.kkiapay.me
// ------------------------------------------------------------

class KkiaPayProvider implements PaymentProvider {
  readonly name = "kkiapay";

  constructor(private readonly privateKey: string) {}

  async initiate(input: InitiatePaymentInput): Promise<InitiatePaymentResult> {
    // TODO prod : POST https://api.kkiapay.me/api/v1/transactions
    //   x-api-key: this.privateKey
    void input;
    throw new Error(
      `Provider KkiaPay configuré (clé : ${this.privateKey ? "présente" : "absente"}) mais appel API non implémenté — utiliser PAYMENTS_PROVIDER=mock en attendant.`
    );
  }
}

/** Fabrique le provider actif selon les variables d'environnement. */
export function getPaymentProvider(): PaymentProvider {
  const wanted = (process.env.PAYMENTS_PROVIDER ?? "mock").toLowerCase();

  if (wanted === "fedapay" && process.env.FEDAPAY_SECRET_KEY) {
    return new FedaPayProvider(process.env.FEDAPAY_SECRET_KEY);
  }
  if (wanted === "kkiapay" && process.env.KKIAPAY_PRIVATE_KEY) {
    return new KkiaPayProvider(process.env.KKIAPAY_PRIVATE_KEY);
  }

  return new MockPaymentProvider();
}

/** Indique si le provider actif est la simulation locale. */
export function isMockProvider(): boolean {
  return getPaymentProvider().name === "mock";
}
