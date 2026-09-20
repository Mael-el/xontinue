// ============================================================
// LEADERBOARD — Classement des étudiants par XP
// Requête partagée entre la page /leaderboard (SSR) et la
// route /api/v1/leaderboard.
// ============================================================

import { db } from "@/db";
import { enrollments, userBadges, users } from "@/db/schema";
import { desc, eq, sql } from "drizzle-orm";

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  fullName: string;
  avatarUrl: string | null;
  country: string | null;
  xp: number;
  streak: number;
  badgesCount: number;
  coursesCompleted: number;
}

/** Colonnes communes (avec sous-requêtes d'agrégats). */
const entryColumns = {
  userId: users.id,
  fullName: users.fullName,
  avatarUrl: users.avatarUrl,
  country: users.country,
  xp: users.xp,
  streak: users.streak,
  badgesCount: sql<number>`(select count(*) from ${userBadges} ub where ub.user_id = ${users.id})::int`,
  coursesCompleted: sql<number>`(select count(*) from ${enrollments} e where e.user_id = ${users.id} and e.status = 'completed')::int`,
};

/**
 * Top N des utilisateurs actifs, triés par XP décroissant
 * (puis série, puis ancienneté). Les rangs sont 1-indexés.
 */
export async function getLeaderboard(limit = 50): Promise<LeaderboardEntry[]> {
  const rows = await db
    .select(entryColumns)
    .from(users)
    .where(eq(users.status, "active"))
    .orderBy(desc(users.xp), desc(users.streak), users.createdAt)
    .limit(Math.min(limit, 100));

  return rows.map((r, i) => ({ rank: i + 1, ...r }));
}

/**
 * Entrée de classement d'un utilisateur précis, même hors du
 * top N : son rang est calculé par (nombre d'utilisateurs actifs
 * ayant plus d'XP) + 1 — même convention que le dashboard.
 */
export async function getUserRankEntry(
  userId: string
): Promise<LeaderboardEntry | null> {
  const [row] = await db
    .select({
      ...entryColumns,
      rank: sql<number>`(select count(*) + 1 from ${users} u2 where u2.xp > ${users.xp} and u2.status = 'active')::int`,
      totalActive: sql<number>`(select count(*) from ${users} u3 where u3.status = 'active')::int`,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!row) return null;

  return {
    rank: row.rank,
    userId: row.userId,
    fullName: row.fullName,
    avatarUrl: row.avatarUrl,
    country: row.country,
    xp: row.xp,
    streak: row.streak,
    badgesCount: row.badgesCount,
    coursesCompleted: row.coursesCompleted,
  };
}
