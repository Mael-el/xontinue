// ============================================================
// CARTE DE COURS — AfricaSkills
// ============================================================

import Link from "next/link";
import { formatXof, formatRating, formatStudents, levelLabel } from "@/lib/format";

export interface CourseCardProps {
  slug: string;
  title: string;
  subtitle?: string | null;
  level: "beginner" | "intermediate" | "advanced" | "expert";
  durationHours: number;
  priceXof: number;
  rating: number;
  studentsCount: number;
  instructorName?: string | null;
  domain?: {
    name: string;
    icon: string | null;
    color: string | null;
  } | null;
}

export function CourseCard({
  slug,
  title,
  subtitle,
  level,
  durationHours,
  priceXof,
  rating,
  studentsCount,
  instructorName,
  domain,
}: CourseCardProps) {
  return (
    <Link
      href={`/courses/${slug}`}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-neutral-800 bg-gradient-to-b from-neutral-900 to-neutral-950 transition hover:-translate-y-1 hover:border-orange-500/50 hover:shadow-2xl hover:shadow-orange-500/10"
    >
      {/* En-tête coloré avec icône de domaine */}
      <div
        className={`relative h-36 ${
          domain?.color ?? "bg-orange-500"
        } overflow-hidden`}
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.3),transparent_60%)]" />
        <div className="absolute right-4 top-4 text-6xl drop-shadow-2xl transition group-hover:scale-110 group-hover:rotate-6">
          {domain?.icon ?? "📚"}
        </div>
        <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between">
          <span className="rounded-full bg-black/30 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
            {domain?.name ?? "Formation"}
          </span>
          <span className="rounded-full bg-black/30 px-3 py-1 text-xs font-medium text-white backdrop-blur">
            {levelLabel(level)}
          </span>
        </div>
      </div>

      {/* Corps */}
      <div className="flex flex-1 flex-col p-5">
        <h3 className="line-clamp-2 text-base font-bold leading-snug text-white group-hover:text-orange-400">
          {title}
        </h3>
        {subtitle && (
          <p className="mt-1.5 line-clamp-2 text-sm text-neutral-400">
            {subtitle}
          </p>
        )}

        {/* Stats */}
        <div className="mt-4 flex items-center gap-3 text-xs text-neutral-400">
          <span className="flex items-center gap-1">
            <span className="text-amber-400">★</span>
            <span className="font-semibold text-white">
              {formatRating(rating)}
            </span>
          </span>
          <span>·</span>
          <span>{formatStudents(studentsCount)} étudiants</span>
          <span>·</span>
          <span>{durationHours}h</span>
        </div>

        {instructorName && (
          <p className="mt-3 text-xs text-neutral-500">
            par <span className="text-neutral-300">{instructorName}</span>
          </p>
        )}

        {/* Footer */}
        <div className="mt-auto flex items-center justify-between pt-4">
          <div>
            {priceXof === 0 ? (
              <span className="text-sm font-bold text-emerald-400">
                Gratuit
              </span>
            ) : (
              <span className="text-lg font-black text-white">
                {formatXof(priceXof)}
              </span>
            )}
          </div>
          <span className="text-xs font-semibold text-orange-500 opacity-0 transition group-hover:opacity-100">
            Voir →
          </span>
        </div>
      </div>
    </Link>
  );
}
