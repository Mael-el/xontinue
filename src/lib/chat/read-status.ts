// ============================================================
// ACCUSÉS DE LECTURE — ✓ envoyé · ✓✓ livré · ✓✓ bleu lu
//
// Sémantique WhatsApp :
//  - « sent »      : le serveur a reçu le message
//  - « delivered » : parvenu à TOUS les autres membres
//                    (en ligne, ou vus depuis l'émission)
//  - « read »      : lu par TOUS les autres membres
// Fonctions pures (testables sans base).
// ============================================================

export type DeliveryStatus = "sent" | "delivered" | "read";

/** État de consommation d'un autre membre pour un message donné. */
export interface MemberConsumption {
  /** Timestamp du dernier message LU par ce membre (pointeur de lecture). */
  lastReadAt: Date | null;
  /** Dernière activité connue (connexion/heartbeat). */
  lastSeenAt: Date | null;
  /** Actuellement connecté (présence mémoire). */
  online: boolean;
}

/**
 * Calcule l'état d'affichage d'un message pour son expéditeur.
 * La comparaison « lastReadAt >= createdAt » approxime la lecture
 * (le pointeur de lecture pointe vers un message ≥ celui-ci).
 */
export function computeDeliveryStatus(
  messageCreatedAt: Date,
  others: MemberConsumption[]
): DeliveryStatus {
  if (others.length === 0) return "sent";

  const allRead = others.every(
    (o) => o.lastReadAt !== null && o.lastReadAt >= messageCreatedAt
  );
  if (allRead) return "read";

  const allDelivered = others.every(
    (o) => o.online || (o.lastSeenAt !== null && o.lastSeenAt >= messageCreatedAt)
  );
  if (allDelivered) return "delivered";

  return "sent";
}

/**
 * Coche WhatsApp correspondante (pour l'UI / les tests E2E API) :
 * 1 coche grise, 2 coches grises, 2 coches bleues.
 */
export function statusToTicks(status: DeliveryStatus): {
  ticks: 1 | 2;
  color: "gray" | "blue";
} {
  switch (status) {
    case "sent":
      return { ticks: 1, color: "gray" };
    case "delivered":
      return { ticks: 2, color: "gray" };
    case "read":
      return { ticks: 2, color: "blue" };
  }
}
