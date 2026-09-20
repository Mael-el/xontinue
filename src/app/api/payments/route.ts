// ============================================================
// ROUTE API — PAIEMENT MOBILE MONEY (MOCK)
// En production : intégration FedaPay / KkiaPay / Fedapay API
// ============================================================

import { NextResponse } from "next/server";
import { db } from "@/db";
import { payments, enrollments, users, courses } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userId, courseSlug, phoneNumber, method } = body as {
      userId?: string;
      courseSlug?: string;
      phoneNumber?: string;
      method?: string;
    };

    if (!courseSlug || !phoneNumber || !method) {
      return NextResponse.json(
        { ok: false, error: "Champs manquants" },
        { status: 400 }
      );
    }

    // Trouver le cours
    const [course] = await db
      .select()
      .from(courses)
      .where(eq(courses.slug, courseSlug))
      .limit(1);

    if (!course) {
      return NextResponse.json(
        { ok: false, error: "Cours introuvable" },
        { status: 404 }
      );
    }

    // Trouver l'utilisateur :
    // 1. utilisateur connecté (cookie JWT) → prioritaire
    // 2. userId explicite (compatibilité)
    // 3. sinon, création d'un compte de démonstration
    const current = await getCurrentUser();

    let user: typeof users.$inferSelect | undefined;
    if (current) {
      [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, current.userId))
        .limit(1);
    }
    if (!user && userId) {
      [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
    }
    if (!user) {
      [user] = await db
        .insert(users)
        .values({
          email: `${phoneNumber.replace(/\D/g, "")}@africaskills.demo`,
          fullName: `Étudiant ${phoneNumber}`,
          phone: phoneNumber,
          role: "student",
          country: "Bénin",
        })
        .returning();
    }

    // Simuler l'appel au provider Mobile Money (FedaPay / KkiaPay)
    // En production : fetch vers leur API avec clé secrète
    const providerReference = `MP-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)
      .toUpperCase()}`;

    // Enregistrer le paiement comme réussi (simulation)
    const [payment] = await db
      .insert(payments)
      .values({
        userId: user.id,
        courseId: course.id,
        amountXof: course.priceXof,
        method: method as any,
        status: "success",
        providerReference,
        phoneNumber,
      })
      .returning();

    // Créer l'inscription (idempotent) + compteur d'étudiants
    const [existingEnrollment] = await db
      .select({ id: enrollments.id })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.userId, user.id),
          eq(enrollments.courseId, course.id)
        )
      )
      .limit(1);

    if (!existingEnrollment) {
      await db.insert(enrollments).values({
        userId: user.id,
        courseId: course.id,
        progress: 0,
        status: "active",
      });
      await db
        .update(courses)
        .set({ studentsCount: sql`${courses.studentsCount} + 1` })
        .where(eq(courses.id, course.id));
    } else {
      // Réactive une inscription précédemment annulée
      await db
        .update(enrollments)
        .set({ status: "active" })
        .where(
          and(
            eq(enrollments.id, existingEnrollment.id),
            eq(enrollments.status, "cancelled")
          )
        );
    }

    return NextResponse.json({
      ok: true,
      payment: {
        id: payment.id,
        reference: providerReference,
        status: "success",
        amount: payment.amountXof,
      },
      enrollment: {
        userId: user.id,
        courseId: course.id,
      },
      message: `Paiement reçu via ${method}. Bienvenue dans ${course.title} !`,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
