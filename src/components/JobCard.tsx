// ============================================================
// CARTE D'OFFRE D'EMPLOI — AfricaSkills
// ============================================================

import Link from "next/link";
import { formatXof, jobTypeLabel } from "@/lib/format";

export interface JobCardProps {
  slug: string;
  title: string;
  type: "full_time" | "part_time" | "freelance" | "internship" | "contract";
  location: string | null;
  isRemote: boolean;
  salaryMinXof: number | null;
  salaryMaxXof: number | null;
  requiredBadges: string[];
  company?: {
    name: string;
    industry: string | null;
    country: string | null;
    logoUrl: string | null;
    isVerified: boolean | null;
  } | null;
}

export function JobCard({
  slug,
  title,
  type,
  location,
  isRemote,
  salaryMinXof,
  salaryMaxXof,
  requiredBadges,
  company,
}: JobCardProps) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-neutral-800 bg-gradient-to-br from-neutral-900 to-neutral-950 p-6 transition hover:border-orange-500/50">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 text-2xl">
          {company?.logoUrl ?? "🏢"}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 text-xs text-neutral-500">
            <span className="font-semibold text-neutral-300">
              {company?.name ?? "Entreprise"}
            </span>
            {company?.isVerified && (
              <span className="rounded-full bg-sky-500/20 px-2 py-0.5 text-[10px] font-bold text-sky-400">
                ✓ Vérifié
              </span>
            )}
            {company?.industry && <span>· {company.industry}</span>}
          </div>
          <h3 className="mt-1 text-base font-bold text-white group-hover:text-orange-400">
            {title}
          </h3>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-neutral-400">
            <span className="rounded-full bg-neutral-800 px-2 py-0.5">
              {jobTypeLabel(type)}
            </span>
            {location && <span>📍 {location}</span>}
            {isRemote && (
              <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 font-semibold text-emerald-400">
                🌍 Remote
              </span>
            )}
          </div>
        </div>
      </div>

      {salaryMinXof != null && salaryMaxXof != null && (
        <div className="mt-4 rounded-lg bg-black/40 px-4 py-3">
          <div className="text-[10px] uppercase tracking-wider text-neutral-500">
            Salaire annuel
          </div>
          <div className="mt-0.5 text-base font-bold text-white">
            {formatXof(salaryMinXof)} — {formatXof(salaryMaxXof)}
          </div>
        </div>
      )}

      {requiredBadges.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 text-[10px] uppercase tracking-wider text-neutral-500">
            Badges requis
          </div>
          <div className="flex flex-wrap gap-2">
            {requiredBadges.map((b) => (
              <span
                key={b}
                className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-400"
              >
                🏆 {b}
              </span>
            ))}
          </div>
        </div>
      )}

      <Link
        href={`/jobs/${slug}`}
        className="mt-5 block w-full rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-2.5 text-center text-sm font-semibold text-black transition hover:from-orange-400 hover:to-amber-400"
      >
        Voir l’offre →
      </Link>
    </div>
  );
}
