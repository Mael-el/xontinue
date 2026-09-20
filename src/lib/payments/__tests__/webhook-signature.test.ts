// ============================================================
// TESTS — Sécurité du webhook de paiement
// (src/lib/payments/webhook-signature.ts)
// ============================================================

import {
  computeHmacSignature,
  verifyWebhookRequest,
  mapProviderEvent,
} from "@/lib/payments/webhook-signature";

const SECRET = "test-webhook-secret";
const BODY = '{"reference":"MP-1","status":"success"}';

function makeHeaders(entries: Record<string, string>): Headers {
  return new Headers(entries);
}

describe("computeHmacSignature", () => {
  it("produit un HMAC-SHA256 hexadécimal stable", () => {
    const sig = computeHmacSignature(BODY, SECRET);
    expect(sig).toMatch(/^[0-9a-f]{64}$/);
    expect(computeHmacSignature(BODY, SECRET)).toBe(sig);
  });

  it("change dès que le corps ou le secret change", () => {
    const sig = computeHmacSignature(BODY, SECRET);
    expect(computeHmacSignature(BODY + " ", SECRET)).not.toBe(sig);
    expect(computeHmacSignature(BODY, "autre-secret")).not.toBe(sig);
  });
});

describe("verifyWebhookRequest", () => {
  const validSig = computeHmacSignature(BODY, SECRET);

  it("accepte une signature HMAC valide (x-fedapay-signature)", () => {
    const r = verifyWebhookRequest(
      BODY,
      makeHeaders({ "x-fedapay-signature": validSig }),
      SECRET
    );
    expect(r).toEqual({ ok: true, via: "hmac" });
  });

  it("accepte le préfixe « sha256= » et l'en-tête générique x-signature", () => {
    const r = verifyWebhookRequest(
      BODY,
      makeHeaders({ "x-signature": `sha256=${validSig.toUpperCase()}` }),
      SECRET
    );
    expect(r.ok).toBe(true);
  });

  it("rejette une signature valide pour un AUTRE corps (même avec le bon secret)", () => {
    const r = verifyWebhookRequest(
      '{"reference":"MP-2","status":"success"}',
      makeHeaders({ "x-fedapay-signature": validSig }),
      SECRET
    );
    expect(r.ok).toBe(false);
  });

  it("rejette une signature présente mais fausse, SANS repli sur le secret partagé", () => {
    // Même si x-webhook-secret est bon, une mauvaise signature = rejet sec
    const r = verifyWebhookRequest(
      BODY,
      makeHeaders({
        "x-fedapay-signature": "0".repeat(64),
        "x-webhook-secret": SECRET,
      }),
      SECRET
    );
    expect(r.ok).toBe(false);
  });

  it("accepte le secret partagé legacy (x-webhook-secret)", () => {
    const r = verifyWebhookRequest(
      BODY,
      makeHeaders({ "x-webhook-secret": SECRET }),
      SECRET
    );
    expect(r).toEqual({ ok: true, via: "shared-secret" });
  });

  it("rejette un secret partagé faux, même de longueur différente", () => {
    expect(
      verifyWebhookRequest(BODY, makeHeaders({ "x-webhook-secret": "non" }), SECRET).ok
    ).toBe(false);
    expect(
      verifyWebhookRequest(
        BODY,
        makeHeaders({ "x-webhook-secret": SECRET + "-pad-pad-pad" }),
        SECRET
      ).ok
    ).toBe(false);
  });

  it("rejette l'absence totale d'en-tête d'authentification", () => {
    expect(verifyWebhookRequest(BODY, makeHeaders({}), SECRET).ok).toBe(false);
  });
});

describe("mapProviderEvent", () => {
  it("mappe un événement FedaPay transaction.approved → success", () => {
    const event = mapProviderEvent({
      id: 1,
      name: "transaction.approved",
      entity: { id: 123456, status: "approved", amount: 25000 },
    });
    expect(event).toEqual({ reference: "123456", status: "success" });
  });

  it("mappe declined / canceled / refunded → failed", () => {
    for (const name of ["transaction.declined", "transaction.canceled"]) {
      expect(
        mapProviderEvent({ name, entity: { id: 99, status: name.split(".")[1] } })
      ).toEqual({ reference: "99", status: "failed" });
    }
    expect(
      mapProviderEvent({ name: "transaction.refunded", entity: { id: 5, status: "refunded" } })
    ).toEqual({ reference: "5", status: "failed" });
  });

  it("ignore les statuts intermédiaires (pending, created)", () => {
    expect(
      mapProviderEvent({ name: "transaction.created", entity: { id: 1, status: "pending" } })
    ).toBeNull();
    expect(
      mapProviderEvent({ name: "transaction.pending", entity: { id: 1, status: "pending" } })
    ).toBeNull();
  });

  it("ignore les événements non transactionnels (customer.created…)", () => {
    expect(
      mapProviderEvent({ name: "customer.created", entity: { id: 1 } })
    ).toBeNull();
  });

  it("accepte le format simple du mock", () => {
    expect(mapProviderEvent({ reference: "MP-1", status: "success" })).toEqual({
      reference: "MP-1",
      status: "success",
    });
    expect(mapProviderEvent({ reference: "MP-1", status: "failed" })).toEqual({
      reference: "MP-1",
      status: "failed",
    });
  });

  it("rejette les charges invalides", () => {
    expect(mapProviderEvent(null)).toBeNull();
    expect(mapProviderEvent("string")).toBeNull();
    expect(mapProviderEvent({})).toBeNull();
    expect(mapProviderEvent({ reference: "MP-1" })).toBeNull();
    expect(mapProviderEvent({ reference: "MP-1", status: "weird" })).toBeNull();
    expect(mapProviderEvent({ name: "transaction.approved", entity: {} })).toBeNull();
  });
});
