// ============================================================
// SERVICE MESSAGERIE — conversations, messages, appels
// Utilisé par les routes /api/v1/chat/* et le serveur temps réel.
// ============================================================

import { db } from "@/db";
import {
  chatMessages,
  conversationMembers,
  conversations,
  users,
} from "@/db/schema";
import { and, desc, eq, lt, sql } from "drizzle-orm";
import type { DeliveryStatus, MemberConsumption } from "./read-status";
import { computeDeliveryStatus } from "./read-status";
import { getPresenceMany } from "./presence";

export type ConversationRow = typeof conversations.$inferSelect;
export type ConversationMemberRow = typeof conversationMembers.$inferSelect;
export type ChatMessageRow = typeof chatMessages.$inferSelect;

/** Erreur métier mappée en statut HTTP par les routes. */
export class ChatError extends Error {
  constructor(
    message: string,
    readonly status: number = 400
  ) {
    super(message);
  }
}

/** Récupère une conversation ou 404. */
export async function getConversationOr404(id: string): Promise<ConversationRow> {
  const [c] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, id))
    .limit(1);
  if (!c) throw new ChatError("Conversation introuvable", 404);
  return c;
}

/** Adhésion (null si non membre). */
export async function getMembership(
  conversationId: string,
  userId: string
): Promise<ConversationMemberRow | null> {
  const [m] = await db
    .select()
    .from(conversationMembers)
    .where(
      and(
        eq(conversationMembers.conversationId, conversationId),
        eq(conversationMembers.userId, userId)
      )
    )
    .limit(1);
  return m ?? null;
}

/** Vérifie l'adhésion — 403 sinon. */
export async function requireMembership(
  conversationId: string,
  userId: string
): Promise<ConversationMemberRow> {
  const m = await getMembership(conversationId, userId);
  if (!m) throw new ChatError("Tu n'es pas membre de cette conversation", 403);
  return m;
}

/**
 * Recherche la conversation directe d'une paire d'utilisateurs (1-1).
 * Critère : type=direct et EXACTEMENT ces deux membres.
 */
export async function findDirectConversation(
  userA: string,
  userB: string
): Promise<ConversationRow | null> {
  const rows = await db
    .select({ id: conversationMembers.conversationId })
    .from(conversationMembers)
    .innerJoin(
      conversations,
      eq(conversationMembers.conversationId, conversations.id)
    )
    .where(eq(conversations.type, "direct"))
    .groupBy(conversationMembers.conversationId)
    .having(
      sql`count(distinct ${conversationMembers.userId}) = 2
          and bool_or(${conversationMembers.userId} = ${userA})
          and bool_or(${conversationMembers.userId} = ${userB})`
    )
    .limit(1);

  const id = rows[0]?.id;
  if (!id) return null;
  const [c] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, id))
    .limit(1);
  return c ?? null;
}

/**
 * Récupère ou crée la conversation 1-1 d'une paire — IDEMPOTENT.
 * Crée les deux adhésions dans le même passage.
 */
export async function getOrCreateDirectConversation(
  userA: string,
  userB: string
): Promise<{ conversation: ConversationRow; created: boolean }> {
  if (userA === userB) {
    throw new ChatError("Impossible de discuter avec soi-même");
  }
  const existing = await findDirectConversation(userA, userB);
  if (existing) return { conversation: existing, created: false };

  try {
    const [c] = await db
      .insert(conversations)
      .values({ type: "direct", createdById: userA })
      .returning();
    await db.insert(conversationMembers).values([
      { conversationId: c.id, userId: userA, role: "member" },
      { conversationId: c.id, userId: userB, role: "member" },
    ]);
    return { conversation: c, created: true };
  } catch (error) {
    // Course avec une création parallèle : on relit l'existant
    const concurrent = await findDirectConversation(userA, userB);
    if (concurrent) return { conversation: concurrent, created: false };
    throw error;
  }
}

/** Crée un groupe (créateur = admin). */
export async function createGroupConversation(
  creatorId: string,
  name: string,
  memberIds: string[]
): Promise<ConversationRow> {
  const unique = [...new Set(memberIds)].filter((id) => id !== creatorId);
  if (unique.length === 0) {
    throw new ChatError("Un groupe a besoin d'au moins un autre membre");
  }
  const [c] = await db
    .insert(conversations)
    .values({ type: "group", name, createdById: creatorId })
    .returning();
  await db.insert(conversationMembers).values([
    { conversationId: c.id, userId: creatorId, role: "admin" },
    ...unique.map((userId) => ({
      conversationId: c.id,
      userId,
      role: "member" as const,
    })),
  ]);
  return c;
}

/** Membres d'une conversation avec infos utilisateur. */
export async function listMembers(conversationId: string) {
  return db
    .select({
      id: conversationMembers.id,
      userId: conversationMembers.userId,
      role: conversationMembers.role,
      lastReadMessageId: conversationMembers.lastReadMessageId,
      unreadCount: conversationMembers.unreadCount,
      joinedAt: conversationMembers.joinedAt,
      fullName: users.fullName,
      avatarUrl: users.avatarUrl,
    })
    .from(conversationMembers)
    .innerJoin(users, eq(conversationMembers.userId, users.id))
    .where(eq(conversationMembers.conversationId, conversationId));
}

/**
 * Calcule l'état de livraison (✓/✓✓/bleu) d'un message
 * pour son expéditeur, à partir des autres membres.
 */
export async function getMessageDelivery(
  message: Pick<ChatMessageRow, "createdAt" | "conversationId">,
  viewerId: string
): Promise<DeliveryStatus> {
  const members = await listMembers(message.conversationId);
  const others = members.filter((m) => m.userId !== viewerId);
  if (others.length === 0) return "sent";

  // Pointeurs de lecture : createdAt du message pointé
  const readIds = others
    .map((m) => m.lastReadMessageId)
    .filter((v): v is string => !!v);
  const readAt = new Map<string, Date>();
  if (readIds.length > 0) {
    const msgs = await db
      .select({ id: chatMessages.id, createdAt: chatMessages.createdAt })
      .from(chatMessages)
      .where(
        sql`${chatMessages.id} in (${sql.join(
          readIds.map((id) => sql`${id}`),
          sql`, `
        )})`
      );
    for (const m of msgs) readAt.set(m.id, m.createdAt);
  }

  const presence = await getPresenceMany(others.map((m) => m.userId));
  const consumption: MemberConsumption[] = others.map((m) => ({
    lastReadAt: m.lastReadMessageId
      ? (readAt.get(m.lastReadMessageId) ?? null)
      : null,
    lastSeenAt: presence[m.userId]?.lastSeenAt
      ? new Date(presence[m.userId].lastSeenAt as string)
      : null,
    online: presence[m.userId]?.status === "online",
  }));

  return computeDeliveryStatus(message.createdAt, consumption);
}

/**
 * Marque « lu » jusqu'au dernier message :
 *  - pointeur de lecture + compteur à zéro
 *  - accusés (message_reads) en masse, idempotent
 * Retourne le dernier message lu (pour l'événement WS).
 */
export async function markConversationRead(
  conversationId: string,
  userId: string
): Promise<{ lastReadMessageId: string | null; readCount: number }> {
  await requireMembership(conversationId, userId);

  const [last] = await db
    .select({ id: chatMessages.id })
    .from(chatMessages)
    .where(
      and(
        eq(chatMessages.conversationId, conversationId),
        sql`${chatMessages.deletedAt} is null`
      )
    )
    .orderBy(desc(chatMessages.createdAt), desc(chatMessages.id))
    .limit(1);

  if (!last) return { lastReadMessageId: null, readCount: 0 };

  // Accusés en masse — uniquement pour les messages des AUTRES
  // non encore lus par cet utilisateur.
  const inserted = await db.execute(sql`
    insert into message_reads (message_id, user_id)
    select m.id, ${userId}::uuid
    from chat_messages m
    left join message_reads r
      on r.message_id = m.id and r.user_id = ${userId}::uuid
    where m.conversation_id = ${conversationId}::uuid
      and m.deleted_at is null
      and m.sender_id <> ${userId}::uuid
      and r.id is null
    order by m.created_at desc
    limit 500
    on conflict do nothing
    returning id
  `);

  await db
    .update(conversationMembers)
    .set({ lastReadMessageId: last.id, unreadCount: 0 })
    .where(
      and(
        eq(conversationMembers.conversationId, conversationId),
        eq(conversationMembers.userId, userId)
      )
    );

  return { lastReadMessageId: last.id, readCount: inserted.rows.length };
}

/** Incrémente le compteur « non lus » de tous les membres sauf l'auteur. */
export async function bumpUnread(
  conversationId: string,
  senderId: string
): Promise<void> {
  await db
    .update(conversationMembers)
    .set({ unreadCount: sql`${conversationMembers.unreadCount} + 1` })
    .where(
      and(
        eq(conversationMembers.conversationId, conversationId),
        sql`${conversationMembers.userId} <> ${senderId}::uuid`
      )
    );
}

/** Touche le timestamp de dernier message (tri de la liste). */
export async function touchConversation(conversationId: string): Promise<void> {
  await db
    .update(conversations)
    .set({ lastMessageAt: new Date(), updatedAt: new Date() })
    .where(eq(conversations.id, conversationId));
}

/** Type enum valide pour un message chat (validation côté service). */
const CHAT_MESSAGE_TYPES = ["text", "image", "file", "audio", "video"] as const;

/**
 * Poste un message dans une conversation (règles métier communes
 * à la route REST et à l'événement WS `message:send`) :
 *  - membre requis, contenu ≤ 4000 caractères
 *  - met à jour le tri de la conversation + compteurs « non lus »
 * Retourne le message inséré et l'auteur (résumé public).
 */
export async function sendChatMessage(opts: {
  conversationId: string;
  senderId: string;
  type?: (typeof CHAT_MESSAGE_TYPES)[number];
  content?: string | null;
  replyToId?: string | null;
}) {
  await requireMembership(opts.conversationId, opts.senderId);
  const type = opts.type ?? "text";
  if (!CHAT_MESSAGE_TYPES.includes(type)) {
    throw new ChatError(`Type de message invalide : ${type}`);
  }
  const content = opts.content?.trim() ?? null;
  if (type === "text" && (!content || content.length > 4000)) {
    throw new ChatError("Message vide ou trop long (4000 caractères)");
  }

  const [message] = await db
    .insert(chatMessages)
    .values({
      conversationId: opts.conversationId,
      senderId: opts.senderId,
      type,
      content,
      replyToId: opts.replyToId ?? null,
    })
    .returning();

  await bumpUnread(opts.conversationId, opts.senderId);
  await touchConversation(opts.conversationId);

  const [author] = await db
    .select({ id: users.id, fullName: users.fullName, avatarUrl: users.avatarUrl })
    .from(users)
    .where(eq(users.id, opts.senderId))
    .limit(1);

  return { message, author: author ?? null };
}

/**
 * État de livraison (✓/✓✓/bleu) pour TOUTE une page de messages :
 * ne fait que 3 requêtes quel que soit le nombre de messages.
 */
export async function computePageDelivery(
  messages: Pick<ChatMessageRow, "id" | "conversationId" | "senderId" | "createdAt">[],
  viewerId: string
): Promise<Record<string, DeliveryStatus>> {
  const result: Record<string, DeliveryStatus> = {};
  const own = messages.filter((m) => m.senderId === viewerId);
  if (own.length === 0) return result;

  const conversationId = messages[0].conversationId;
  const members = await listMembers(conversationId);
  const others = members.filter((m) => m.userId !== viewerId);
  if (others.length === 0) {
    for (const m of own) result[m.id] = "sent";
    return result;
  }

  const readIds = others
    .map((m) => m.lastReadMessageId)
    .filter((v): v is string => !!v);
  const readAt = new Map<string, Date>();
  if (readIds.length > 0) {
    const rows = await db
      .select({ id: chatMessages.id, createdAt: chatMessages.createdAt })
      .from(chatMessages)
      .where(
        sql`${chatMessages.id} in (${sql.join(
          readIds.map((id) => sql`${id}`),
          sql`, `
        )})`
      );
    for (const r of rows) readAt.set(r.id, r.createdAt);
  }

  const presence = await getPresenceMany(others.map((m) => m.userId));
  const consumption: MemberConsumption[] = others.map((m) => ({
    lastReadAt: m.lastReadMessageId
      ? (readAt.get(m.lastReadMessageId) ?? null)
      : null,
    lastSeenAt: presence[m.userId]?.lastSeenAt
      ? new Date(presence[m.userId].lastSeenAt as string)
      : null,
    online: presence[m.userId]?.status === "online",
  }));

  for (const m of own) {
    result[m.id] = computeDeliveryStatus(m.createdAt, consumption);
  }
  return result;
}

/**
 * Pagination des messages : curseur `before` ISO (création décroissante).
 * Retourne la page + hasMore, messages en ordre chronologique.
 */
export async function listMessages(
  conversationId: string,
  opts: { before?: Date; limit: number }
): Promise<{ messages: ChatMessageRow[]; hasMore: boolean }> {
  const conditions = [eq(chatMessages.conversationId, conversationId)];
  if (opts.before) conditions.push(lt(chatMessages.createdAt, opts.before));
  const rows = await db
    .select()
    .from(chatMessages)
    .where(and(...conditions))
    .orderBy(desc(chatMessages.createdAt), desc(chatMessages.id))
    .limit(opts.limit + 1); // +1 pour détecter la page suivante
  const hasMore = rows.length > opts.limit;
  // On renvoie dans l'ordre chronologique pour l'affichage
  return { messages: rows.slice(0, opts.limit).reverse(), hasMore };
}
