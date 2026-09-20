// ============================================================
// NOTIFICATIONS — Création de notifications in-app
// Appelé par les modules métier (gamification, candidatures,
// inscriptions, paiements) pour informer l'utilisateur.
// Respecte les préférences utilisateur (page /settings) :
// le type `system` est toujours livré, les autres catégories
// peuvent être désactivées individuellement.
// En phase 3 : relais vers email (Resend) + SMS (AfricasTalking)
// via une file BullMQ.
// ============================================================

import { db } from "@/db";
import { notifications, users } from "@/db/schema";
import { eq } from "drizzle-orm";

export type NotificationType =
  | "badge_earned"
  | "course_completed"
  | "application_status"
  | "enrollment"
  | "payment_success"
  | "system";

export interface NotifyInput {
  type: NotificationType;
  /** Titre court affiché dans la cloche (ex: "🏅 Nouveau badge !") */
  title: string;
  /** Texte descriptif optionnel */
  body?: string;
  /** Lien interne de destination au clic */
  href?: string;
}

// ─── Préférences ────────────────────────────────────────────

export type NotificationCategory = "learning" | "applications" | "payments";

export interface NotificationPrefs {
  learning: boolean;
  applications: boolean;
  payments: boolean;
}

/** Préférences appliquées quand l'utilisateur n'a rien configuré. */
export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  learning: true,
  applications: true,
  payments: true,
};

/**
 * Catégorie de préférence associée à chaque type.
 * `system` retourne null → toujours livré (compte, sécurité).
 */
export function preferenceKeyForType(
  type: NotificationType
): NotificationCategory | null {
  switch (type) {
    case "badge_earned":
    case "course_completed":
    case "enrollment":
      return "learning";
    case "application_status":
      return "applications";
    case "payment_success":
      return "payments";
    case "system":
    default:
      return null;
  }
}

/** Préférences effectives d'un utilisateur (fusion avec défauts). */
export async function getNotificationPrefs(
  userId: string
): Promise<NotificationPrefs> {
  const [row] = await db
    .select({ prefs: users.notificationPrefs })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return {
    ...DEFAULT_NOTIFICATION_PREFS,
    ...(row?.prefs ?? {}),
  };
}

/**
 * Crée une notification in-app pour un utilisateur — sauf si la
 * catégorie correspondante a été désactivée dans ses réglages.
 * Ne lève jamais d'erreur : un échec de notification ne doit
 * pas faire échouer l'action métier en cours.
 */
export async function notifyUser(
  userId: string,
  input: NotifyInput
): Promise<void> {
  try {
    // Respect des préférences (system = toujours livré)
    const prefKey = preferenceKeyForType(input.type);
    if (prefKey) {
      const prefs = await getNotificationPrefs(userId);
      if (!prefs[prefKey]) return;
    }

    await db.insert(notifications).values({
      userId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      href: input.href ?? null,
    });
  } catch (error) {
    // On journalise sans propager : la notification est best-effort
    console.error("notifyUser error:", error);
  }
}
