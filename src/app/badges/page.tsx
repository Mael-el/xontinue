// ============================================================
// PAGE — BADGES & CERTIFICATIONS
// ============================================================

import { db } from "@/db";
import { badges, domains } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { BadgeCard } from "@/components/BadgeCard";

export const dynamic = "force-dynamic";

export default async function BadgesPage() {
  const allBadges = await db
    .select({
      slug: badges.slug,
      name: badges.name,
      description: badges.description,
      icon: badges.icon,
      rarity: badges.rarity,
      requiredXp: badges.requiredXp,
      domain: {
        name: domains.name,
        icon: domains.icon,
      },
    })
    .from(badges)
    .leftJoin(domains, eq(badges.domainId, domains.id))
    .orderBy(asc(badges.requiredXp));

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-10">
        <div className="text-xs font-bold uppercase tracking-[0.2em] text-orange-500">
          Certifications
        </div>
        <h1 className="mt-2 text-3xl font-black text-white sm:text-4xl lg:text-5xl">
          🏆 Décroche tes badges.
        </h1>
        <p className="mt-3 max-w-2xl text-neutral-400">
          Chaque formation terminée, chaque projet livré, chaque compétence
          validée te rapporte de l&apos;XP et débloque des badges reconnus par nos
          entreprises partenaires.
        </p>
      </div>

      {/* Légende raretés */}
      <div className="mb-8 flex flex-wrap gap-3">
        <RarityChip
          label="Commun"
          gradient="from-slate-400 to-slate-600"
          description="100+ XP"
        />
        <RarityChip
          label="Rare"
          gradient="from-sky-400 to-blue-600"
          description="600+ XP"
        />
        <RarityChip
          label="Épique"
          gradient="from-purple-400 to-fuchsia-600"
          description="1500+ XP"
        />
        <RarityChip
          label="Légendaire"
          gradient="from-amber-400 via-orange-500 to-red-600"
          description="2500+ XP"
        />
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {allBadges.map((b) => (
          <BadgeCard
            key={b.slug}
            name={b.name}
            description={b.description}
            icon={b.icon}
            rarity={b.rarity}
            requiredXp={b.requiredXp}
            domain={b.domain}
          />
        ))}
      </div>

      {/* Section "Comment ça marche" */}
      <section className="mt-16 rounded-3xl border border-neutral-800 bg-neutral-950 p-8 sm:p-12">
        <h2 className="text-2xl font-black text-white sm:text-3xl">
          Comment gagner de l&apos;XP ?
        </h2>
        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <XpAction icon="📹" label="Terminer une leçon" xp="+10 à +50 XP" />
          <XpAction icon="🎯" label="Réussir un quiz" xp="+25 XP" />
          <XpAction icon="🛠️" label="Livrer un projet" xp="+200 XP" />
          <XpAction icon="🇬🇧" label="Session anglais" xp="+15 XP" />
        </div>
      </section>
    </div>
  );
}

function RarityChip({
  label,
  gradient,
  description,
}: {
  label: string;
  gradient: string;
  description: string;
}) {
  return (
    <div
      className={`flex items-center gap-2 rounded-full bg-gradient-to-r ${gradient} px-4 py-1.5 text-xs font-bold text-white shadow-lg`}
    >
      <span>{label}</span>
      <span className="opacity-70">· {description}</span>
    </div>
  );
}

function XpAction({
  icon,
  label,
  xp,
}: {
  icon: string;
  label: string;
  xp: string;
}) {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-black/30 p-5">
      <div className="text-3xl">{icon}</div>
      <div className="mt-3 text-sm font-bold text-white">{label}</div>
      <div className="mt-1 text-sm font-semibold text-amber-400">{xp}</div>
    </div>
  );
}
