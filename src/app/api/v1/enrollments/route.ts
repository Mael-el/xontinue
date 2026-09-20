// ============================================================
// /api/v1/enrollments
// GET  — Liste des inscriptions de l'utilisateur connecté
// POST — Inscription à un cours (gratuit ou après paiement)
// ============================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { courses, domains, enrollments, payments } from "@/db/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import { requireUser, AuthError } from "@/lib/auth";
import { notifyUser } from "@/lib/notifications";

export const dynamic = "force-dynamic";

/** Schéma de validation du corps de requête d'inscription. */
const enrollSchema = z.object({
  courseSlug: z.string().min(1, "courseSlug requis"),
});

/**
 * GET /api/v1/enrollments
 * Retourne toutes les inscriptions de l'utilisateur connecté,
 * avec les infos du cours et du domaine associé.
 */
export async function GET() {
  try {
    const current = await requireUser();

    const rows = await db
      .select({
        id: enrollments.id,
        status: enrollments.status,
        progress: enrollments.progress,
        enrolledAt: enrollments.enrolledAt,
        completedAt: enrollments.completedAt,
        course: {
          id: courses.id,
          slug: courses.slug,
          title: courses.title,
          level: courses.level,
          durationHours: courses.durationHours,
          thumbnailUrl: courses.thumbnailUrl,
        },
        domain: {
          slug: domains.slug,
          name: domains.name,
          icon: domains.icon,
          color: domains.color,
        },
      })
      .from(enrollments)
      .innerJoin(courses, eq(enrollments.courseId, courses.id))
      .innerJoin(domains, eq(courses.domainId, domains.id))
      .where(eq(enrollments.userId, current.userId))
      .orderBy(desc(enrollments.enrolledAt));

    return NextResponse.json({ ok: true, enrollments: rows });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: error.status }
      );
    }
    console.error("enrollments GET error:", error);
    return NextResponse.json(
      { ok: false, error: "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/enrollments
 * Inscrit l'utilisateur connecté à un cours.
 *
 * Règles métier :
 * - Cours gratuit (price_xof = 0) → inscription directe.
 * - Cours payant → exige un paiement réussi (status = success)
 *   dans la table `payments`, sinon 402 Payment Required.
 * - Idempotent : déjà inscrit → 200 avec l'inscription existante.
 * - Inscription annulée → réactivation (progression conservée).
 */
export async function POST(req: Request) {
  try {
    const current = await requireUser();

    const body = await req.json().catch(() => ({}));
    const parsed = enrollSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: "Données invalides",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    // 1) Le cours doit exister et être publié
    const [course] = await db
      .select()
      .from(courses)
      .where(eq(courses.slug, parsed.data.courseSlug))
      .limit(1);

    if (!course || course.status !== "published") {
      return NextResponse.json(
        { ok: false, error: "Cours introuvable" },
        { status: 404 }
      );
    }

    // 2) Inscription existante ? (idempotence + réactivation)
    const [existing] = await db
      .select()
      .from(enrollments)
      .where(
        and(
          eq(enrollments.userId, current.userId),
          eq(enrollments.courseId, course.id)
        )
      )
      .limit(1);

    if (existing) {
      if (existing.status === "cancelled") {
        const [reactivated] = await db
          .update(enrollments)
          .set({ status: "active", completedAt: null })
          .where(eq(enrollments.id, existing.id))
          .returning();
        return NextResponse.json({
          ok: true,
          enrollment: reactivated,
          reactivated: true,
        });
      }
      return NextResponse.json({
        ok: true,
        enrollment: existing,
        alreadyEnrolled: true,
      });
    }

    // 3) Cours payant → vérifier qu'un paiement réussi existe
    if ((course.priceXof ?? 0) > 0) {
      const [payment] = await db
        .select({ id: payments.id })
        .from(payments)
        .where(
          and(
            eq(payments.userId, current.userId),
            eq(payments.courseId, course.id),
            eq(payments.status, "success")
          )
        )
        .limit(1);

      if (!payment) {
        return NextResponse.json(
          {
            ok: false,
            error: "Paiement requis pour accéder à ce cours",
            requiresPayment: true,
            priceXof: course.priceXof,
          },
          { status: 402 }
        );
      }
    }

    // 4) Créer l'inscription et incrémenter le compteur d'étudiants
    const [enrollment] = await db
      .insert(enrollments)
      .values({ userId: current.userId, courseId: course.id })
      .returning();

    await db
      .update(courses)
      .set({ studentsCount: sql`${courses.studentsCount} + 1` })
      .where(eq(courses.id, course.id));

    // Notification de bienvenue dans la formation (best-effort)
    void notifyUser(current.userId, {
      type: "enrollment",
      title: `🚀 Bienvenue dans « ${course.title} »`,
      body: "Ton inscription est confirmée. Valide ta première leçon pour gagner de l'XP !",
      href: `/courses/${course.slug}/learn`,
    });

    return NextResponse.json({ ok: true, enrollment }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: error.status }
      );
    }
    console.error("enrollments POST error:", error);
    return NextResponse.json(
      { ok: false, error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
