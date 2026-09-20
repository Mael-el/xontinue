// ============================================================
// CARTE DE DOMAINE — AfricaSkills
// ============================================================

import Link from "next/link";

export interface DomainCardProps {
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  coursesCount: number;
}

export function DomainCard({
  slug,
  name,
  description,
  icon,
  color,
  coursesCount,
}: DomainCardProps) {
  return (
    <Link
      href={`/courses?domain=${slug}`}
      className="group relative overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950 p-6 transition hover:-translate-y-1 hover:border-orange-500/50 hover:shadow-2xl hover:shadow-orange-500/10"
    >
      <div
        className={`absolute -right-12 -top-12 h-32 w-32 rounded-full ${
          color ?? "bg-orange-500"
        } opacity-20 blur-2xl transition group-hover:opacity-40`}
      />
      <div className="relative">
        <div
          className={`flex h-14 w-14 items-center justify-center rounded-xl ${
            color ?? "bg-orange-500"
          } text-3xl shadow-lg`}
        >
          {icon ?? "📚"}
        </div>
        <h3 className="mt-4 text-lg font-bold text-white">{name}</h3>
        {description && (
          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-neutral-400">
            {description}
          </p>
        )}
        <div className="mt-5 flex items-center justify-between">
          <span className="text-xs font-semibold text-neutral-500">
            {coursesCount} formation{coursesCount > 1 ? "s" : ""}
          </span>
          <span className="text-sm font-semibold text-orange-500 transition group-hover:translate-x-1">
            Explorer →
          </span>
        </div>
      </div>
    </Link>
  );
}
