// ============================================================
// TESTS — Invariants du catalogue seed (12 domaines couverts,
// chaque cours a ses leçons, tout le monde est gratuit)
// Fonctions données : aucune BDD requise.
// ============================================================

import {
  SEED_DOMAINS,
  SEED_COURSES,
  SEED_LESSONS,
} from "@/lib/seed-data";

describe("catalogue seed — couverture des domaines", () => {
  const domainSlugs = new Set<string>(SEED_DOMAINS.map((d) => d.slug));

  it("12 domaines (anglais imposé + 11 autres)", () => {
    expect(SEED_DOMAINS).toHaveLength(12);
  });

  it("chaque domaine a AU MOINS 2 cours", () => {
    const perDomain = new Map<string, number>();
    for (const c of SEED_COURSES) {
      perDomain.set(c.domainSlug, (perDomain.get(c.domainSlug) ?? 0) + 1);
    }
    for (const d of SEED_DOMAINS) {
      expect(perDomain.get(d.slug) ?? 0).toBeGreaterThanOrEqual(2);
    }
  });

  it("tous les cours référencent un domaine existant", () => {
    for (const c of SEED_COURSES) {
      expect(domainSlugs.has(c.domainSlug)).toBe(true);
    }
  });

  it("les slugs de cours sont uniques", () => {
    const slugs = SEED_COURSES.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});

describe("catalogue seed — gratuité et leçons", () => {
  it("toutes les formations sont gratuites (priceXof = 0)", () => {
    for (const c of SEED_COURSES) {
      expect(c.priceXof).toBe(0);
    }
  });

  it("chaque cours a une séquence de leçons (≥ 6)", () => {
    for (const c of SEED_COURSES) {
      const titles = SEED_LESSONS[c.slug];
      if (!titles) throw new Error(`leçons manquantes pour « ${c.slug} »`);
      expect(titles.length).toBeGreaterThanOrEqual(6);
    }
  });

  it("chaque cours déclare un instructeur nommé", () => {
    for (const c of SEED_COURSES) {
      expect(c.instructorName.trim().length).toBeGreaterThan(2);
    }
  });

  it("les entrées de SEED_LESSONS pointent vers des cours", () => {
    const courseSlugs = new Set<string>(SEED_COURSES.map((c) => c.slug));
    for (const slug of Object.keys(SEED_LESSONS)) {
      expect(courseSlugs.has(slug)).toBe(true);
    }
  });
});
