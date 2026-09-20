// ============================================================
// COMPOSANT CLIENT — GESTION DES LEÇONS d'une formation
// Liste ordonnée, ajout (titre, vidéo, durée, contenu),
// suppression. Notifie le parent pour recalculer les compteurs.
// ============================================================

"use client";

import { useCallback, useEffect, useState } from "react";

interface Lesson {
  id: string;
  title: string;
  videoUrl: string | null;
  order: number;
  durationMinutes: number | null;
}

export function LessonManager({
  courseId,
  onChanged,
}: {
  courseId: string;
  onChanged: () => void;
}) {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [title, setTitle] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("10");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch(`/api/v1/instructor/courses/${courseId}/lessons`, {
      credentials: "include",
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setLessons(d.lessons);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [courseId]);

  useEffect(() => {
    load();
  }, [load]);

  async function addLesson(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !title.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/instructor/courses/${courseId}/lessons`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: title.trim(),
          videoUrl: videoUrl.trim(),
          content: content.trim(),
          durationMinutes: Math.max(0, Math.floor(Number(durationMinutes) || 0)),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Ajout impossible");
        return;
      }
      setTitle("");
      setVideoUrl("");
      setContent("");
      setDurationMinutes("10");
      load();
      onChanged();
    } catch {
      setError("Erreur réseau");
    } finally {
      setBusy(false);
    }
  }

  async function removeLesson(lesson: Lesson) {
    if (!window.confirm(`Supprimer la leçon « ${lesson.title} » ?`)) return;
    try {
      const res = await fetch(
        `/api/v1/instructor/courses/${courseId}/lessons/${lesson.id}`,
        { method: "DELETE", credentials: "include" }
      );
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Suppression impossible");
        return;
      }
      setLessons((prev) => prev.filter((l) => l.id !== lesson.id));
      onChanged();
    } catch {
      setError("Erreur réseau");
    }
  }

  const inputCls =
    "w-full rounded-xl border border-neutral-800 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:border-orange-500 focus:outline-none";

  return (
    <div className="mt-4 rounded-xl border border-neutral-800 bg-black/20 p-4">
      <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-neutral-400">
        📚 Leçons ({lessons.length})
      </h4>

      {lessons.length > 0 && (
        <div className="mb-3 space-y-1.5">
          {lessons.map((l, i) => (
            <div
              key={l.id}
              className="flex items-center gap-3 rounded-lg bg-neutral-950 px-3 py-2"
            >
              <span className="w-6 text-center text-xs font-black text-neutral-600">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm text-white">
                {l.title}
              </span>
              <span className="text-[10px] text-neutral-500">
                {l.videoUrl ? "🎬" : "📄"} {l.durationMinutes ?? 0} min
              </span>
              <button
                onClick={() => removeLesson(l)}
                className="rounded-lg border border-red-500/30 px-2 py-1 text-[10px] font-bold text-red-400 transition hover:bg-red-500/10"
              >
                🗑️
              </button>
            </div>
          ))}
        </div>
      )}

      {lessons.length === 0 && (
        <p className="mb-3 text-xs text-neutral-500">
          Aucune leçon pour l’instant — ajoute-en une pour pouvoir publier.
        </p>
      )}

      <form onSubmit={addLesson} className="space-y-2">
        <div className="flex gap-2">
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Titre de la leçon *"
            maxLength={200}
            className={inputCls}
          />
          <input
            type="number"
            min={0}
            max={600}
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(e.target.value)}
            className={`${inputCls} w-24`}
            title="Durée (minutes)"
          />
        </div>
        <input
          type="url"
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
          placeholder="URL vidéo (YouTube, Vimeo…) — optionnel"
          maxLength={500}
          className={inputCls}
        />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Notes / transcription (optionnel)"
          rows={2}
          className={`${inputCls} resize-none`}
        />
        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {error}
          </div>
        )}
        <button
          type="submit"
          disabled={busy || !title.trim()}
          className="rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 px-4 py-2 text-xs font-bold text-black transition hover:from-emerald-500 hover:to-emerald-400 disabled:opacity-50"
        >
          {busy ? "Ajout…" : "➕ Ajouter la leçon"}
        </button>
      </form>
    </div>
  );
}
