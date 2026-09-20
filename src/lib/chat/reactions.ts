// ============================================================
// RÉACTIONS EMOJI — toggle par utilisateur + agrégation
// Règle métier : 20 emojis distincts max par message
// (comportement WhatsApp : un nouvel emoji au-delà est refusé).
// ============================================================

import { db } from "@/db";
import { messageReactions } from "@/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";

/** Nombre d'emojis DISTINCTS autorisés sur un message. */
export const MAX_DISTINCT_EMOJIS = 20;

export class ReactionError extends Error {
  constructor(
    message: string,
    readonly status: number = 400
  ) {
    super(message);
  }
}

export interface ToggleResult {
  added: boolean;
  emoji: string;
}

/**
 * Bascule une réaction : la retire si l'utilisateur l'avait déjà
 * posée (re-cliquer = annuler), l'ajoute sinon.
 * La contrainte unique (message, user, emoji) rend le toggle idempotent.
 */
export async function toggleReaction(
  messageId: string,
  userId: string,
  emoji: string
): Promise<ToggleResult> {
  const trimmed = emoji.trim();
  if (!trimmed || trimmed.length > 16) {
    throw new ReactionError("Emoji invalide");
  }

  const [existing] = await db
    .select({ id: messageReactions.id })
    .from(messageReactions)
    .where(
      and(
        eq(messageReactions.messageId, messageId),
        eq(messageReactions.userId, userId),
        eq(messageReactions.emoji, trimmed)
      )
    )
    .limit(1);

  if (existing) {
    await db
      .delete(messageReactions)
      .where(eq(messageReactions.id, existing.id));
    return { added: false, emoji: trimmed };
  }

  // Garde-fou : nombre d'emojis DISTINCTS déjà présents
  const [distinct] = await db
    .select({ count: sql<number>`count(distinct ${messageReactions.emoji})` })
    .from(messageReactions)
    .where(eq(messageReactions.messageId, messageId));
  if ((distinct?.count ?? 0) >= MAX_DISTINCT_EMOJIS) {
    throw new ReactionError(
      `Limite atteinte : ${MAX_DISTINCT_EMOJIS} emojis distincts par message`,
      400
    );
  }

  await db.insert(messageReactions).values({
    messageId,
    userId,
    emoji: trimmed,
  });
  return { added: true, emoji: trimmed };
}

export interface AggregatedReaction {
  emoji: string;
  count: number;
  /** true si l'utilisateur qui consulte a posé cette réaction. */
  reacted: boolean;
}

/**
 * Agrège les réactions d'un lot de messages (une requête).
 * Retourne { messageId → réactions triées par ancienneté }.
 */
export async function aggregateReactions(
  messageIds: string[],
  viewerId: string
): Promise<Record<string, AggregatedReaction[]>> {
  const result: Record<string, AggregatedReaction[]> = {};
  if (messageIds.length === 0) return result;
  for (const id of messageIds) result[id] = [];

  const rows = await db
    .select({
      messageId: messageReactions.messageId,
      emoji: messageReactions.emoji,
      count: sql<number>`count(*)`,
      reacted: sql<boolean>`bool_or(${messageReactions.userId} = ${viewerId})`,
      firstAt: sql<Date>`min(${messageReactions.createdAt})`,
    })
    .from(messageReactions)
    .where(inArray(messageReactions.messageId, messageIds))
    .groupBy(messageReactions.messageId, messageReactions.emoji);

  rows.sort((a, b) => a.firstAt.getTime() - b.firstAt.getTime());
  for (const r of rows) {
    result[r.messageId]?.push({
      emoji: r.emoji,
      count: Number(r.count),
      reacted: r.reacted,
    });
  }
  return result;
}
