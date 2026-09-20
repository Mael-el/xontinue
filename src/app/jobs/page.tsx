// ============================================================
// PAGE — OFFRES D'EMPLOI
// ============================================================

import { db } from "@/db";
import { jobs, companies } from "@/db/schema";
import { eq, gte, desc } from "drizzle-orm";
import { JobCard } from "@/components/JobCard";

export const dynamic = "force-dynamic";

export default async function JobsPage() {
  const allJobs = await db
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
      company: {
        name: companies.name,
        industry: companies.industry,
        country: companies.country,
        logoUrl: companies.logoUrl,
        isVerified: companies.isVerified,
      },
    })
    .from(jobs)
    .leftJoin(companies, eq(jobs.companyId, companies.id))
    .where(gte(jobs.expiresAt, new Date()))
    .orderBy(desc(jobs.createdAt));

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-10">
        <div className="text-xs font-bold uppercase tracking-[0.2em] text-orange-500">
          Carrières
        </div>
        <h1 className="mt-2 text-3xl font-black text-white sm:text-4xl lg:text-5xl">
          💼 Emplois pour talents africains
        </h1>
        <p className="mt-3 max-w-2xl text-neutral-400">
          {allJobs.length} opportunités vérifiées chez nos entreprises
          partenaires. Tes badges AfricaSkills te démarquent.
        </p>
      </div>

      {/* Statistiques */}
      <div className="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <QuickStat label="Remote" value={`${allJobs.filter((j) => j.isRemote).length}`} icon="🌍" />
        <QuickStat label="Freelance" value={`${allJobs.filter((j) => j.type === "freelance").length}`} icon="⚡" />
        <QuickStat label="Stage" value={`${allJobs.filter((j) => j.type === "internship").length}`} icon="🎓" />
        <QuickStat label="Temps plein" value={`${allJobs.filter((j) => j.type === "full_time").length}`} icon="💼" />
      </div>

      {allJobs.length === 0 ? (
        <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-16 text-center">
          <div className="text-5xl">📭</div>
          <h3 className="mt-4 text-xl font-bold text-white">
            Aucune offre active pour le moment
          </h3>
          <p className="mt-2 text-neutral-400">
            Reviens bientôt, nos partenaires recrutent chaque semaine.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {allJobs.map((j) => (
              <JobCard
                key={j.id}
                slug={j.slug}
                title={j.title}
                type={j.type}
                location={j.location}
                isRemote={Boolean(j.isRemote)}
                salaryMinXof={j.salaryMinXof}
                salaryMaxXof={j.salaryMaxXof}
                requiredBadges={(j.requiredBadges ?? []) as string[]}
                company={j.company}
              />
            ))}
        </div>
      )}

      {/* CTA Recruteur */}
      <section className="mt-16 rounded-3xl border border-orange-500/30 bg-gradient-to-br from-orange-500/10 to-amber-500/5 p-8 sm:p-12">
        <div className="grid items-center gap-6 md:grid-cols-2">
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-orange-400">
              Vous recrutez ?
            </div>
            <h2 className="mt-2 text-2xl font-black text-white sm:text-3xl">
              Publiez vos offres gratuitement
            </h2>
            <p className="mt-3 text-neutral-400">
              Accédez à +12 000 talents certifiés AfricaSkills. Filtrés par
              badge, domaine et niveau. Premier mois offert.
            </p>
          </div>
          <div className="flex flex-col gap-3 md:items-end">
            <button className="rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-3.5 text-sm font-bold text-black transition hover:from-orange-400 hover:to-amber-400">
              Recruter sur AfricaSkills →
            </button>
            <button className="rounded-xl border border-neutral-700 px-6 py-3.5 text-sm font-semibold text-white transition hover:border-white/30">
              Voir nos tarifs entreprise
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function QuickStat({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: string;
}) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
      <div className="flex items-center gap-2">
        <span className="text-xl">{icon}</span>
        <span className="text-2xl font-black text-white">{value}</span>
      </div>
      <div className="mt-1 text-xs text-neutral-500">{label}</div>
    </div>
  );
}
