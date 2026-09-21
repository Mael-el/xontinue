// ============================================================
// SCHÉMA — RÉSEAU SOCIAL (fil d'actualité type Facebook/LinkedIn)
// Publications, likes, commentaires et abonnements (follows).
// Ré-exporté depuis schema.ts (point d'entrée Drizzle).
//
// Dénormalement volontaire : likesCount/commentsCount sont des
// compteurs matérialisés maintenus en transaction par le service,
// pour un rendu du fil sans COUNT(*) à chaque ligne.
// ============================================================

import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./schema";

// ------------------------------------------------------------
// TABLES
// ------------------------------------------------------------

/** Publication du fil (texte + image optionnelle). */
export const posts = pgTable(
  "posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    // Image illustratrice optionnelle (URL hébergée ou upload interne)
    imageUrl: varchar("image_url", { length: 500 }),
    // Compteurs matérialisés (mis à jour en transaction)
    likesCount: integer("likes_count").notNull().default(0),
    commentsCount: integer("comments_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("posts_created_idx").on(t.createdAt),
    index("posts_author_idx").on(t.authorId),
  ]
);

/** Un like = un couple (post, user) unique. */
export const postLikes = pgTable(
  "post_likes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("post_likes_unique").on(t.postId, t.userId),
    index("post_likes_post_idx").on(t.postId),
  ]
);

/** Commentaire sur une publication. */
export const postComments = pgTable(
  "post_comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("post_comments_post_idx").on(t.postId, t.createdAt)]
);

/** Abonnement : `followerId` suit `followeeId`. */
export const follows = pgTable(
  "follows",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    followerId: uuid("follower_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    followeeId: uuid("followee_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("follows_unique").on(t.followerId, t.followeeId),
    index("follows_follower_idx").on(t.followerId),
    index("follows_followee_idx").on(t.followeeId),
  ]
);

// ------------------------------------------------------------
// RELATIONS (requêtes relationnelles Drizzle)
// ------------------------------------------------------------

export const postsRelations = relations(posts, ({ one, many }) => ({
  author: one(users, { fields: [posts.authorId], references: [users.id] }),
  likes: many(postLikes),
  comments: many(postComments),
}));

export const postLikesRelations = relations(postLikes, ({ one }) => ({
  post: one(posts, { fields: [postLikes.postId], references: [posts.id] }),
  user: one(users, { fields: [postLikes.userId], references: [users.id] }),
}));

export const postCommentsRelations = relations(postComments, ({ one }) => ({
  post: one(posts, { fields: [postComments.postId], references: [posts.id] }),
  author: one(users, {
    fields: [postComments.authorId],
    references: [users.id],
  }),
}));

export const followsRelations = relations(follows, ({ one }) => ({
  follower: one(users, {
    fields: [follows.followerId],
    references: [users.id],
    relationName: "follower",
  }),
  followee: one(users, {
    fields: [follows.followeeId],
    references: [users.id],
    relationName: "followee",
  }),
}));
