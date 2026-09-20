// ============================================================
// GAMIFICATION — XP, séries quotidiennes (streak) et badges
// Moteur central appelé lors de la progression des étudiants.
// ============================================================

import { db } from "@/db";
import { badges, userBadges, users } from "@/db/schema";
import { eq, lte } from "drizzle-orm";
import { notifyUser } from "@/lib/notifications";

/** Bonus d'XP accordé quand un cours est terminé à 100 %. */
export const COURSE_COMPLETION_BONUS_XP = 100;

export interface AwardedBadge {
  slug: string;
  name: string;
  icon: string | null;
  rarity: string;
}

export interface AwardXpResult {
  /** XP total de l'utilisateur après attribution */
  xp: number;
  /** Série de jours consécutifs d'activité */
  streak: number;
  /** Badges nouvellement débloqués grâce à cet XP */
  newBadges: AwardedBadge[];
}

/** Nombre de jours calendaires (UTC) entre deux dates. */
function daysBetween(a: Date, b: Date): number {
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const dayA = Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate());
  const dayB = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate());
  return Math.floor((dayB - dayA) / MS_PER_DAY);
}

/**
 * Ajoute de l'XP à un utilisateur :
 * 1. Incrémente son compteur d'XP.
 * 2. Met à jour sa série quotidienne (streak) :
 *    - activité le même jour → inchangée (min 1)
 *    - activité la veille → +1
 *    - sinon → repart à 1
 * 3. Attribue automatiquement les badges dont le seuil est atteint.
 */
export async function awardXp(
  userId: string,
  amount: number
): Promise<AwardXpResult> {
  const [user] = await db
    .select({
      xp: users.xp,
      streak: users.streak,
      lastActivityAt: users.lastActivityAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    throw new Error("Utilisateur introuvable");
  }

  const now = new Date();
  const last = user.lastActivityAt ? new Date(user.lastActivityAt) : null;

  let streak = user.streak ?? 0;
  if (!last) {
    streak = Math.max(streak, 1);
  } else {
    const diff = daysBetween(last, now);
    if (diff === 0) {
      streak = Math.max(streak, 1);
    } else if (diff === 1) {
      streak = streak + 1;
    } else {
      streak = 1;
    }
  }

  const newXp = (user.xp ?? 0) + Math.max(0, amount);

  await db
    .update(users)
    .set({ xp: newXp, streak, lastActivityAt: now, updatedAt: now })
    .where(eq(users.id, userId));

  const newBadges = await syncBadgesForUser(userId, newXp);

  return { xp: newXp, streak, newBadges };
}

/**
 * Attribue tous les badges dont le seuil d'XP (`required_xp`) est
 * atteint et qui ne sont pas encore possédés par l'utilisateur.
 * Retourne la liste des badges nouvellement obtenus.
 */
export async function syncBadgesForUser(
  userId: string,
  xp: number
): Promise<AwardedBadge[]> {
  const eligible = await db
    .select({
      id: badges.id,
      slug: badges.slug,
      name: badges.name,
      icon: badges.icon,
      rarity: badges.rarity,
    })
    .from(badges)
    .where(lte(badges.requiredXp, xp));

  if (eligible.length === 0) return [];

  const owned = await db
    .select({ badgeId: userBadges.badgeId })
    .from(userBadges)
    .where(eq(userBadges.userId, userId));

  const ownedIds = new Set(owned.map((o) => o.badgeId));
  const toAward = eligible.filter((b) => !ownedIds.has(b.id));

  if (toAward.length === 0) return [];

  await db
    .insert(userBadges)
    .values(toAward.map((b) => ({ userId, badgeId: b.id })));

  // Notifie l'utilisateur de chaque badge débloqué (best-effort)
  for (const b of toAward) {
    void notifyUser(userId, {
      type: "badge_earned",
      title: `🏅 Nouveau badge : ${b.name}`,
      body: `Tu viens de débloquer le badge « ${b.name} » (${b.rarity}). Continue comme ça !`,
      href: "/badges",
    });
  }

  return toAward.map(({ slug, name, icon, rarity }) => ({
    slug,
    name,
    icon,
    rarity,
  }));
}
