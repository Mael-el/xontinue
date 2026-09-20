// ============================================================
// TESTS — Schémas de validation Zod (src/lib/auth/validation.ts)
// ============================================================

import {
  registerEmailSchema,
  registerPhoneSchema,
  loginSchema,
  verifyOtpSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verify2faSchema,
  updateProfileSchema,
  createSkillSchema,
  createProjectSchema,
  addUserDomainSchema,
} from "@/lib/auth/validation";

// UUID v4 valide pour les tests
const UUID = "01a967fd-0fde-4816-957e-4ef94e6a5a53";

describe("registerEmailSchema", () => {
  const valid = {
    email: "Awa.Diallo@Example.COM",
    fullName: "Awa Diallo",
    password: "Passw0rd!",
  };

  it("accepte une inscription valide et normalise l'email", () => {
    const parsed = registerEmailSchema.parse(valid);
    expect(parsed.email).toBe("awa.diallo@example.com");
    expect(parsed.role).toBe("student"); // valeur par défaut
  });

  it("rejette un email invalide", () => {
    expect(() =>
      registerEmailSchema.parse({ ...valid, email: "pas-un-email" })
    ).toThrow();
  });

  it("rejette un nom trop court", () => {
    expect(() =>
      registerEmailSchema.parse({ ...valid, fullName: "A" })
    ).toThrow();
  });

  it("exige un mot de passe ≥ 8 caractères, 1 majuscule, 1 chiffre", () => {
    expect(() =>
      registerEmailSchema.parse({ ...valid, password: "court" })
    ).toThrow(); // trop court
    expect(() =>
      registerEmailSchema.parse({ ...valid, password: "toutenminuscules1" })
    ).toThrow(); // pas de majuscule
    expect(() =>
      registerEmailSchema.parse({ ...valid, password: "PasDeChiffre!" })
    ).toThrow(); // pas de chiffre
  });

  it("accepte les rôles inscriptibles et rejette admin", () => {
    expect(
      registerEmailSchema.parse({ ...valid, role: "instructor" }).role
    ).toBe("instructor");
    expect(() =>
      registerEmailSchema.parse({ ...valid, role: "admin" })
    ).toThrow();
  });
});

describe("registerPhoneSchema", () => {
  it("accepte un numéro ouest-africain typique", () => {
    const parsed = registerPhoneSchema.parse({
      phone: "+229 01 00 00 00",
      fullName: "Kofi Mensah",
      password: "Passw0rd!",
    });
    expect(parsed.phone).toContain("+229");
  });

  it("rejette un numéro trop court ou avec lettres", () => {
    const base = { fullName: "Kofi Mensah", password: "Passw0rd!" };
    expect(() =>
      registerPhoneSchema.parse({ ...base, phone: "123" })
    ).toThrow();
    expect(() =>
      registerPhoneSchema.parse({ ...base, phone: "+229abcdefgh" })
    ).toThrow();
  });
});

describe("loginSchema", () => {
  it("accepte email ou téléphone comme identifiant", () => {
    expect(
      loginSchema.parse({ identifier: "awa@example.com", password: "x" })
        .identifier
    ).toBe("awa@example.com");
    expect(
      loginSchema.parse({ identifier: "+22901000000", password: "x" })
    ).toBeTruthy();
  });

  it("rejette un identifiant trop court ou un mot de passe vide", () => {
    expect(() => loginSchema.parse({ identifier: "ab", password: "x" })).toThrow();
    expect(() =>
      loginSchema.parse({ identifier: "awa@example.com", password: "" })
    ).toThrow();
  });

  it("valide le code TOTP à 6 chiffres quand présent", () => {
    expect(
      loginSchema.parse({
        identifier: "awa@example.com",
        password: "x",
        totpCode: "123456",
      })
    ).toBeTruthy();
    expect(() =>
      loginSchema.parse({
        identifier: "awa@example.com",
        password: "x",
        totpCode: "12345",
      })
    ).toThrow();
  });
});

describe("verifyOtpSchema", () => {
  it("accepte un OTP bien formé", () => {
    const parsed = verifyOtpSchema.parse({
      userId: UUID,
      code: "825322",
      type: "email_verification",
    });
    expect(parsed.userId).toBe(UUID);
  });

  it("rejette un code à 5 chiffres, un userId non-UUID ou un type inconnu", () => {
    expect(() =>
      verifyOtpSchema.parse({ userId: UUID, code: "12345", type: "email_verification" })
    ).toThrow();
    expect(() =>
      verifyOtpSchema.parse({ userId: "pas-uuid", code: "123456", type: "email_verification" })
    ).toThrow();
    expect(() =>
      verifyOtpSchema.parse({ userId: UUID, code: "123456", type: "magic_link" })
    ).toThrow();
  });
});

describe("forgotPasswordSchema / resetPasswordSchema", () => {
  it("forgot : exige un email valide", () => {
    expect(forgotPasswordSchema.parse({ email: "Awa@X.com" }).email).toBe(
      "awa@x.com"
    );
    expect(() => forgotPasswordSchema.parse({ email: "nope" })).toThrow();
  });

  it("reset : exige un token ≥ 32 caractères et un nouveau mot de passe fort", () => {
    const token = "a".repeat(32);
    expect(
      resetPasswordSchema.parse({ token, newPassword: "NouveauPass1" })
    ).toBeTruthy();
    expect(() =>
      resetPasswordSchema.parse({ token: "court", newPassword: "NouveauPass1" })
    ).toThrow();
    expect(() =>
      resetPasswordSchema.parse({ token, newPassword: "faible" })
    ).toThrow();
  });
});

describe("verify2faSchema", () => {
  it("exige exactement 6 caractères (le contrôle TOTP valide ensuite les chiffres)", () => {
    expect(verify2faSchema.parse({ code: "123456" })).toBeTruthy();
    expect(() => verify2faSchema.parse({ code: "12345" })).toThrow(); // trop court
    expect(() => verify2faSchema.parse({ code: "1234567" })).toThrow(); // trop long
  });
});

describe("updateProfileSchema", () => {
  it("accepte un objet vide (tout est optionnel)", () => {
    expect(updateProfileSchema.parse({})).toEqual({});
  });

  it("accepte des URLs valides ou une chaîne vide pour website/linkedin", () => {
    const parsed = updateProfileSchema.parse({
      website: "https://awa.dev",
      linkedin: "",
      github: "awad",
    });
    expect(parsed.website).toBe("https://awa.dev");
    expect(parsed.linkedin).toBe("");
  });

  it("rejette une URL de site invalide", () => {
    expect(() =>
      updateProfileSchema.parse({ website: "pas une url" })
    ).toThrow();
  });

  it("rejette une bio de plus de 1000 caractères", () => {
    expect(() =>
      updateProfileSchema.parse({ bio: "x".repeat(1001) })
    ).toThrow();
  });
});

describe("createSkillSchema / addUserDomainSchema", () => {
  it("applique le niveau par défaut", () => {
    expect(createSkillSchema.parse({ name: "React" }).level).toBe("beginner");
    expect(addUserDomainSchema.parse({ domainSlug: "dev" }).level).toBe("novice");
  });

  it("rejette un niveau inconnu", () => {
    expect(() =>
      createSkillSchema.parse({ name: "React", level: "godlike" })
    ).toThrow();
  });
});

describe("createProjectSchema", () => {
  it("applique les valeurs par défaut", () => {
    const parsed = createProjectSchema.parse({ title: "Mon app" });
    expect(parsed.technologies).toEqual([]);
    expect(parsed.isFeatured).toBe(false);
  });

  it("rejette plus de 20 technologies", () => {
    expect(() =>
      createProjectSchema.parse({
        title: "Mon app",
        technologies: Array.from({ length: 21 }, (_, i) => `tech-${i}`),
      })
    ).toThrow();
  });

  it("rejette une URL de repo invalide mais accepte une chaîne vide", () => {
    expect(() =>
      createProjectSchema.parse({ title: "x", repoUrl: "github .com/a" })
    ).toThrow();
    expect(
      createProjectSchema.parse({ title: "x", repoUrl: "" }).repoUrl
    ).toBe("");
  });
});
