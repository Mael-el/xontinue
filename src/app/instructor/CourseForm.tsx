// ============================================================
// COMPOSANT CLIENT — FORMULAIRE FORMATION (créer / modifier)
// Mode création → POST, mode édition (initial fourni) → PATCH.
// Prérequis / acquis : un par ligne dans le textarea.
// ============================================================

"use client";

import { useState } from "react";
import type { InstructorCourse } from "@/lib/instructor";

interface DomainOption {
  id: string;
  name: string;
  icon: string | null;
}

export function CourseForm({
  domains,
  initial,
  onSaved,
  onCancel,
}: {
  domains: DomainOption[];
  initial?: InstructorCourse | null;
  onSaved: () => void;
  onCancel?: () => void;
}) {
  const isEdit = Boolean(initial);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [subtitle, setSubtitle] = useState(initial?.subtitle ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [domainId, setDomainId] = useState(initial?.domainId ?? domains[0]?.id ?? "");
  const [level, setLevel] = useState(initial?.level ?? "beginner");
  const [priceXof, setPriceXof] = useState(String(initial?.priceXof ?? 0));
  const [thumbnailUrl, setThumbnailUrl] = useState(initial?.thumbnailUrl ?? "");
  const [requirements, setRequirements] = useState(
    (initial?.requirements ?? []).join("\n")
  );
  const [whatYouLearn, setWhatYouLearn] = useState(
    (initial?.whatYouLearn ?? []).join("\n")
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Texte multi-lignes → tableau propre */
  function lines(value: string): string[] {
    return value
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, 20);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);

    const payload = {
      title: title.trim(),
      subtitle: subtitle.trim(),
      description: description.trim(),
      domainId,
      level,
      priceXof: Math.max(0, Math.floor(Number(priceXof) || 0)),
      thumbnailUrl: thumbnailUrl.trim(),
      requirements: lines(requirements),
      whatYouLearn: lines(whatYouLearn),
    };

    try {
      const res = await fetch(
        isEdit ? `/api/v1/instructor/courses/${initial!.id}` : "/api/v1/instructor/courses",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Enregistrement impossible");
        return;
      }
      onSaved();
    } catch {
      setError("Erreur réseau");
    } finally {
      setSubmitting(false);
    }
  }

  const inputCls =
    "w-full rounded-xl border border-neutral-800 bg-black/30 px-4 py-2.5 text-sm text-white placeholder:text-neutral-600 focus:border-orange-500 focus:outline-none";

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-2xl border border-orange-500/30 bg-neutral-950 p-5"
    >
      <h3 className="text-sm font-bold text-white">
        {isEdit ? "✏️ Modifier la formation" : "➕ Créer une formation"}
      </h3>

      <input
        required
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Titre de la formation *"
        maxLength={200}
        className={inputCls}
      />
      <input
        value={subtitle}
        onChange={(e) => setSubtitle(e.target.value)}
        placeholder="Sous-titre accrocheur (optionnel)"
        maxLength={500}
        className={inputCls}
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description complète (optionnel)"
        rows={4}
        className={`${inputCls} resize-none`}
      />

      <div className="grid gap-2 sm:grid-cols-3">
        <select
          value={domainId}
          onChange={(e) => setDomainId(e.target.value)}
          className={inputCls}
        >
          {domains.map((d) => (
            <option key={d.id} value={d.id}>
              {d.icon} {d.name}
            </option>
          ))}
        </select>
        <select
          value={level}
          onChange={(e) => setLevel(e.target.value)}
          className={inputCls}
        >
          <option value="beginner">🌱 Débutant</option>
          <option value="intermediate">📈 Intermédiaire</option>
          <option value="advanced">🚀 Avancé</option>
          <option value="expert">🏆 Expert</option>
        </select>
        <input
          type="number"
          min={0}
          step={500}
          value={priceXof}
          onChange={(e) => setPriceXof(e.target.value)}
          placeholder="Prix (FCFA, 0 = gratuit)"
          className={inputCls}
        />
      </div>

      <input
        type="url"
        value={thumbnailUrl}
        onChange={(e) => setThumbnailUrl(e.target.value)}
        placeholder="URL de la miniature (optionnel)"
        maxLength={500}
        className={inputCls}
      />

      <div className="grid gap-2 sm:grid-cols-2">
        <textarea
          value={whatYouLearn}
          onChange={(e) => setWhatYouLearn(e.target.value)}
          placeholder={"Ce que les étudiants apprendront\n(un point par ligne)"}
          rows={3}
          className={`${inputCls} resize-none`}
        />
        <textarea
          value={requirements}
          onChange={(e) => setRequirements(e.target.value)}
          placeholder={"Prérequis\n(un point par ligne)"}
          rows={3}
          className={`${inputCls} resize-none`}
        />
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-xs text-red-300">
          {error}
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={submitting || !title.trim() || !domainId}
          className="rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-2.5 text-xs font-bold text-black transition hover:from-orange-400 hover:to-amber-400 disabled:opacity-50"
        >
          {submitting
            ? "Enregistrement…"
            : isEdit
              ? "💾 Enregistrer"
              : "➕ Créer le brouillon"}
        </button>
        {isEdit && onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-neutral-700 px-4 py-2.5 text-xs font-bold text-neutral-300 transition hover:border-neutral-500"
          >
            Annuler
          </button>
        )}
      </div>
    </form>
  );
}
