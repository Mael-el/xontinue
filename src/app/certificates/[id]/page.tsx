// ============================================================
// PAGE — CERTIFICAT DE FIN DE FORMATION (publique / vérifiable)
// URL : /certificates/[enrollmentId]
// Partageable : un recruteur peut vérifier l'authenticité.
// Imprimable via le bouton dédié (CSS print dans globals.css).
// ============================================================

import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { courses, domains, enrollments, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { levelLabel } from "@/lib/format";
import { CertificateActions } from "./CertificateActions";

export const dynamic = "force-dynamic";

export default async function CertificatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [row] = await db
    .select({
      enrollmentId: enrollments.id,
      status: enrollments.status,
      completedAt: enrollments.completedAt,
      student: {
        fullName: users.fullName,
        country: users.country,
      },
      course: {
        slug: courses.slug,
        title: courses.title,
        durationHours: courses.durationHours,
        level: courses.level,
      },
      domain: {
        name: domains.name,
        icon: domains.icon,
      },
    })
    .from(enrollments)
    .innerJoin(users, eq(enrollments.userId, users.id))
    .innerJoin(courses, eq(enrollments.courseId, courses.id))
    .innerJoin(domains, eq(courses.domainId, domains.id))
    .where(eq(enrollments.id, id))
    .limit(1);

  // Le certificat n'existe que pour une formation terminée à 100 %
  if (!row || row.status !== "completed" || !row.completedAt) notFound();

  const code = `CERT-${row.enrollmentId.slice(0, 8).toUpperCase()}`;
  const dateLabel = row.completedAt.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      {/* Barre d'actions (masquée à l'impression) */}
      <div className="certificate-no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/courses/${row.course.slug}/learn`}
          className="text-sm text-neutral-500 hover:text-white"
        >
          ← Retour au cours
        </Link>
        <CertificateActions courseTitle={row.course.title} />
      </div>

      {/* ================= FEUILLE CERTIFICAT ================= */}
      <div className="certificate-sheet relative overflow-hidden rounded-2xl bg-[#FDF8EF] p-3 text-neutral-900 shadow-2xl sm:p-4">
        {/* Liseré dégradé Africain */}
        <div className="absolute inset-x-0 top-0 h-2 bg-gradient-to-r from-orange-500 via-amber-500 to-emerald-600" />

        <div className="rounded-xl border-4 border-double border-amber-700/50 px-6 py-10 sm:px-12">
          {/* En-tête */}
          <div className="flex items-center justify-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 via-amber-500 to-emerald-600 text-xl">
              🌍
            </span>
            <span className="text-xl font-black tracking-tight">
              Africa<span className="text-orange-600">Skills</span>
            </span>
          </div>
          <div className="mt-1 text-center text-[10px] font-bold uppercase tracking-[0.35em] text-neutral-500">
            Certificat officiel
          </div>

          {/* Corps */}
          <h1 className="mt-8 text-center font-serif text-3xl italic text-neutral-800 sm:text-4xl">
            Certificat de réussite
          </h1>

          <p className="mt-8 text-center text-xs font-semibold uppercase tracking-widest text-neutral-500">
            Décerné fièrement à
          </p>
          <div className="mt-2 text-center text-3xl font-black text-neutral-900 sm:text-5xl">
            {row.student.fullName}
          </div>
          {row.student.country && (
            <div className="mt-1 text-center text-sm text-neutral-500">
              {row.student.country}
            </div>
          )}

          {/* Ornement */}
          <div className="mx-auto mt-6 flex max-w-xs items-center gap-3">
            <span className="h-px flex-1 bg-gradient-to-r from-transparent to-amber-600/60" />
            <span className="text-amber-600">✦ ✦ ✦</span>
            <span className="h-px flex-1 bg-gradient-to-l from-transparent to-amber-600/60" />
          </div>

          <p className="mt-6 text-center text-sm text-neutral-600">
            pour avoir terminé avec succès la formation
          </p>
          <div className="mx-auto mt-3 max-w-2xl text-center text-xl font-black leading-snug text-orange-700 sm:text-2xl">
            {row.course.title}
          </div>

          {/* Méta formation */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-semibold text-neutral-600">
            <span>
              {row.domain.icon} {row.domain.name}
            </span>
            <span>⏱️ {row.course.durationHours ?? 0} heures de contenu</span>
            <span>Niveau {levelLabel(row.course.level)}</span>
            <span>📅 Terminée le {dateLabel}</span>
          </div>

          {/* Pied : signature + sceau */}
          <div className="mt-12 flex flex-wrap items-end justify-between gap-6">
            <div className="text-center sm:text-left">
              <div className="font-serif text-2xl italic text-neutral-800">
                AfricaSkills
              </div>
              <div className="mt-1 w-48 border-t border-neutral-400 pt-1.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                Direction pédagogique
              </div>
            </div>

            <div className="flex flex-col items-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-emerald-600/70 bg-emerald-50 text-center">
                <div>
                  <div className="text-lg">✓</div>
                  <div className="text-[8px] font-black uppercase tracking-wider text-emerald-700">
                    Vérifié
                  </div>
                </div>
              </div>
            </div>

            <div className="text-center text-[10px] text-neutral-500 sm:text-right">
              <div className="font-mono font-bold text-neutral-700">{code}</div>
              <div>Vérifie l’authenticité sur</div>
              <div className="font-mono">
                africaskills.africa/certificates/{row.enrollmentId.slice(0, 8)}…
              </div>
            </div>
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-0 h-2 bg-gradient-to-r from-emerald-600 via-amber-500 to-orange-500" />
      </div>

      {/* Aide (masquée à l'impression) */}
      <p className="certificate-no-print mt-6 text-center text-xs text-neutral-500">
        💡 Partage ce certificat sur LinkedIn ou imprime-le en PDF (paysage
        recommandé). L’URL permet à un recruteur de vérifier son authenticité.
      </p>
    </div>
  );
}
