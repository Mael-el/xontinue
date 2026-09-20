// ============================================================
// COMPOSANT CLIENT — CARTE FORMATION DU FORMATEUR
// Statut, stats, actions : publier/dépublier, modifier,
// supprimer (refusé s'il y a des inscrits), gérer les leçons.
// ============================================================

"use client";

import { useState } from "react";
import Link from "next/link";
import type { InstructorCourse } from "@/lib/instructor";
import { formatRating, formatXof } from "@/lib/format";
import { CourseForm } from "./CourseForm";
import { LessonManager } from "./LessonManager";

interface DomainOption {
  id: string;
  name: string;
  icon: string | null;
}

export function InstructorCourseCard({
  course,
  domains,
  onChanged,
}: {
  course: InstructorCourse;
  domains: DomainOption[];
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [showLessons, setShowLessons] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  function flashInfo(message: string) {
    setInfo(message);
    setError(null);
  }
  function flashError(message: string) {
    setError(message);
    setInfo(null);
  }

  async function togglePublish() {
    const action = course.status === "published" ? "unpublish" : "publish";
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/instructor/courses/${course.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        flashError(data.error ?? "Action impossible");
        return;
      }
      flashInfo(data.message ?? "Statut mis à jour");
      onChanged();
    } catch {
      flashError("Erreur réseau");
    } finally {
      setBusy(false);
    }
  }

  async function removeCourse() {
    if (
      !window.confirm(
        `Supprimer définitivement « ${course.title} » ?\n(leçons incluses — impossible s'il y a des inscrits)`
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/instructor/courses/${course.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        flashError(data.error ?? "Suppression impossible");
        return;
      }
      onChanged();
    } catch {
      flashError("Erreur réseau");
    } finally {
      setBusy(false);
    }
  }

  const isPublished = course.status === "published";

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-5">
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-neutral-900 text-2xl">
          {course.domain.icon ?? "📚"}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-bold text-white">
              {course.title}
            </h3>
            <span
              className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                isPublished
                  ? "bg-emerald-500/15 text-emerald-300"
                  : "bg-amber-500/15 text-amber-300"
              }`}
            >
              {isPublished ? "🟢 Publiée" : "📝 Brouillon"}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-neutral-400">
            <span>{course.domain.name}</span>
            <span>🎓 {course.studentsCount} étudiants</span>
            <span>📚 {course.lessonsCount} leçons</span>
            <span>⏱️ {course.durationHours ?? 0}h</span>
            <span>
              ⭐ {formatRating(course.rating ?? 0)}
              {course.reviewsCount > 0 && ` (${course.reviewsCount})`}
            </span>
            <span>
              {course.priceXof > 0 ? formatXof(course.priceXof) : "Gratuit"}
            </span>
          </div>
          {error && (
            <div className="mt-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {error}
            </div>
          )}
          {info && (
            <div className="mt-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
              {info}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowLessons((v) => !v)}
            className={`rounded-xl border px-3.5 py-2 text-xs font-bold transition ${
              showLessons
                ? "border-orange-500/50 text-orange-300"
                : "border-neutral-700 text-neutral-300 hover:border-neutral-500"
            }`}
          >
            📚 Leçons
          </button>
          <button
            onClick={() => setEditing((v) => !v)}
            className="rounded-xl border border-neutral-700 px-3.5 py-2 text-xs font-bold text-neutral-300 transition hover:border-neutral-500"
          >
            ✏️ Modifier
          </button>
          <button
            onClick={togglePublish}
            disabled={busy}
            className={`rounded-xl px-3.5 py-2 text-xs font-bold transition disabled:opacity-50 ${
              isPublished
                ? "border border-amber-500/40 text-amber-300 hover:bg-amber-500/10"
                : "bg-gradient-to-r from-emerald-600 to-emerald-500 text-black hover:from-emerald-500 hover:to-emerald-400"
            }`}
          >
            {busy
              ? "…"
              : isPublished
                ? "⏸️ Dépublier"
                : "🚀 Publier"}
          </button>
          <button
            onClick={removeCourse}
            disabled={busy}
            className="rounded-xl border border-red-500/30 px-3 py-2 text-xs font-bold text-red-400 transition hover:bg-red-500/10 disabled:opacity-50"
          >
            🗑️
          </button>
          {isPublished && (
            <Link
              href={`/courses/${course.slug}`}
              className="rounded-xl border border-neutral-700 px-3 py-2 text-xs font-bold text-neutral-300 transition hover:border-sky-500/50 hover:text-sky-300"
              title="Voir dans le catalogue"
            >
              👁️
            </Link>
          )}
        </div>
      </div>

      {editing && (
        <div className="mt-4">
          <CourseForm
            domains={domains}
            initial={course}
            onSaved={() => {
              setEditing(false);
              onChanged();
            }}
            onCancel={() => setEditing(false)}
          />
        </div>
      )}

      {showLessons && (
        <LessonManager courseId={course.id} onChanged={onChanged} />
      )}
    </div>
  );
}
