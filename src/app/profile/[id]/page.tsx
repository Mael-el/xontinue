// ============================================================
// PAGE — Profil public
// ============================================================

import { notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Appel interne à notre API
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const res = await fetch(`${baseUrl}/api/v1/profiles/${id}`, {
    cache: "no-store",
  });
  if (!res.ok) notFound();
  const data = await res.json();
  if (!data.ok) notFound();

  const { profile, skills, projects, badges, domains, certificates, reviews, statistics } = data;

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      {/* Cover + avatar */}
      <div className="relative h-48 overflow-hidden rounded-3xl bg-gradient-to-br from-orange-500 via-amber-500 to-emerald-500 sm:h-64">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.3),transparent_60%)]" />
      </div>

      <div className="relative -mt-16 flex flex-col gap-6 px-4 sm:-mt-20 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-end gap-4">
          <div className="flex h-32 w-32 items-center justify-center rounded-full border-4 border-[#0A0A0A] bg-gradient-to-br from-orange-500 to-amber-500 text-5xl shadow-xl">
            {profile.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.avatarUrl}
                alt={profile.fullName}
                className="h-full w-full rounded-full object-cover"
              />
            ) : (
              <span>👤</span>
            )}
          </div>
          <div className="pb-2">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-white sm:text-3xl">
                {profile.fullName}
              </h1>
              {profile.isVerifiedIdentity && (
                <span className="rounded-full bg-sky-500/20 px-2 py-0.5 text-[10px] font-bold text-sky-400">
                  ✓ VÉRIFIÉ
                </span>
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-neutral-400">
              <span className="rounded-full bg-neutral-900 px-2.5 py-0.5 text-xs font-semibold capitalize text-orange-400">
                {profile.role}
              </span>
              {profile.country && <span>📍 {profile.country}</span>}
              {profile.city && <span>· {profile.city}</span>}
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Link
            href="/jobs"
            className="rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-2.5 text-sm font-bold text-black"
          >
            Contacter
          </Link>
          <button className="rounded-xl border border-neutral-700 px-5 py-2.5 text-sm font-semibold text-white">
            Suivre
          </button>
        </div>
      </div>

      {/* Stats rapides */}
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <MiniStat icon="⚡" label="XP" value={profile.xp} />
        <MiniStat icon="🏅" label="Rang classement" value={`#${statistics.rank}`} />
        <MiniStat icon="🔥" label="Streak" value={`${profile.streak}j`} />
        <MiniStat icon="🎓" label="Cours terminés" value={statistics.coursesCompleted} />
        <MiniStat icon="🏆" label="Badges" value={statistics.badgesCount} />
      </div>

      {/* Bio */}
      {profile.bio && (
        <section className="mt-8 rounded-2xl border border-neutral-800 bg-neutral-950 p-6">
          <h2 className="mb-3 text-lg font-bold text-white">À propos</h2>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-300">
            {profile.bio}
          </p>
        </section>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Certificats — formations terminées (vérifiables) */}
          {certificates.length > 0 && (
            <Section title="📜 Certificats vérifiés">
              <div className="grid gap-3 sm:grid-cols-2">
                {certificates.map((c: any) => (
                  <Link
                    key={c.enrollmentId}
                    href={`/certificates/${c.enrollmentId}`}
                    className="group flex items-center gap-3 rounded-xl border border-neutral-800 bg-black/30 p-4 transition hover:border-emerald-500/40"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-neutral-900 text-xl">
                      {c.domainIcon ?? "🎓"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-bold text-white">
                        {c.title}
                      </div>
                      <div className="text-[11px] text-neutral-500">
                        {c.durationHours ?? 0}h · terminée le{" "}
                        {new Date(c.completedAt).toLocaleDateString("fr-FR", {
                          month: "long",
                          year: "numeric",
                        })}
                      </div>
                    </div>
                    <span className="shrink-0 text-xs font-bold text-emerald-400 transition group-hover:translate-x-0.5">
                      Vérifier →
                    </span>
                  </Link>
                ))}
              </div>
            </Section>
          )}

          {/* Domaines */}
          {domains.length > 0 && (
            <Section title="🎯 Domaines d'intérêt">
              <div className="flex flex-wrap gap-2">
                {domains.map((d: any) => (
                  <span
                    key={d.slug}
                    className="rounded-full border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-sm"
                  >
                    {d.icon} {d.name}{" "}
                    <span className="ml-1 text-xs text-neutral-500">
                      · {d.level}
                    </span>
                  </span>
                ))}
              </div>
            </Section>
          )}

          {/* Avis laissés — témoignages vérifiés */}
          {reviews.length > 0 && (
            <Section title="⭐ Avis laissés">
              <div className="grid gap-3 sm:grid-cols-2">
                {reviews.map((r: any, i: number) => (
                  <div
                    key={i}
                    className="rounded-xl border border-neutral-800 bg-black/30 p-4"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Link
                        href={`/courses/${r.courseSlug}`}
                        className="truncate text-sm font-bold text-orange-400 hover:text-orange-300"
                      >
                        {r.courseTitle}
                      </Link>
                      <span className="shrink-0 text-[10px] text-neutral-600">
                        {new Date(r.createdAt).toLocaleDateString("fr-FR", {
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                    <div className="mt-1 text-xs leading-none">
                      <span className="text-amber-400">
                        {"★".repeat(r.rating)}
                      </span>
                      <span className="text-neutral-700">
                        {"★".repeat(5 - r.rating)}
                      </span>
                    </div>
                    <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-neutral-400">
                      {r.comment}
                    </p>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Projets */}
          {projects.length > 0 && (
            <Section title="🛠️ Portfolio">
              <div className="grid gap-4 sm:grid-cols-2">
                {projects.map((p: any) => (
                  <div
                    key={p.id}
                    className="rounded-xl border border-neutral-800 bg-black/30 p-4"
                  >
                    <div className="flex items-start justify-between">
                      <h4 className="font-bold text-white">{p.title}</h4>
                      {p.isFeatured && <span className="text-sm">⭐</span>}
                    </div>
                    {p.description && (
                      <p className="mt-2 line-clamp-3 text-xs text-neutral-400">
                        {p.description}
                      </p>
                    )}
                    {(p.technologies?.length ?? 0) > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1">
                        {p.technologies.map((t: string) => (
                          <span
                            key={t}
                            className="rounded bg-neutral-900 px-2 py-0.5 text-[10px] font-semibold text-orange-400"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                    {p.url && (
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 inline-block text-xs font-semibold text-orange-400 hover:text-orange-300"
                      >
                        Voir le projet →
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </Section>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Compétences */}
          {skills.length > 0 && (
            <Section title="💡 Compétences">
              <div className="space-y-2">
                {skills.map((s: any) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between rounded-lg bg-black/30 px-3 py-2"
                  >
                    <span className="text-sm font-semibold text-white">
                      {s.name}
                    </span>
                    <span className="rounded-full bg-neutral-900 px-2 py-0.5 text-[10px] font-bold capitalize text-orange-400">
                      {s.level}
                    </span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Badges */}
          {badges.length > 0 && (
            <Section title="🏆 Badges">
              <div className="grid grid-cols-3 gap-2">
                {badges.map((b: any) => (
                  <div
                    key={b.slug}
                    className="flex flex-col items-center rounded-lg bg-black/30 p-2 text-center"
                  >
                    <div className="text-2xl">{b.icon}</div>
                    <div className="mt-1 text-[10px] font-bold text-white">
                      {b.name}
                    </div>
                    <div className="text-[9px] capitalize text-neutral-500">
                      {b.rarity}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Liens sociaux */}
          {(profile.website || profile.github || profile.linkedin || profile.twitter) && (
            <Section title="🔗 Liens">
              <div className="space-y-2 text-sm">
                {profile.website && (
                  <SocialLink href={profile.website} icon="🌐">
                    {profile.website}
                  </SocialLink>
                )}
                {profile.github && (
                  <SocialLink
                    href={`https://github.com/${profile.github}`}
                    icon="🐙"
                  >
                    github.com/{profile.github}
                  </SocialLink>
                )}
                {profile.linkedin && (
                  <SocialLink href={profile.linkedin} icon="💼">
                    LinkedIn
                  </SocialLink>
                )}
                {profile.twitter && (
                  <SocialLink
                    href={`https://twitter.com/${profile.twitter.replace("@", "")}`}
                    icon="𝕏"
                  >
                    {profile.twitter}
                  </SocialLink>
                )}
              </div>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}

function MiniStat({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: any;
}) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
      <div className="flex items-center gap-2">
        <span className="text-xl">{icon}</span>
        <span className="text-xl font-black text-white">{value}</span>
      </div>
      <div className="mt-1 text-[11px] text-neutral-500">{label}</div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-neutral-800 bg-neutral-950 p-5">
      <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-white">
        {title}
      </h3>
      {children}
    </section>
  );
}

function SocialLink({
  href,
  icon,
  children,
}: {
  href: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-2 rounded-lg bg-black/30 px-3 py-2 text-neutral-300 hover:bg-black/50 hover:text-orange-400"
    >
      <span>{icon}</span>
      <span className="truncate text-xs">{children}</span>
    </a>
  );
}
