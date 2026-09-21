// ============================================================
// TESTS — Dérivation de l'URL publique du serveur temps réel
// (Host preview E2B « 3000-<id>.e2b.app » → « 3001-<id>.e2b.app »,
// jamais de localhost face au navigateur du visiteur)
// ============================================================

// Test de la fonction pure (aucune dépendance Next.js).
import { publicRealtimeUrl } from "@/lib/realtime/public-url";

// Stub minimal : jsdom n'a pas Request — publicRealtimeUrl ne lit
// que headers.get("host") et req.url (en fallback).
function reqWithHost(host: string | null): Request {
  const headers = new Headers();
  if (host) headers.set("host", host);
  return {
    headers,
    url: "http://localhost/api/v1/realtime/token",
  } as unknown as Request;
}

describe("publicRealtimeUrl", () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV };
    delete process.env.NEXT_PUBLIC_REALTIME_URL;
  });
  afterAll(() => {
    process.env = OLD_ENV;
  });

  it("Host preview E2B → URL publique du port 3001 (prioritaire sur env localhost)", () => {
    process.env.NEXT_PUBLIC_REALTIME_URL = "http://localhost:3001";
    expect(publicRealtimeUrl(reqWithHost("3000-abc123def.e2b.app"))).toBe(
      "https://3001-abc123def.e2b.app"
    );
  });

  it("Host preview avec sous-domaine complet conservé", () => {
    expect(
      publicRealtimeUrl(reqWithHost("3000-w1-x2-y3.e2b.dev"))
    ).toBe("https://3001-w1-x2-y3.e2b.dev");
  });

  it("override env étranger (prod dédiée) respecté sur host sans motif", () => {
    process.env.NEXT_PUBLIC_REALTIME_URL = "https://rt.africaskills.africa/";
    expect(publicRealtimeUrl(reqWithHost("app.africaskills.africa"))).toBe(
      "https://rt.africaskills.africa"
    );
  });

  it("fallback localhost en développement sans env ni motif", () => {
    expect(publicRealtimeUrl(reqWithHost("localhost:3000"))).toBe(
      "http://localhost:3001"
    );
    expect(publicRealtimeUrl(reqWithHost(null))).toBe(
      "http://localhost:3001"
    );
  });

  it("slash final trimmé sur l'override env", () => {
    process.env.NEXT_PUBLIC_REALTIME_URL = "https://rt.example.com//";
    expect(publicRealtimeUrl(reqWithHost("x.example.com"))).toBe(
      "https://rt.example.com"
    );
  });
});
