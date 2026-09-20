// ============================================================
// COMPOSANT CLIENT — BARRE DE FILTRES DU CATALOGUE
// Recherche (Entrée / bouton) + selects niveau, prix, tri.
// Met à jour l'URL (SSR préservé), sans recharger la page.
// ============================================================

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  COURSE_SORTS,
  courseSortLabel,
  type CourseLevel,
  type CoursePriceFilter,
  type CourseSort,
} from "@/lib/courses-query";
import { levelLabel } from "@/lib/format";

interface Props {
  /** Valeurs courantes issues des searchParams (validation serveur) */
  domain?: string;
  q?: string;
  level?: CourseLevel;
  price?: CoursePriceFilter;
  sort: CourseSort;
}

const LEVEL_OPTIONS: Array<{ value: "" | CourseLevel; label: string }> = [
  { value: "", label: "Tous niveaux" },
  { value: "beginner", label: levelLabel("beginner") },
  { value: "intermediate", label: levelLabel("intermediate") },
  { value: "advanced", label: levelLabel("advanced") },
  { value: "expert", label: levelLabel("expert") },
];

const PRICE_OPTIONS: Array<{ value: "" | CoursePriceFilter; label: string }> = [
  { value: "", label: "Tous prix" },
  { value: "free", label: "Gratuit" },
  { value: "paid", label: "Payant" },
];

export function CourseFiltersBar({ domain, q, level, price, sort }: Props) {
  const router = useRouter();
  const [searchText, setSearchText] = useState(q ?? "");

  /** Construit l'URL avec les filtres (paramètres vides omis). */
  function push(overrides: Partial<{
    q: string;
    level: string;
    price: string;
    sort: string;
  }>) {
    const next = {
      q: searchText.trim(),
      level: level ?? "",
      price: price ?? "",
      sort,
      ...overrides,
    };
    const params = new URLSearchParams();
    if (domain) params.set("domain", domain);
    if (next.q) params.set("q", next.q);
    if (next.level) params.set("level", next.level);
    if (next.price) params.set("price", next.price);
    if (next.sort && next.sort !== "popular") params.set("sort", next.sort);

    const qs = params.toString();
    router.push(`/courses${qs ? `?${qs}` : ""}`, { scroll: false });
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    push({ q: searchText.trim() });
  }

  return (
    <div className="mb-8 space-y-3">
      {/* Recherche plein texte */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder="🔍 Rechercher une formation (titre, description)…"
          className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-4 py-3 text-white placeholder-neutral-500 outline-none transition focus:border-orange-500"
        />
        <button
          type="submit"
          className="shrink-0 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-3 text-sm font-bold text-black transition hover:from-orange-400 hover:to-amber-400"
        >
          Chercher
        </button>
      </form>

      {/* Selects niveau / prix / tri + reset */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={level ?? ""}
          onChange={(e) => push({ level: e.target.value })}
          className={selectClass}
          aria-label="Filtrer par niveau"
        >
          {LEVEL_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <select
          value={price ?? ""}
          onChange={(e) => push({ price: e.target.value })}
          className={selectClass}
          aria-label="Filtrer par prix"
        >
          {PRICE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <select
          value={sort}
          onChange={(e) => push({ sort: e.target.value })}
          className={selectClass}
          aria-label="Trier les formations"
        >
          {COURSE_SORTS.map((s) => (
            <option key={s} value={s}>
              ↕ {courseSortLabel(s)}
            </option>
          ))}
        </select>

        {(q || level || price || sort !== "popular") && (
          <button
            onClick={() => {
              setSearchText("");
              const params = new URLSearchParams();
              if (domain) params.set("domain", domain);
              const qs = params.toString();
              router.push(`/courses${qs ? `?${qs}` : ""}`, { scroll: false });
            }}
            className="rounded-xl border border-neutral-800 px-4 py-2 text-xs font-semibold text-neutral-400 transition hover:border-red-500/40 hover:text-red-400"
          >
            ✕ Réinitialiser
          </button>
        )}
      </div>
    </div>
  );
}

const selectClass =
  "rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2 text-xs font-semibold text-neutral-200 outline-none transition focus:border-orange-500";
