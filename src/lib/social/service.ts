// ============================================================
// SERVICE RÉSEAU SOCIAL — fil d'actualité
// Utilisé par les routes /api/v1/social/*.
//
// Conventions :
// - Compteurs matérialisés (likesCount/commentsCount) maintenus
//   en transaction en même temps que postLikes / postComments.
// - Pagination par curseur opaque "<createdAt ISO>~<id>" (stable
//   quand de nouveaux posts arrivent en tête de fil).
// - Le broadcast temps réel est fait par les ROUTES (emitToRoom
//   room "feed"), jamais ici : le service reste pur persistance.
// ============================================================

import { db } from "@/db";
import {
  follows,
  postComments,
  postLikes,
  posts,
  users,
} from "@/db/schema";
import { and, desc, eq, inArray, lt, ne, notInArray, or, sql } from "drizzle-orm";

export class SocialError extends Error {
  constructor(
    message: string,
    readonly status: number = 400
  ) {
    super(message);
  }
}

export const FEED_PAGE_SIZE = 10;

// ------------------------------------------------------------
// TYPES SÉRIALISÉS
// ------------------------------------------------------------

export interface FeedAuthor {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  role: string;
  bio: string | null;
  country: string | null;
}

export interface FeedPost {
  id: string;
  content: string;
  imageUrl: string | null;
  likesCount: number;
  commentsCount: number;
  createdAt: string;
  likedByMe: boolean;
  author: FeedAuthor;
}

export interface FeedComment {
  id: string;
  postId: string;
  content: string;
  createdAt: string;
  author: FeedAuthor;
}

export interface SuggestedUser {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  role: string;
  bio: string | null;
  country: string | null;
  followersCount: number;
}

export interface ProfileSummary {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  role: string;
  bio: string | null;
  country: string | null;
  postsCount: number;
  followersCount: number;
  followingCount: number;
}

function toAuthor(u: {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  role: string;
  bio: string | null;
  country: string | null;
}): FeedAuthor {
  return {
    id: u.id,
    fullName: u.fullName,
    avatarUrl: u.avatarUrl ?? null,
    role: u.role,
    bio: u.bio ?? null,
    country: u.country ?? null,
  };
}

// ------------------------------------------------------------
// PAGINATION PAR CURSEUR
// ------------------------------------------------------------

/** Construit la condition « page suivante » à partir du curseur. */
function cursorCondition(cursor: string | undefined) {
  if (!cursor) return undefined;
  const [iso, id] = cursor.split("~");
  const date = new Date(iso);
  if (!id || Number.isNaN(date.getTime())) return undefined;
  return or(
    lt(posts.createdAt, date),
    and(eq(posts.createdAt, date), lt(posts.id, id))
  );
}

function makeNextCursor(items: Array<{ id: string; createdAt: Date }>) {
  const last = items[items.length - 1];
  if (!last) return null;
  return `${last.createdAt.toISOString()}~${last.id}`;
}

// ------------------------------------------------------------
// FIL
// ------------------------------------------------------------

/**
 * Page du fil d'actualité (tri anti-chronologique).
 * `viewerId` sert à résoudre likedByMe ; le feed est public.
 */
export async function getFeed(
  viewerId: string,
  cursor?: string,
  limit: number = FEED_PAGE_SIZE
): Promise<{ items: FeedPost[]; nextCursor: string | null }> {
  const pageLimit = Math.min(Math.max(1, limit), 50);

  const rows = await db
    .select({
      post: posts,
      author: {
        id: users.id,
        fullName: users.fullName,
        avatarUrl: users.avatarUrl,
        role: users.role,
        bio: users.bio,
        country: users.country,
      },
    })
    .from(posts)
    .innerJoin(users, eq(users.id, posts.authorId))
    .where(cursorCondition(cursor))
    .orderBy(desc(posts.createdAt), desc(posts.id))
    .limit(pageLimit + 1); // +1 pour savoir s'il reste une page

  const hasMore = rows.length > pageLimit;
  const page = rows.slice(0, pageLimit);
  const postIds = page.map((r) => r.post.id);

  // Mes likes sur les posts de cette page (une seule requête)
  const liked = new Set<string>();
  if (postIds.length > 0) {
    const myLikes = await db
      .select({ postId: postLikes.postId })
      .from(postLikes)
      .where(
        and(eq(postLikes.userId, viewerId), inArray(postLikes.postId, postIds))
      );
    for (const l of myLikes) liked.add(l.postId);
  }

  return {
    items: page.map((r) => ({
      id: r.post.id,
      content: r.post.content,
      imageUrl: r.post.imageUrl ?? null,
      likesCount: r.post.likesCount,
      commentsCount: r.post.commentsCount,
      createdAt: r.post.createdAt.toISOString(),
      likedByMe: liked.has(r.post.id),
      author: toAuthor(r.author),
    })),
    nextCursor: hasMore
      ? makeNextCursor(page.map((r) => r.post))
      : null,
  };
}

/** Sérialise un post fraîchement créé avec son auteur. */
export async function serializePost(
  postId: string,
  viewerId: string
): Promise<FeedPost> {
  const [row] = await db
    .select({
      post: posts,
      author: {
        id: users.id,
        fullName: users.fullName,
        avatarUrl: users.avatarUrl,
        role: users.role,
        bio: users.bio,
        country: users.country,
      },
    })
    .from(posts)
    .innerJoin(users, eq(users.id, posts.authorId))
    .where(eq(posts.id, postId))
    .limit(1);
  if (!row) throw new SocialError("Publication introuvable", 404);

  const [myLike] = await db
    .select({ id: postLikes.id })
    .from(postLikes)
    .where(and(eq(postLikes.postId, postId), eq(postLikes.userId, viewerId)))
    .limit(1);

  return {
    id: row.post.id,
    content: row.post.content,
    imageUrl: row.post.imageUrl ?? null,
    likesCount: row.post.likesCount,
    commentsCount: row.post.commentsCount,
    createdAt: row.post.createdAt.toISOString(),
    likedByMe: !!myLike,
    author: toAuthor(row.author),
  };
}

/** Crée une publication et la retourne sérialisée. */
export async function createPost(
  authorId: string,
  data: { content: string; imageUrl?: string | null }
): Promise<FeedPost> {
  const [created] = await db
    .insert(posts)
    .values({
      authorId,
      content: data.content,
      imageUrl: data.imageUrl ?? null,
    })
    .returning({ id: posts.id });
  return serializePost(created.id, authorId);
}

// ------------------------------------------------------------
// LIKES
// ------------------------------------------------------------

/**
 * Bascule le like (idempotent : un like = un couple post/utilisateur).
 * Le compteur matérialisé est ajusté dans la même transaction.
 */
export async function toggleLike(
  userId: string,
  postId: string
): Promise<{ liked: boolean; likesCount: number }> {
  return db.transaction(async (tx) => {
    const [post] = await tx
      .select({ id: posts.id, likesCount: posts.likesCount })
      .from(posts)
      .where(eq(posts.id, postId))
      .limit(1);
    if (!post) throw new SocialError("Publication introuvable", 404);

    const [existing] = await tx
      .select({ id: postLikes.id })
      .from(postLikes)
      .where(and(eq(postLikes.postId, postId), eq(postLikes.userId, userId)))
      .limit(1);

    if (existing) {
      await tx.delete(postLikes).where(eq(postLikes.id, existing.id));
      const [updated] = await tx
        .update(posts)
        .set({ likesCount: Math.max(0, post.likesCount - 1) })
        .where(eq(posts.id, postId))
        .returning({ likesCount: posts.likesCount });
      return { liked: false, likesCount: updated.likesCount };
    }

    await tx.insert(postLikes).values({ postId, userId });
    const [updated] = await tx
      .update(posts)
      .set({ likesCount: post.likesCount + 1 })
      .where(eq(posts.id, postId))
      .returning({ likesCount: posts.likesCount });
    return { liked: true, likesCount: updated.likesCount };
  });
}

// ------------------------------------------------------------
// COMMENTAIRES
// ------------------------------------------------------------

/** Commentaires d'un post, plus récents en bas (lecture naturelle). */
export async function listComments(
  postId: string,
  limit = 50
): Promise<FeedComment[]> {
  const rows = await db
    .select({
      comment: postComments,
      author: {
        id: users.id,
        fullName: users.fullName,
        avatarUrl: users.avatarUrl,
        role: users.role,
        bio: users.bio,
        country: users.country,
      },
    })
    .from(postComments)
    .innerJoin(users, eq(users.id, postComments.authorId))
    .where(eq(postComments.postId, postId))
    .orderBy(postComments.createdAt, postComments.id)
    .limit(limit);

  return rows.map((r) => ({
    id: r.comment.id,
    postId: r.comment.postId,
    content: r.comment.content,
    createdAt: r.comment.createdAt.toISOString(),
    author: toAuthor(r.author),
  }));
}

/** Ajoute un commentaire + incrémente le compteur en transaction. */
export async function addComment(
  userId: string,
  postId: string,
  content: string
): Promise<{ comment: FeedComment; commentsCount: number }> {
  return db.transaction(async (tx) => {
    const [post] = await tx
      .select({ id: posts.id, commentsCount: posts.commentsCount })
      .from(posts)
      .where(eq(posts.id, postId))
      .limit(1);
    if (!post) throw new SocialError("Publication introuvable", 404);

    const [created] = await tx
      .insert(postComments)
      .values({ postId, authorId: userId, content })
      .returning();

    const [updated] = await tx
      .update(posts)
      .set({ commentsCount: post.commentsCount + 1 })
      .where(eq(posts.id, postId))
      .returning({ commentsCount: posts.commentsCount });

    const [author] = await tx
      .select({
        id: users.id,
        fullName: users.fullName,
        avatarUrl: users.avatarUrl,
        role: users.role,
        bio: users.bio,
        country: users.country,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    return {
      comment: {
        id: created.id,
        postId: created.postId,
        content: created.content,
        createdAt: created.createdAt.toISOString(),
        author: toAuthor(author),
      },
      commentsCount: updated.commentsCount,
    };
  });
}

// ------------------------------------------------------------
// FOLLOW / UNFOLLOW
// ------------------------------------------------------------

/** Bascule l'abonnement. Impossible de se suivre soi-même. */
export async function toggleFollow(
  followerId: string,
  followeeId: string
): Promise<{ following: boolean; followersCount: number }> {
  if (followerId === followeeId) {
    throw new SocialError("Tu ne peux pas te suivre toi-même", 400);
  }

  const [target] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, followeeId))
    .limit(1);
  if (!target) throw new SocialError("Utilisateur introuvable", 404);

  const [existing] = await db
    .select({ id: follows.id })
    .from(follows)
    .where(
      and(eq(follows.followerId, followerId), eq(follows.followeeId, followeeId))
    )
    .limit(1);

  if (existing) {
    await db.delete(follows).where(eq(follows.id, existing.id));
  } else {
    await db.insert(follows).values({ followerId, followeeId });
  }

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(follows)
    .where(eq(follows.followeeId, followeeId));

  return { following: !existing, followersCount: count };
}

// ------------------------------------------------------------
// SUGGESTIONS « PERSONNES À SUIVRE »
// ------------------------------------------------------------

/**
 * Utilisateurs que je ne suis pas encore, triés par nombre
 * d'abonnés décroissant (signaux sociaux, hors moi-même).
 */
export async function getSuggestions(
  userId: string,
  limit = 5
): Promise<SuggestedUser[]> {
  const alreadyFollowing = db
    .select({ followeeId: follows.followeeId })
    .from(follows)
    .where(eq(follows.followerId, userId));

  const followersCount = sql<number>`(
    SELECT count(*)::int FROM ${follows} f
    WHERE f.followee_id = ${users.id}
  )`;

  const rows = await db
    .select({
      id: users.id,
      fullName: users.fullName,
      avatarUrl: users.avatarUrl,
      role: users.role,
      bio: users.bio,
      country: users.country,
      followersCount,
    })
    .from(users)
    .where(and(ne(users.id, userId), notInArray(users.id, alreadyFollowing)))
    .orderBy(desc(followersCount), users.createdAt)
    .limit(Math.min(Math.max(1, limit), 20));

  return rows.map((r) => ({
    id: r.id,
    fullName: r.fullName,
    avatarUrl: r.avatarUrl ?? null,
    role: r.role,
    bio: r.bio ?? null,
    country: r.country ?? null,
    followersCount: r.followersCount,
  }));
}

// ------------------------------------------------------------
// MINI-PROFIL (colonne gauche)
// ------------------------------------------------------------

export async function getProfileSummary(
  userId: string
): Promise<ProfileSummary> {
  const [u] = await db
    .select({
      id: users.id,
      fullName: users.fullName,
      avatarUrl: users.avatarUrl,
      role: users.role,
      bio: users.bio,
      country: users.country,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!u) throw new SocialError("Utilisateur introuvable", 404);

  const [[postsCount], [followersCount], [followingCount]] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(posts)
      .where(eq(posts.authorId, userId)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(follows)
      .where(eq(follows.followeeId, userId)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(follows)
      .where(eq(follows.followerId, userId)),
  ]);

  return {
    ...u,
    avatarUrl: u.avatarUrl ?? null,
    bio: u.bio ?? null,
    country: u.country ?? null,
    postsCount: postsCount.count,
    followersCount: followersCount.count,
    followingCount: followingCount.count,
  };
}

/** Ids des posts existants (utilitaire tests/smoke). */
export async function countPosts(): Promise<number> {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(posts);
  return count;
}

/** Vérifie qu'un post existe (utilisé avant les sous-routes). */
export async function ensurePostExists(postId: string): Promise<void> {
  const [row] = await db
    .select({ id: posts.id })
    .from(posts)
    .where(eq(posts.id, postId))
    .limit(1);
  if (!row) throw new SocialError("Publication introuvable", 404);
}

