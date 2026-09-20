// ============================================================
// SCHÉMA — MESSAGERIE (type WhatsApp)
// Conversations 1-1 et groupes : messages typés, réactions,
// accusés de lecture, pièces jointes, appels, présence.
// Ré-exporté depuis schema.ts (point d'entrée Drizzle).
// ============================================================

import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
  boolean,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./schema";

// ------------------------------------------------------------
// ENUMS
// ------------------------------------------------------------

export const conversationTypeEnum = pgEnum("conversation_type", [
  "direct",
  "group",
]);

/** Rôle d'un membre de groupe (1-1 : toujours « member »). */
export const conversationMemberRoleEnum = pgEnum("conversation_member_role", [
  "admin",
  "member",
]);

export const chatMessageTypeEnum = pgEnum("chat_message_type", [
  "text",
  "image",
  "file",
  "audio",
  "video",
]);

export const callTypeEnum = pgEnum("call_type", ["audio", "video"]);

export const callStatusEnum = pgEnum("call_status", [
  "ringing",
  "ongoing",
  "ended",
  "missed",
  "declined",
]);

/** Statut de présence en ligne (source applicative : mémoire + TTL). */
export const presenceStatusEnum = pgEnum("presence_status", [
  "online",
  "away",
  "dnd",
  "offline",
]);

// ------------------------------------------------------------
// TABLES
// ------------------------------------------------------------

/** Conversation directe (1-1) ou de groupe. */
export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: conversationTypeEnum("type").notNull().default("direct"),
    // Nom/avatar du groupe (null en 1-1 — l'UI affiche l'autre membre)
    name: varchar("name", { length: 120 }),
    avatarUrl: varchar("avatar_url", { length: 500 }),
    createdById: uuid("created_by_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // Chiffrement E2E optionnel par conversation (extension E2E)
    isEncrypted: boolean("is_encrypted").notNull().default(false),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("conversations_lastmsg_idx").on(t.lastMessageAt)]
);

/** Membre d'une conversation (avec rôle pour les groupes). */
export const conversationMembers = pgTable(
  "conversation_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: conversationMemberRoleEnum("role").notNull().default("member"),
    // Pointeur de lecture pour le badge « non lus » + ✓✓ rapides
    lastReadMessageId: uuid("last_read_message_id"),
    unreadCount: integer("unread_count").notNull().default(0),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("conv_members_unique").on(t.conversationId, t.userId),
    index("conv_members_user_idx").on(t.userId),
  ]
);

/** Message d'une conversation (texte, image, fichier, vocal, vidéo). */
export const chatMessages = pgTable(
  "chat_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    senderId: uuid("sender_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: chatMessageTypeEnum("type").notNull().default("text"),
    // null pour les messages 100 % pièce jointe (ou payload chiffré E2E)
    content: text("content"),
    replyToId: uuid("reply_to_id"),
    editedAt: timestamp("edited_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("chat_messages_conv_idx").on(t.conversationId, t.createdAt),
    index("chat_messages_sender_idx").on(t.senderId),
  ]
);

/** Réaction emoji à un message (toggle — unique user+emoji+message). */
export const messageReactions = pgTable(
  "message_reactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    messageId: uuid("message_id")
      .notNull()
      .references(() => chatMessages.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    emoji: varchar("emoji", { length: 16 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("msg_reactions_unique").on(t.messageId, t.userId, t.emoji),
    index("msg_reactions_message_idx").on(t.messageId),
  ]
);

/** Accusé de lecture d'un message par un utilisateur (✓✓ bleu). */
export const messageReads = pgTable(
  "message_reads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    messageId: uuid("message_id")
      .notNull()
      .references(() => chatMessages.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    readAt: timestamp("read_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("msg_reads_unique").on(t.messageId, t.userId),
    index("msg_reads_user_idx").on(t.userId),
  ]
);

/** Pièce jointe d'un message (image, fichier, vocal…). */
export const messageAttachments = pgTable(
  "message_attachments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    messageId: uuid("message_id")
      .notNull()
      .references(() => chatMessages.id, { onDelete: "cascade" }),
    uploaderId: uuid("uploader_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    fileName: varchar("file_name", { length: 255 }).notNull(),
    mimeType: varchar("mime_type", { length: 120 }).notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    url: varchar("url", { length: 500 }).notNull(),
    // Durée en secondes pour les messages vocaux (player waveform)
    durationSeconds: integer("duration_seconds"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("msg_attachments_message_idx").on(t.messageId)]
);

/** Appel audio/vidéo (1-1 ou groupe) — signalisation WebSocket + WebRTC. */
export const calls = pgTable(
  "calls",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    initiatorId: uuid("initiator_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: callTypeEnum("type").notNull().default("audio"),
    status: callStatusEnum("status").notNull().default("ringing"),
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
  },
  (t) => [index("calls_conv_idx").on(t.conversationId, t.startedAt)]
);

/** Participant à un appel. */
export const callParticipants = pgTable(
  "call_participants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    callId: uuid("call_id")
      .notNull()
      .references(() => calls.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    leftAt: timestamp("left_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("call_participants_unique").on(t.callId, t.userId)]
);

/**
 * Présence persistée (dernière connexion / statut déclaré).
 * Le statut « online » temps réel vit en mémoire avec TTL 120 s
 * (src/lib/chat/presence.ts — interface compatible Redis).
 */
export const userPresence = pgTable("user_presence", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  status: presenceStatusEnum("status").notNull().default("offline"),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Clé publique E2E d'un utilisateur (chiffrement côté client, extension).
 * Le serveur ne stocke QUE les clés publiques — jamais les privées.
 */
export const encryptionKeys = pgTable("encryption_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  publicKey: text("public_key").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ------------------------------------------------------------
// RELATIONS
// ------------------------------------------------------------

export const conversationsRelations = relations(
  conversations,
  ({ one, many }) => ({
    createdBy: one(users, {
      fields: [conversations.createdById],
      references: [users.id],
    }),
    members: many(conversationMembers),
    messages: many(chatMessages),
    calls: many(calls),
  })
);

export const conversationMembersRelations = relations(
  conversationMembers,
  ({ one }) => ({
    conversation: one(conversations, {
      fields: [conversationMembers.conversationId],
      references: [conversations.id],
    }),
    user: one(users, {
      fields: [conversationMembers.userId],
      references: [users.id],
    }),
  })
);

export const chatMessagesRelations = relations(
  chatMessages,
  ({ one, many }) => ({
    conversation: one(conversations, {
      fields: [chatMessages.conversationId],
      references: [conversations.id],
    }),
    sender: one(users, {
      fields: [chatMessages.senderId],
      references: [users.id],
    }),
    reactions: many(messageReactions),
    reads: many(messageReads),
    attachments: many(messageAttachments),
  })
);

export const messageReactionsRelations = relations(
  messageReactions,
  ({ one }) => ({
    message: one(chatMessages, {
      fields: [messageReactions.messageId],
      references: [chatMessages.id],
    }),
    user: one(users, {
      fields: [messageReactions.userId],
      references: [users.id],
    }),
  })
);

export const messageReadsRelations = relations(messageReads, ({ one }) => ({
  message: one(chatMessages, {
    fields: [messageReads.messageId],
    references: [chatMessages.id],
  }),
  user: one(users, {
    fields: [messageReads.userId],
    references: [users.id],
  }),
}));

export const messageAttachmentsRelations = relations(
  messageAttachments,
  ({ one }) => ({
    message: one(chatMessages, {
      fields: [messageAttachments.messageId],
      references: [chatMessages.id],
    }),
    uploader: one(users, {
      fields: [messageAttachments.uploaderId],
      references: [users.id],
    }),
  })
);

export const callsRelations = relations(calls, ({ one, many }) => ({
  conversation: one(conversations, {
    fields: [calls.conversationId],
    references: [conversations.id],
  }),
  initiator: one(users, {
    fields: [calls.initiatorId],
    references: [users.id],
  }),
  participants: many(callParticipants),
}));

export const callParticipantsRelations = relations(
  callParticipants,
  ({ one }) => ({
    call: one(calls, {
      fields: [callParticipants.callId],
      references: [calls.id],
    }),
    user: one(users, {
      fields: [callParticipants.userId],
      references: [users.id],
    }),
  })
);
