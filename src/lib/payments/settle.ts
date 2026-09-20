// ============================================================
// RÈGLEMENT D'UN PAIEMENT — Logique métier partagée
// Appelée par :
//   - POST /api/v1/payments/webhook (providers réels : FedaPay…)
//   - POST /api/v1/payments/[reference]/confirm (simulation mock)
// ============================================================

import { db } from "@/db";
import { courses, enrollments, payments } from "@/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import { notifyUser } from "@/lib/notifications";

type PaymentRow = typeof payments.$inferSelect;

/** Cherche un paiement par sa référence provider. */
export async function findPaymentByReference(
  reference: string
): Promise<PaymentRow | null> {
  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.providerReference, reference))
    .limit(1);
  return payment ?? null;
}

/**
 * Crée l'inscription liée à un paiement réussi (idempotent) et
 * incrémente le compteur d'étudiants du cours.
 */
async function ensureEnrollment(payment: PaymentRow): Promise<void> {
  if (!payment.courseId) return;

  const [existing] = await db
    .select({ id: enrollments.id })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.userId, payment.userId),
        eq(enrollments.courseId, payment.courseId)
      )
    )
    .limit(1);

  if (!existing) {
    await db.insert(enrollments).values({
      userId: payment.userId,
      courseId: payment.courseId,
      progress: 0,
      status: "active",
    });
    await db
      .update(courses)
      .set({ studentsCount: sql`${courses.studentsCount} + 1` })
      .where(eq(courses.id, payment.courseId));
  } else {
    // Réactive une inscription précédemment annulée
    await db
      .update(enrollments)
      .set({ status: "active" })
      .where(
        and(
          eq(enrollments.id, existing.id),
          eq(enrollments.status, "cancelled")
        )
      );
  }
}

/**
 * Solde un paiement en SUCCÈS (idempotent) :
 * 1. pending → success (un paiement déjà soldé est ignoré)
 * 2. inscription créée / réactivée
 * 3. notification de confirmation
 * Retourne { settled: false } si introuvable ou déjà traité.
 */
export async function settlePaymentSuccess(
  reference: string
): Promise<{ settled: boolean; payment: PaymentRow | null }> {
  const payment = await findPaymentByReference(reference);
  if (!payment) return { settled: false, payment: null };

  // Idempotence : déjà soldé avec succès → rien à faire
  if (payment.status === "success") {
    return { settled: false, payment };
  }

  // Transition atomique : seul un paiement "pending" ou "failed"
  // peut passer à "success" (évite les doubles règlements)
  const [updated] = await db
    .update(payments)
    .set({ status: "success" })
    .where(
      and(
        eq(payments.id, payment.id),
        inArray(payments.status, ["pending", "failed"])
      )
    )
    .returning();

  if (!updated) return { settled: false, payment };

  await ensureEnrollment(updated);

  // Récupère le titre du cours pour la notification
  let courseTitle = "ta formation";
  let courseSlug: string | null = null;
  if (updated.courseId) {
    const [course] = await db
      .select({ title: courses.title, slug: courses.slug })
      .from(courses)
      .where(eq(courses.id, updated.courseId))
      .limit(1);
    if (course) {
      courseTitle = course.title;
      courseSlug = course.slug;
    }
  }

  void notifyUser(updated.userId, {
    type: "payment_success",
    title: `💳 Paiement confirmé — ${courseTitle}`,
    body: `Ton paiement de ${updated.amountXof.toLocaleString("fr-FR")} FCFA est confirmé (réf ${reference}). Bon apprentissage !`,
    href: courseSlug ? `/courses/${courseSlug}/learn` : "/dashboard",
  });

  return { settled: true, payment: updated };
}

/**
 * Marque un paiement comme ÉCHOUÉ (idempotent).
 * Une notification informe l'utilisateur.
 */
export async function settlePaymentFailed(
  reference: string
): Promise<{ settled: boolean; payment: PaymentRow | null }> {
  const payment = await findPaymentByReference(reference);
  if (!payment) return { settled: false, payment: null };

  // Un succès n'est jamais écrasé par un échec tardif
  if (payment.status !== "pending") {
    return { settled: false, payment };
  }

  const [updated] = await db
    .update(payments)
    .set({ status: "failed" })
    .where(
      and(eq(payments.id, payment.id), eq(payments.status, "pending"))
    )
    .returning();

  if (!updated) return { settled: false, payment };

  void notifyUser(updated.userId, {
    type: "system",
    title: "⚠️ Paiement échoué",
    body: `Le paiement ${reference} n'a pas abouti. Vérifie ton solde Mobile Money et réessaie.`,
    href: "/dashboard",
  });

  return { settled: true, payment: updated };
}
