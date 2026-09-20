// ============================================================
// TESTS — Codes d'invitation workspace
// (src/lib/workspaces/invites.ts)
// ============================================================

import {
  generateInviteCode,
  normalizeInviteCode,
  checkInviteValidity,
} from "@/lib/workspaces/invites";

describe("generateInviteCode", () => {
  it("génère un code de 8 caractères dans l'alphabet sans confusion", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateInviteCode();
      expect(code).toHaveLength(8);
      expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/);
    }
  });

  it("ne produit quasiment jamais deux fois le même code (collision)", () => {
    const codes = new Set(Array.from({ length: 1000 }, generateInviteCode));
    // 1000 tirages sur ~2,8e12 possibilités : aucune collision attendue
    expect(codes.size).toBe(1000);
  });
});

describe("normalizeInviteCode", () => {
  it("met en majuscules et retire tirets/espaces/caractères spéciaux", () => {
    expect(normalizeInviteCode("k7m2-qx9d")).toBe("K7M2QX9D");
    expect(normalizeInviteCode("  ab12  cd34 ")).toBe("AB12CD34");
    expect(normalizeInviteCode("K7M2–QX9D")).toBe("K7M2QX9D"); // tiret long
  });

  it("est idempotent", () => {
    const c = generateInviteCode();
    expect(normalizeInviteCode(normalizeInviteCode(c))).toBe(normalizeInviteCode(c));
  });
});

describe("checkInviteValidity", () => {
  const now = new Date("2026-09-20T12:00:00Z");

  it("valide une invitation sans limites", () => {
    expect(
      checkInviteValidity({ expiresAt: null, maxUses: null, usesCount: 0 }, now).ok
    ).toBe(true);
  });

  it("rejette une invitation expirée", () => {
    const v = checkInviteValidity(
      { expiresAt: new Date("2026-09-20T11:59:59Z"), maxUses: null, usesCount: 0 },
      now
    );
    expect(v).toEqual({ ok: false, reason: "expired" });
  });

  it("accepte une invitation qui expire dans le futur", () => {
    const v = checkInviteValidity(
      { expiresAt: new Date("2026-09-20T12:00:01Z"), maxUses: null, usesCount: 0 },
      now
    );
    expect(v.ok).toBe(true);
  });

  it("rejette une invitation épuisée (max d'utilisations)", () => {
    const v = checkInviteValidity(
      { expiresAt: null, maxUses: 5, usesCount: 5 },
      now
    );
    expect(v).toEqual({ ok: false, reason: "exhausted" });
  });

  it("une utilisation restante reste valide", () => {
    const v = checkInviteValidity(
      { expiresAt: null, maxUses: 5, usesCount: 4 },
      now
    );
    expect(v.ok).toBe(true);
  });
});
