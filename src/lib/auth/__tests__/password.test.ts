// ============================================================
// TESTS — Hash de mots de passe & tokens (src/lib/auth/password.ts)
// ============================================================

import {
  hashPassword,
  verifyPassword,
  generateSecureToken,
  hashToken,
} from "@/lib/auth/password";

describe("hashPassword / verifyPassword", () => {
  it("vérifie un mot de passe contre son hash bcrypt", async () => {
    const hash = await hashPassword("MonMotDePasse1");
    expect(hash).not.toContain("MonMotDePasse1");
    expect(await verifyPassword("MonMotDePasse1", hash)).toBe(true);
    expect(await verifyPassword("MauvaisMotDePasse1", hash)).toBe(false);
  });

  it("produit des hash différents pour le même mot de passe (sel aléatoire)", async () => {
    const [h1, h2] = await Promise.all([
      hashPassword("MonMotDePasse1"),
      hashPassword("MonMotDePasse1"),
    ]);
    expect(h1).not.toBe(h2);
  });
});

describe("generateSecureToken", () => {
  it("génère un token hexadécimal de la longueur demandée (×2 en hex)", () => {
    const token = generateSecureToken(32);
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it("génère des tokens uniques", () => {
    expect(generateSecureToken()).not.toBe(generateSecureToken());
  });
});

describe("hashToken", () => {
  it("produit un SHA-256 hexadécimal stable", async () => {
    const hash = await hashToken("token-de-test");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    // Idempotent : même token → même hash
    expect(await hashToken("token-de-test")).toBe(hash);
    // Vecteur connu : SHA-256("token-de-test")
    expect(hash).toBe(
      "088cee27967dc09bff08ce1dc7a9193f8dfd857a5db8e3b35d97ad71a7eb29d4"
    );
  });

  it("différencie deux tokens proches", async () => {
    expect(await hashToken("aaaa")).not.toBe(await hashToken("aaab"));
  });
});
