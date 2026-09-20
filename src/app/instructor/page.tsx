// ============================================================
// PAGE — ESPACE FORMATEUR
// Stats, création/édition de formations, gestion des leçons,
// publication. Réservée aux rôles instructor (et admin).
// ============================================================

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth/context";
import type { InstructorCourse } from "@/lib/instructor";
import { formatRating } from "@/lib/format";
import { CourseForm } from "./CourseForm";
import { InstructorCourseCard } from "./InstructorCourseCard";

interface InstructorData {
  courses: InstructorCourse[];
  stats: {
    coursesTotal: number;
    published: number;
    drafts: number;
    totalStudents: number;
    totalLessons: number;
    totalReviews: number;
    avgRating50: number;
  };
  domains: { id: string; name: string; icon: string | null }[];
}

export default function InstructorPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [data, setData] = useState<InstructorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  function load() {
    fetch("/api/v1/instructor/courses", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }

  useEffect(() => {
    if (isAuthenticated) load();
  }, [isAuthenticated]);

  // ---------- Chargement auth ----------
  if (authLoading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="h-8 w-64 animate-pulse rounded bg-neutral-900" />
      </div>
    );
  }

  // ---------- Non connecté ----------
  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <div className="text-6xl">🎓</div>
        <h1 className="mt-4 text-2xl font-black text-white">
          Connecte-toi pour accéder à ton espace formateur
        </h1>
        <Link
          href="/auth/login"
          className="mt-6 inline-block rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-3 text-sm font-bold text-black transition hover:from-orange-400 hover:to-amber-400"
        >
          Se connecter
        </Link>
      </div>
    );
  }

  // ---------- Mauvais rôle ----------
  if (user?.role !== "instructor" && user?.role !== "admin") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <div className="text-6xl">🧑‍🏫</div>
        <h1 className="mt-4 text-2xl font-black text-white">
          L’espace formateur est réservé aux instructeurs
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm text-neutral-400">
          Tu veux partager ton savoir avec des milliers de talents africains ?
          Écris-nous pour passer formateur : un compte instructeur te sera
          attribué après validation.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Link
            href="/about"
            className="rounded-xl border border-neutral-700 px-5 py-2.5 text-sm font-bold text-white transition hover:border-neutral-500"
          >
            Nous contacter
          </Link>
          <Link
            href="/courses"
            className="rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-2.5 text-sm font-bold text-black transition hover:from-orange-400 hover:to-amber-400"
          >
            Explorer les formations
          </Link>
        </div>
      </div>
    );
  }

  const stats = data?.stats;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      {/* En-tête */}
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-orange-500">
            Studio
          </div>
          <h1 className="mt-2 text-3xl font-black text-white sm:text-4xl">
            🎓 Espace formateur
          </h1>
          <p className="mt-2 text-sm text-neutral-400">
            Crée, enrichis et publie tes formations. Chaque brouillon devient
            publié dès qu’il a au moins une leçon.
          </p>
        </div>
        <button
          onClick={() => setShowCreate((v) => !v)}
          className="rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-2.5 text-sm font-bold text-black transition hover:from-orange-400 hover:to-amber-400"
        >
          {showCreate ? "➖ Fermer" : "➕ Nouvelle formation"}
        </button>
      </div>

      {/* Bandeau stats */}
      {stats && (
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Tile icon="📚" label="Formations" value={stats.coursesTotal} />
          <Tile icon="🟢" label="Publiées" value={stats.published} />
          <Tile icon="📝" label="Brouillons" value={stats.drafts} />
          <Tile icon="🎓" label="Étudiants" value={stats.totalStudents} />
          <Tile icon="🎬" label="Leçons" value={stats.totalLessons} />
          <Tile
            icon="⭐"
            label={`Note moyenne (${stats.totalReviews} avis)`}
            value={stats.avgRating50 > 0 ? formatRating(stats.avgRating50) : "—"}
          />
        </div>
      )}

      {/* Formulaire de création */}
      {showCreate && data && (
        <div className="mb-8">
          <CourseForm
            domains={data.domains}
            onSaved={() => {
              setShowCreate(false);
              load();
            }}
          />
        </div>
      )}

      {/* Liste des formations */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-2xl border border-neutral-800 bg-neutral-950"
            />
          ))}
        </div>
      ) : !data || data.courses.length === 0 ? (
        <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-16 text-center">
          <div className="text-5xl">🎬</div>
          <h3 className="mt-4 text-xl font-bold text-white">
            Aucune formation pour l’instant
          </h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-neutral-400">
            Crée ton premier brouillon, ajoute des leçons (2 min par leçon),
            puis publie : ta formation apparaît immédiatement dans le catalogue.
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="mt-5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-3 text-sm font-bold text-black transition hover:from-orange-400 hover:to-amber-400"
          >
            ➕ Créer ma première formation
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {data.courses.map((course) => (
            <InstructorCourseCard
              key={course.id}
              course={course}
              domains={data.domains}
              onChanged={load}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Tile({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
      <div className="flex items-center gap-2">
        <span className="text-lg">{icon}</span>
        <span className="text-lg font-black text-white">{value}</span>
      </div>
      <div className="mt-1 text-[10px] text-neutral-500">{label}</div>
    </div>
  );
}
