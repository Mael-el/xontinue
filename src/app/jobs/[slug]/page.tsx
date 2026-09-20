// ============================================================
// PAGE — DÉTAIL D'UNE OFFRE D'EMPLOI
// ============================================================

import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { jobs, companies } from "@/db/schema";
import { eq } from "drizzle-orm";
import { formatXof, jobTypeLabel } from "@/lib/format";
import { JobApplyPanel } from "./JobApplyPanel";

export const dynamic = "force-dynamic";

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const [job] = await db
    .select({
      id: jobs.id,
      slug: jobs.slug,
      title: jobs.title,
      description: jobs.description,
      type: jobs.type,
      location: jobs.location,
      isRemote: jobs.isRemote,
      salaryMinXof: jobs.salaryMinXof,
      salaryMaxXof: jobs.salaryMaxXof,
      requiredBadges: jobs.requiredBadges,
      applicationsCount: jobs.applicationsCount,
      expiresAt: jobs.expiresAt,
      createdAt: jobs.createdAt,
      company: {
        name: companies.name,
        industry: companies.industry,
        country: companies.country,
        city: companies.city,
        logoUrl: companies.logoUrl,
        description: companies.description,
        website: companies.website,
        isVerified: companies.isVerified,
      },
    })
    .from(jobs)
    .leftJoin(companies, eq(jobs.companyId, companies.id))
    .where(eq(jobs.slug, slug))
    .limit(1);

  if (!job) notFound();

  const requiredBadges = (job.requiredBadges ?? []) as string[];
  // new Date() : pattern déjà utilisé par /jobs (accepté par le lint React Compiler)
  const isOpen = !job.expiresAt || job.expiresAt > new Date();

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Fil d'ariane */}
      <nav className="mb-6 flex items-center gap-2 text-sm text-neutral-500">
        <Link href="/jobs" className="hover:text-white">
          Emplois
        </Link>
        <span>›</span>
        <span className="truncate text-neutral-300">{job.title}</span>
      </nav>

      <div className="grid gap-10 lg:grid-cols-3">
        {/* Colonne principale */}
        <div className="lg:col-span-2">
          {/* En-tête */}
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 text-4xl">
              {job.company?.logoUrl ?? "🏢"}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-sm text-neutral-400">
                <span className="font-semibold text-neutral-200">
                  {job.company?.name ?? "Entreprise"}
                </span>
                {job.company?.isVerified && (
                  <span className="rounded-full bg-sky-500/20 px-2 py-0.5 text-[10px] font-bold text-sky-400">
                    ✓ Vérifié
                  </span>
                )}
                {job.company?.industry && <span>· {job.company.industry}</span>}
              </div>
              <h1 className="mt-1 text-2xl font-black text-white sm:text-3xl lg:text-4xl">
                {job.title}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full bg-neutral-800 px-3 py-1 font-semibold text-neutral-300">
                  {jobTypeLabel(job.type)}
                </span>
                {job.location && (
                  <span className="rounded-full bg-neutral-800 px-3 py-1 text-neutral-300">
                    📍 {job.location}
                  </span>
                )}
                {job.isRemote && (
                  <span className="rounded-full bg-emerald-500/20 px-3 py-1 font-semibold text-emerald-400">
                    🌍 Remote
                  </span>
                )}
                {!isOpen && (
                  <span className="rounded-full bg-red-500/20 px-3 py-1 font-semibold text-red-400">
                    Offre expirée
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Description */}
          <section className="mt-10 rounded-2xl border border-neutral-800 bg-neutral-950 p-6">
            <h2 className="text-xl font-bold text-white">
              📋 Description du poste
            </h2>
            <p className="mt-4 whitespace-pre-line leading-relaxed text-neutral-300">
              {job.description ?? "Description détaillée à venir."}
            </p>
          </section>

          {/* Badges requis */}
          {requiredBadges.length > 0 && (
            <section className="mt-6 rounded-2xl border border-neutral-800 bg-neutral-950 p-6">
              <h2 className="text-xl font-bold text-white">
                🏆 Badges requis
              </h2>
              <p className="mt-2 text-sm text-neutral-500">
                Ces certifications AfricaSkills te démarquent pour ce poste.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {requiredBadges.map((b) => (
                  <span
                    key={b}
                    className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-sm font-semibold text-amber-400"
                  >
                    🏆 {b}
                  </span>
                ))}
              </div>
              <Link
                href="/badges"
                className="mt-4 inline-block text-xs font-semibold text-orange-400 hover:text-orange-300"
              >
                Obtenir ces badges →
              </Link>
            </section>
          )}
        </div>

        {/* Colonne latérale */}
        <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          {/* Panneau de candidature (client) */}
          <JobApplyPanel jobId={job.id} jobTitle={job.title} isOpen={isOpen} />

          {/* Salaire + infos */}
          <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6">
            {job.salaryMinXof != null && job.salaryMaxXof != null && (
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                  Salaire annuel
                </div>
                <div className="mt-1 text-lg font-black text-white">
                  {formatXof(job.salaryMinXof)} — {formatXof(job.salaryMaxXof)}
                </div>
              </div>
            )}
            <div className="mt-4 space-y-2 border-t border-neutral-800 pt-4 text-xs text-neutral-500">
              <div className="flex justify-between">
                <span>Candidatures</span>
                <span className="font-semibold text-neutral-300">
                  {job.applicationsCount ?? 0}
                </span>
              </div>
              {job.expiresAt && (
                <div className="flex justify-between">
                  <span>Expire le</span>
                  <span className="font-semibold text-neutral-300">
                    {job.expiresAt.toLocaleDateString("fr-FR", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Publiée le</span>
                <span className="font-semibold text-neutral-300">
                  {job.createdAt.toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              </div>
            </div>
          </div>

          {/* Carte entreprise */}
          {job.company && (
            <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6">
              <div className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                À propos de l’entreprise
              </div>
              <div className="mt-3 flex items-center gap-3">
                <span className="text-3xl">{job.company.logoUrl ?? "🏢"}</span>
                <div>
                  <div className="font-bold text-white">{job.company.name}</div>
                  <div className="text-xs text-neutral-500">
                    {[job.company.city, job.company.country]
                      .filter(Boolean)
                      .join(", ")}
                  </div>
                </div>
              </div>
              {job.company.description && (
                <p className="mt-3 text-sm leading-relaxed text-neutral-400">
                  {job.company.description}
                </p>
              )}
              {job.company.website && (
                <a
                  href={job.company.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-block text-xs font-semibold text-orange-400 hover:text-orange-300"
                >
                  Visiter le site →
                </a>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
