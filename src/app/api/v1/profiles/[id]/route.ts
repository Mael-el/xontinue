// ============================================================
// GET /api/v1/profiles/[id] — Profil public d'un utilisateur
// ============================================================

import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  users,
  userSkills,
  userProjects,
  userBadges,
  badges,
  userDomains,
  domains,
  enrollments,
  courses,
  courseReviews,
} from "@/db/schema";
import { eq, desc, sql, and, isNotNull } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;

    const [profile] = await db
      .select({
        id: users.id,
        fullName: users.fullName,
        role: users.role,
        country: users.country,
        city: users.city,
        avatarUrl: users.avatarUrl,
        coverUrl: users.coverUrl,
        bio: users.bio,
        website: users.website,
        twitter: users.twitter,
        linkedin: users.linkedin,
        github: users.github,
        isVerifiedIdentity: users.isVerifiedIdentity,
        xp: users.xp,
        streak: users.streak,
        englishLevel: users.englishLevel,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (!profile) {
      return NextResponse.json(
        { ok: false, error: "Profil introuvable" },
        { status: 404 }
      );
    }

    // Données publiques agrégées
    const [skills, projects, earnedBadges, followedDomains, statsEnroll, rankRow, certificates, latestReviews] =
      await Promise.all([
        db
          .select()
          .from(userSkills)
          .where(eq(userSkills.userId, id))
          .orderBy(desc(userSkills.endorsedCount)),
        db
          .select()
          .from(userProjects)
          .where(eq(userProjects.userId, id))
          .orderBy(desc(userProjects.createdAt)),
        db
          .select({
            slug: badges.slug,
            name: badges.name,
            icon: badges.icon,
            rarity: badges.rarity,
            awardedAt: userBadges.awardedAt,
          })
          .from(userBadges)
          .innerJoin(badges, eq(userBadges.badgeId, badges.id))
          .where(eq(userBadges.userId, id))
          .orderBy(desc(userBadges.awardedAt)),
        db
          .select({
            slug: domains.slug,
            name: domains.name,
            icon: domains.icon,
            level: userDomains.level,
          })
          .from(userDomains)
          .innerJoin(domains, eq(userDomains.domainId, domains.id))
          .where(eq(userDomains.userId, id)),
        db
          .select({
            count: sql<number>`count(*)::int`,
            completed: sql<number>`count(*) filter (where ${enrollments.status} = 'completed')::int`,
          })
          .from(enrollments)
          .where(eq(enrollments.userId, id)),
        // Rang au classement XP (même convention que /leaderboard)
        db
          .select({
            rank: sql<number>`(select count(*) + 1 from ${users} u2 where u2.xp > ${profile.xp} and u2.status = 'active')::int`,
          })
          .from(users)
          .where(eq(users.id, id))
          .limit(1),
        // Certificats : formations terminées à 100 % (lien de vérification)
        db
          .select({
            enrollmentId: enrollments.id,
            completedAt: enrollments.completedAt,
            slug: courses.slug,
            title: courses.title,
            durationHours: courses.durationHours,
            domainName: domains.name,
            domainIcon: domains.icon,
          })
          .from(enrollments)
          .innerJoin(courses, eq(enrollments.courseId, courses.id))
          .innerJoin(domains, eq(courses.domainId, domains.id))
          .where(
            and(
              eq(enrollments.userId, id),
              eq(enrollments.status, "completed")
            )
          )
          .orderBy(desc(enrollments.completedAt))
          .limit(6),
        // Derniers avis vérifiés laissés (avec commentaire)
        db
          .select({
            rating: courseReviews.rating,
            comment: courseReviews.comment,
            createdAt: courseReviews.createdAt,
            courseSlug: courses.slug,
            courseTitle: courses.title,
          })
          .from(courseReviews)
          .innerJoin(courses, eq(courseReviews.courseId, courses.id))
          .where(
            and(
              eq(courseReviews.userId, id),
              isNotNull(courseReviews.comment)
            )
          )
          .orderBy(desc(courseReviews.createdAt))
          .limit(6),
      ]);

    return NextResponse.json({
      ok: true,
      profile,
      skills,
      projects,
      badges: earnedBadges,
      domains: followedDomains,
      certificates,
      reviews: latestReviews,
      statistics: {
        coursesTotal: statsEnroll[0]?.count ?? 0,
        coursesCompleted: statsEnroll[0]?.completed ?? 0,
        projectsCount: projects.length,
        badgesCount: earnedBadges.length,
        rank: rankRow[0]?.rank ?? 1,
      },
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: "Erreur serveur" }, { status: 500 });
  }
}
