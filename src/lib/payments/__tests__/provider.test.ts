// ============================================================
// TESTS — Fabrique de providers + intégration FedaPay
// (src/lib/payments/provider.ts)
// ============================================================

import {
  getPaymentProvider,
  isMockProvider,
  PaymentConfigError,
} from "@/lib/payments/provider";

/** Alias typé mutable (NODE_ENV est readonly dans les types Node). */
const env = process.env as Record<string, string | undefined>;

/** Sauvegarde / restauration ciblée de l'environnement. */
const ENV_KEYS = [
  "PAYMENTS_PROVIDER",
  "PAYMENTS_ALLOW_MOCK_IN_PROD",
  "FEDAPAY_SECRET_KEY",
  "FEDAPAY_MODE",
  "KKIAPAY_PRIVATE_KEY",
  "NEXT_PUBLIC_BASE_URL",
  "NODE_ENV",
] as const;

let savedEnv: Record<string, string | undefined>;
const originalFetch = globalThis.fetch;

beforeEach(() => {
  savedEnv = {};
  for (const k of ENV_KEYS) savedEnv[k] = process.env[k];
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete env[k];
    else env[k] = savedEnv[k];
  }
  globalThis.fetch = originalFetch;
  jest.restoreAllMocks();
});

describe("getPaymentProvider", () => {
  it("retourne le mock par défaut (dev)", () => {
    delete process.env.PAYMENTS_PROVIDER;
    env.NODE_ENV = "test";
    expect(getPaymentProvider().name).toBe("mock");
    expect(isMockProvider()).toBe(true);
  });

  it("retourne FedaPay quand PAYMENTS_PROVIDER=fedapay ET la clé est présente", () => {
    process.env.PAYMENTS_PROVIDER = "fedapay";
    process.env.FEDAPAY_SECRET_KEY = "sk_test_123";
    expect(getPaymentProvider().name).toBe("fedapay");
  });

  it("REFUSE le repli silencieux : fedapay exigé sans clé → erreur", () => {
    process.env.PAYMENTS_PROVIDER = "fedapay";
    delete process.env.FEDAPAY_SECRET_KEY;
    expect(() => getPaymentProvider()).toThrow(PaymentConfigError);
  });

  it("REFUSE le repli silencieux : kkiapay exigé sans clé → erreur", () => {
    process.env.PAYMENTS_PROVIDER = "kkiapay";
    delete process.env.KKIAPAY_PRIVATE_KEY;
    expect(() => getPaymentProvider()).toThrow(PaymentConfigError);
  });

  it("rejette un provider inconnu", () => {
    process.env.PAYMENTS_PROVIDER = "paypal";
    expect(() => getPaymentProvider()).toThrow(PaymentConfigError);
  });

  it("INTERDIT le mock en production (paiements auto-confirmables)", () => {
    process.env.PAYMENTS_PROVIDER = "mock";
    env.NODE_ENV = "production";
    delete process.env.PAYMENTS_ALLOW_MOCK_IN_PROD;
    expect(() => getPaymentProvider()).toThrow(PaymentConfigError);
  });

  it("autorise le mock en production UNIQUEMENT avec la dérogation explicite", () => {
    process.env.PAYMENTS_PROVIDER = "mock";
    env.NODE_ENV = "production";
    process.env.PAYMENTS_ALLOW_MOCK_IN_PROD = "true";
    expect(getPaymentProvider().name).toBe("mock");
  });
});

describe("FedaPayProvider.initiate", () => {
  beforeEach(() => {
    process.env.PAYMENTS_PROVIDER = "fedapay";
    process.env.FEDAPAY_SECRET_KEY = "sk_test_secret";
    process.env.FEDAPAY_MODE = "sandbox";
    process.env.NEXT_PUBLIC_BASE_URL = "https://app.africaskills.africa";
  });

  /** Stub de fetch : 2 appels (création transaction + token). */
  function stubFedaPayApi(opts?: { failFirst?: { status: number; body: unknown } }) {
    const fetchMock = jest.fn();
    if (opts?.failFirst) {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: opts.failFirst.status,
        json: async () => opts.failFirst!.body,
      });
    } else {
      fetchMock
        .mockResolvedValueOnce({
          ok: true,
          status: 201,
          json: async () => ({
            "v1/transaction": { id: 987654, reference: "ref", status: "pending" },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            token: "tok_abc",
            url: "https://sandbox-process.fedapay.com/tok_abc",
          }),
        });
    }
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    return fetchMock;
  }

  const input = {
    amountXof: 25000,
    method: "mtn_mobile_money" as const,
    phoneNumber: "+229 01 00 00 00",
    metadata: { userId: "user-1", courseId: "course-1" },
  };

  it("crée la transaction en sandbox et renvoie référence + redirectUrl", async () => {
    const fetchMock = stubFedaPayApi();
    const provider = getPaymentProvider();
    const result = await provider.initiate(input);

    expect(result.reference).toBe("987654");
    expect(result.redirectUrl).toBe("https://sandbox-process.fedapay.com/tok_abc");
    expect(result.instructions).toContain("FCFA");

    // 1er appel : création — bonne URL sandbox, Bearer et corps
    const [url1, init1] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url1).toBe("https://sandbox-api.fedapay.com/v1/transactions");
    expect((init1.headers as Record<string, string>).Authorization).toBe(
      "Bearer sk_test_secret"
    );
    const body1 = JSON.parse(init1.body as string);
    expect(body1.amount).toBe(25000);
    expect(body1.currency.iso).toBe("XOF");
    expect(body1.custom_metadata).toEqual({ user_id: "user-1", course_id: "course-1" });
    // Numéro normalisé (plus de + ni espaces)
    expect(body1.customer.phone_number.number).toBe("22901000000");

    // 2e appel : token → URL de la page de paiement
    const [url2] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(url2).toBe("https://sandbox-api.fedapay.com/v1/transactions/987654/token");
  });

  it("utilise l'API live en mode live", async () => {
    process.env.FEDAPAY_MODE = "live";
    const fetchMock = stubFedaPayApi();
    await getPaymentProvider().initiate(input);
    const [url1] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url1).toBe("https://api.fedapay.com/v1/transactions");
  });

  it("propage une erreur explicite si FedaPay refuse la transaction", async () => {
    stubFedaPayApi({
      failFirst: {
        status: 422,
        body: { message: "Erreur de validation", errors: { amount: ["doit être positif"] } },
      },
    });
    await expect(getPaymentProvider().initiate(input)).rejects.toThrow(
      /FedaPay a refusé la transaction \(422\).*amount/
    );
  });
});
