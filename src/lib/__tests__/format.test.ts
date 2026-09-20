// ============================================================
// TESTS — Utilitaires de formatage (src/lib/format.ts)
// ============================================================

import {
  formatXof,
  formatRating,
  formatStudents,
  rarityColor,
  levelLabel,
  jobTypeLabel,
  relativeTime,
  slugify,
  applicationStatusLabel,
  applicationStatusColor,
  type ApplicationStatus,
} from "@/lib/format";

describe("formatXof", () => {
  it("formate un montant avec séparateur de milliers et suffixe FCFA", () => {
    // fr-FR utilise un espace insécable (U+00A0) ou étroit (U+202F) selon
    // l'implémentation ICU : on normalise toutes les variantes.
    expect(formatXof(45000).replace(/[\u00a0\u202f ]/g, " ")).toBe("45 000 FCFA");
  });

  it("formate zéro", () => {
    expect(formatXof(0)).toContain("0");
    expect(formatXof(0)).toContain("FCFA");
  });

  it("formate les grands montants", () => {
    expect(formatXof(1000000).replace(/[  ]/g, " ")).toBe("1 000 000 FCFA");
  });
});

describe("formatRating", () => {
  it("divise par 10 avec une décimale", () => {
    expect(formatRating(48)).toBe("4.8");
    expect(formatRating(50)).toBe("5.0");
    expect(formatRating(0)).toBe("0.0");
  });
});

describe("formatStudents", () => {
  it("affiche le nombre brut sous 1000", () => {
    expect(formatStudents(512)).toBe("512");
    expect(formatStudents(999)).toBe("999");
  });

  it("abrège en K à partir de 1000", () => {
    expect(formatStudents(1243)).toBe("1.2K");
    expect(formatStudents(1000)).toBe("1.0K");
  });
});

describe("rarityColor", () => {
  it("retourne un dégradé distinct pour chaque rareté", () => {
    const colors = [
      rarityColor("common"),
      rarityColor("rare"),
      rarityColor("epic"),
      rarityColor("legendary"),
    ];
    expect(new Set(colors).size).toBe(4);
    for (const c of colors) expect(c).toMatch(/^from-/);
  });
});

describe("levelLabel", () => {
  it("traduit tous les niveaux en français", () => {
    expect(levelLabel("beginner")).toBe("Débutant");
    expect(levelLabel("intermediate")).toBe("Intermédiaire");
    expect(levelLabel("advanced")).toBe("Avancé");
    expect(levelLabel("expert")).toBe("Expert");
  });
});

describe("jobTypeLabel", () => {
  it("traduit tous les types d'emploi", () => {
    expect(jobTypeLabel("full_time")).toBe("Temps plein");
    expect(jobTypeLabel("part_time")).toBe("Temps partiel");
    expect(jobTypeLabel("freelance")).toBe("Freelance");
    expect(jobTypeLabel("internship")).toBe("Stage");
    expect(jobTypeLabel("contract")).toBe("CDD / Mission");
  });
});

describe("relativeTime", () => {
  it("affiche « à l'instant » pour moins d'une minute", () => {
    expect(relativeTime(new Date(Date.now() - 30_000))).toBe("à l'instant");
  });

  it("affiche les minutes, heures puis jours", () => {
    expect(relativeTime(new Date(Date.now() - 5 * 60_000))).toBe("il y a 5 min");
    expect(relativeTime(new Date(Date.now() - 3 * 3_600_000))).toBe("il y a 3 h");
    expect(relativeTime(new Date(Date.now() - 2 * 86_400_000))).toBe("il y a 2 j");
  });

  it("accepte une chaîne ISO en entrée", () => {
    const iso = new Date(Date.now() - 10 * 60_000).toISOString();
    expect(relativeTime(iso)).toBe("il y a 10 min");
  });

  it("n'affiche jamais de valeur négative (date future)", () => {
    expect(relativeTime(new Date(Date.now() + 60_000))).toBe("à l'instant");
  });
});

describe("slugify", () => {
  it("met en minuscules et remplace les espaces", () => {
    expect(slugify("Anglais Intensif 3 Mois")).toBe("anglais-intensif-3-mois");
  });

  it("supprime les accents", () => {
    expect(slugify("Cybersécurité à Cotonou")).toBe("cybersecurite-a-cotonou");
  });

  it("gère la ponctuation et les tirets superflus", () => {
    expect(slugify("  React & Next.js ! ")).toBe("react-next-js");
    expect(slugify("---déjà---slug---")).toBe("deja-slug");
  });
});

describe("applicationStatus*", () => {
  const allStatuses: ApplicationStatus[] = [
    "pending",
    "reviewed",
    "shortlisted",
    "interview",
    "accepted",
    "rejected",
    "withdrawn",
  ];

  it("a un libellé français pour chaque statut", () => {
    for (const s of allStatuses) {
      expect(applicationStatusLabel(s).length).toBeGreaterThan(0);
    }
    expect(applicationStatusLabel("pending")).toBe("En attente");
    expect(applicationStatusLabel("accepted")).toContain("Acceptée");
  });

  it("a des classes de couleur pour chaque statut", () => {
    for (const s of allStatuses) {
      expect(applicationStatusColor(s)).toMatch(/^bg-/);
    }
  });
});
