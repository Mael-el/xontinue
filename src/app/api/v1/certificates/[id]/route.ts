// ============================================================
// GET /api/v1/certificates/[id]
// Vérification PUBLIQUE d'un certificat (id = id d'inscription).
// Ne retourne des données que si la formation est terminée à
// 100 % (status = completed) — sinon 404.
// ============================================================

import { NextResponse } from "next/server";
import { db } from "@/db";
import { courses, domains, enrollments, users } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteContext) {
  try {
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

    // Un certificat n'existe que pour une formation terminée
    if (!row || row.status !== "completed" || !row.completedAt) {
      return NextResponse.json(
        { ok: false, error: "Certificat introuvable" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      certificate: {
        id: row.enrollmentId,
        code: `CERT-${row.enrollmentId.slice(0, 8).toUpperCase()}`,
        studentName: row.student.fullName,
        country: row.student.country,
        courseTitle: row.course.title,
        courseSlug: row.course.slug,
        durationHours: row.course.durationHours,
        level: row.course.level,
        domain: row.domain.name,
        completedAt: row.completedAt,
        verifyUrl: `/certificates/${row.enrollmentId}`,
      },
    });
  } catch (error) {
    console.error("certificate GET error:", error);
    return NextResponse.json(
      { ok: false, error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
