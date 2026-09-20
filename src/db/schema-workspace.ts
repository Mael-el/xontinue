// ============================================================
// SCHÉMA — ESPACE DE TRAVAIL (type Discord)
// Workspaces (serveurs) : catégories, salons, rôles, invitations,
// messages temps réel et états vocaux.
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

/** Type de salon : texte, vocal, annonces (lecture seule) ou forum. */
export const workspaceChannelTypeEnum = pgEnum("workspace_channel_type", [
  "text",
  "voice",
  "announcement",
  "forum",
]);

// ------------------------------------------------------------
// TABLES
// ------------------------------------------------------------

/** Serveur de travail (communauté, cohorte, entreprise…). */
export const workspaces = pgTable(
  "workspaces",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 120 }).notNull(),
    slug: varchar("slug", { length: 140 }).notNull().unique(),
    description: text("description"),
    icon: varchar("icon", { length: 20 }).default("🏢"),
    bannerUrl: varchar("banner_url", { length: 500 }),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    isPublic: boolean("is_public").notNull().default(false),
    // Compteur dénormalisé (mis à jour à chaque join/leave)
    memberCount: integer("member_count").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("workspaces_owner_idx").on(t.ownerId)]
);

/** Catégorie regroupant des salons (ex: « Général », « Projets »). */
export const workspaceCategories = pgTable(
  "workspace_categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 80 }).notNull(),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("ws_categories_workspace_idx").on(t.workspaceId)]
);

/** Salon de discussion (texte / vocal / annonces / forum). */
export const workspaceChannels = pgTable(
  "workspace_channels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id").references(() => workspaceCategories.id, {
      onDelete: "set null",
    }),
    name: varchar("name", { length: 80 }).notNull(),
    type: workspaceChannelTypeEnum("type").notNull().default("text"),
    topic: varchar("topic", { length: 250 }),
    position: integer("position").notNull().default(0),
    isPrivate: boolean("is_private").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("ws_channels_workspace_idx").on(t.workspaceId)]
);

/** Membre d'un workspace. */
export const workspaceMembers = pgTable(
  "workspace_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    nickname: varchar("nickname", { length: 80 }),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("ws_members_unique").on(t.workspaceId, t.userId),
    index("ws_members_user_idx").on(t.userId),
  ]
);

/**
 * Rôle d'un workspace avec permissions granulaires.
 * `permissions` est un champ de bits (voir src/lib/workspaces/permissions.ts).
 */
export const workspaceRoles = pgTable(
  "workspace_roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 80 }).notNull(),
    color: varchar("color", { length: 20 }).default("#94A3B8"),
    permissions: integer("permissions").notNull().default(0),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("ws_roles_workspace_idx").on(t.workspaceId)]
);

/** Attribution d'un rôle à un membre. */
export const workspaceMemberRoles = pgTable(
  "workspace_member_roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    memberId: uuid("member_id")
      .notNull()
      .references(() => workspaceMembers.id, { onDelete: "cascade" }),
    roleId: uuid("role_id")
      .notNull()
      .references(() => workspaceRoles.id, { onDelete: "cascade" }),
  },
  (t) => [uniqueIndex("ws_member_roles_unique").on(t.memberId, t.roleId)]
);

/** Message posté dans un salon. */
export const workspaceMessages = pgTable(
  "workspace_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    channelId: uuid("channel_id")
      .notNull()
      .references(() => workspaceChannels.id, { onDelete: "cascade" }),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    replyToId: uuid("reply_to_id"),
    editedAt: timestamp("edited_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("ws_messages_channel_idx").on(t.channelId, t.createdAt),
    index("ws_messages_author_idx").on(t.authorId),
  ]
);

/** Invitation à rejoindre un workspace, par code partageable. */
export const workspaceInvites = pgTable(
  "workspace_invites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    code: varchar("code", { length: 20 }).notNull().unique(),
    creatorId: uuid("creator_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    maxUses: integer("max_uses"),
    usesCount: integer("uses_count").notNull().default(0),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("ws_invites_workspace_idx").on(t.workspaceId)]
);

/** Présence d'un membre dans un salon vocal (source de vérité serveur). */
export const workspaceVoiceStates = pgTable(
  "workspace_voice_states",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    channelId: uuid("channel_id")
      .notNull()
      .references(() => workspaceChannels.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    muted: boolean("muted").notNull().default(false),
    deafened: boolean("deafened").notNull().default(false),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("ws_voice_unique").on(t.channelId, t.userId)]
);

// ------------------------------------------------------------
// RELATIONS
// ------------------------------------------------------------

export const workspacesRelations = relations(workspaces, ({ one, many }) => ({
  owner: one(users, { fields: [workspaces.ownerId], references: [users.id] }),
  categories: many(workspaceCategories),
  channels: many(workspaceChannels),
  members: many(workspaceMembers),
  roles: many(workspaceRoles),
  invites: many(workspaceInvites),
}));

export const workspaceCategoriesRelations = relations(
  workspaceCategories,
  ({ one, many }) => ({
    workspace: one(workspaces, {
      fields: [workspaceCategories.workspaceId],
      references: [workspaces.id],
    }),
    channels: many(workspaceChannels),
  })
);

export const workspaceChannelsRelations = relations(
  workspaceChannels,
  ({ one, many }) => ({
    workspace: one(workspaces, {
      fields: [workspaceChannels.workspaceId],
      references: [workspaces.id],
    }),
    category: one(workspaceCategories, {
      fields: [workspaceChannels.categoryId],
      references: [workspaceCategories.id],
    }),
    messages: many(workspaceMessages),
    voiceStates: many(workspaceVoiceStates),
  })
);

export const workspaceMembersRelations = relations(
  workspaceMembers,
  ({ one, many }) => ({
    workspace: one(workspaces, {
      fields: [workspaceMembers.workspaceId],
      references: [workspaces.id],
    }),
    user: one(users, {
      fields: [workspaceMembers.userId],
      references: [users.id],
    }),
    roles: many(workspaceMemberRoles),
  })
);

export const workspaceRolesRelations = relations(
  workspaceRoles,
  ({ one, many }) => ({
    workspace: one(workspaces, {
      fields: [workspaceRoles.workspaceId],
      references: [workspaces.id],
    }),
    members: many(workspaceMemberRoles),
  })
);

export const workspaceMemberRolesRelations = relations(
  workspaceMemberRoles,
  ({ one }) => ({
    member: one(workspaceMembers, {
      fields: [workspaceMemberRoles.memberId],
      references: [workspaceMembers.id],
    }),
    role: one(workspaceRoles, {
      fields: [workspaceMemberRoles.roleId],
      references: [workspaceRoles.id],
    }),
  })
);

export const workspaceMessagesRelations = relations(
  workspaceMessages,
  ({ one }) => ({
    channel: one(workspaceChannels, {
      fields: [workspaceMessages.channelId],
      references: [workspaceChannels.id],
    }),
    author: one(users, {
      fields: [workspaceMessages.authorId],
      references: [users.id],
    }),
  })
);

export const workspaceInvitesRelations = relations(
  workspaceInvites,
  ({ one }) => ({
    workspace: one(workspaces, {
      fields: [workspaceInvites.workspaceId],
      references: [workspaces.id],
    }),
    creator: one(users, {
      fields: [workspaceInvites.creatorId],
      references: [users.id],
    }),
  })
);

export const workspaceVoiceStatesRelations = relations(
  workspaceVoiceStates,
  ({ one }) => ({
    channel: one(workspaceChannels, {
      fields: [workspaceVoiceStates.channelId],
      references: [workspaceChannels.id],
    }),
    user: one(users, {
      fields: [workspaceVoiceStates.userId],
      references: [users.id],
    }),
  })
);
