// ============================================================
// FIL SOCIAL — accueil des utilisateurs connectés
// Trois colonnes (pattern LinkedIn/Facebook) :
//   gauche  → mini-profil + navigation rapide
//   centre  → composer + publications (likes / commentaires)
//   droite  → « Personnes à suivre » + cours tendances
// Temps réel : socket /chat, room « feed » (post:new, post:like,
// post:comment) — les nouveaux posts défilent sans recharger.
// ============================================================

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSocket } from "@/lib/realtime/hooks";

// ------------------------------------------------------------
// TYPES (miroir de src/lib/social/service.ts)
// ------------------------------------------------------------

interface FeedAuthor {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  role: string;
  bio: string | null;
  country: string | null;
}

interface FeedPost {
  id: string;
  content: string;
  imageUrl: string | null;
  likesCount: number;
  commentsCount: number;
  createdAt: string;
  likedByMe: boolean;
  author: FeedAuthor;
}

interface FeedComment {
  id: string;
  postId: string;
  content: string;
  createdAt: string;
  author: FeedAuthor;
}

interface SuggestedUser {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  role: string;
  bio: string | null;
  country: string | null;
  followersCount: number;
}

interface ProfileSummary {
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

interface TrendCourse {
  slug: string;
  title: string;
  rating: number;
  studentsCount: number;
  level: string;
  domain?: { name: string; icon: string | null } | null;
}

// ------------------------------------------------------------
// HELPERS
// ------------------------------------------------------------

/** Initiales d'un nom complet (fallback si pas d'avatar). */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const a = parts[0]?.[0] ?? "?";
  const b = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (a + b).toUpperCase();
}

/** Couleur stable d'avatar par id (hash simple → palette). */
function avatarColor(id: string): string {
  const palette = [
    "from-orange-500 to-amber-500",
    "from-emerald-500 to-teal-500",
    "from-sky-500 to-indigo-500",
    "from-fuchsia-500 to-pink-500",
    "from-lime-500 to-emerald-500",
    "from-rose-500 to-orange-500",
  ];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

/** « il y a 3 h » en français. */
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.max(1, Math.floor(diff / 1000));
  if (sec < 60) return `à l'instant`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `il y a ${d} j`;
  const w = Math.floor(d / 7);
  if (w < 5) return `il y a ${w} sem`;
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
  });
}

const ROLE_LABELS: Record<string, string> = {
  student: "Apprenant",
  instructor: "Formateur",
  mentor: "Mentor",
  company: "Entreprise",
  admin: "Admin",
};

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json?.error ?? `Erreur ${res.status}`);
  }
  return json as T;
}

// ------------------------------------------------------------
// AVATAR
// ------------------------------------------------------------

function Avatar({
  user,
  size = "md",
}: {
  user: { id: string; fullName: string; avatarUrl: string | null };
  size?: "sm" | "md" | "lg";
}) {
  const cls =
    size === "sm"
      ? "h-9 w-9 text-xs"
      : size === "lg"
        ? "h-14 w-14 text-lg"
        : "h-11 w-11 text-sm";
  if (user.avatarUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={user.avatarUrl}
        alt={user.fullName}
        className={`${cls} shrink-0 rounded-full object-cover ring-1 ring-neutral-800`}
      />
    );
  }
  return (
    <div
      className={`${cls} flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br font-bold text-black ${avatarColor(
        user.id
      )}`}
      aria-hidden
    >
      {initials(user.fullName)}
    </div>
  );
}

// ------------------------------------------------------------
// COMPOSER
// ------------------------------------------------------------

function Composer({
  profile,
  onPosted,
}: {
  profile: ProfileSummary | null;
  onPosted: (post: FeedPost) => void;
}) {
  const [content, setContent] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [showImage, setShowImage] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function publish() {
    const text = content.trim();
    if (!text || sending) return;
    setSending(true);
    setError(null);
    try {
      const { post } = await fetchJson<{ post: FeedPost }>(
        "/api/v1/social/posts",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            content: text,
            imageUrl: imageUrl.trim() || null,
          }),
        }
      );
      setContent("");
      setImageUrl("");
      setShowImage(false);
      onPosted(post);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Publication impossible");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4">
      <div className="flex items-start gap-3">
        <Avatar
          user={{
            id: profile?.id ?? "me",
            fullName: profile?.fullName ?? "Moi",
            avatarUrl: profile?.avatarUrl ?? null,
          }}
        />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Partage ton avancée, une question, une réussite…"
          rows={3}
          maxLength={2000}
          className="w-full resize-none rounded-xl border border-neutral-800 bg-neutral-900/60 px-4 py-3 text-sm text-white placeholder:text-neutral-500 focus:border-orange-500/60 focus:outline-none"
        />
      </div>

      {showImage && (
        <input
          type="url"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="https://… (URL de l'image, optionnel)"
          className="mt-3 w-full rounded-xl border border-neutral-800 bg-neutral-900/60 px-4 py-2.5 text-xs text-white placeholder:text-neutral-500 focus:border-orange-500/60 focus:outline-none"
        />
      )}

      {error && (
        <p className="mt-2 text-xs font-medium text-red-400">{error}</p>
      )}

      <div className="mt-3 flex items-center justify-between border-t border-neutral-900 pt-3">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setShowImage((v) => !v)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              showImage
                ? "bg-emerald-500/15 text-emerald-400"
                : "text-neutral-400 hover:bg-neutral-900 hover:text-white"
            }`}
          >
            🖼️ Photo
          </button>
          <span className="hidden rounded-lg px-3 py-1.5 text-xs text-neutral-600 sm:block">
            {Math.max(0, 2000 - content.length)} caractères restants
          </span>
        </div>
        <button
          type="button"
          onClick={publish}
          disabled={!content.trim() || sending}
          className="rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-2 text-sm font-bold text-black shadow-lg shadow-orange-500/20 transition hover:from-orange-400 hover:to-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {sending ? "Publication…" : "Publier"}
        </button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// COMMENTAIRES
// ------------------------------------------------------------

function CommentThread({
  postId,
  expanded,
  onCountChange,
  profile,
}: {
  postId: string;
  expanded: boolean;
  onCountChange: (n: number) => void;
  profile: ProfileSummary | null;
}) {
  const [comments, setComments] = useState<FeedComment[] | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!expanded || comments !== null) return;
    let cancelled = false;
    fetchJson<{ items: FeedComment[] }>(
      `/api/v1/social/posts/${postId}/comments`
    )
      .then((d) => !cancelled && setComments(d.items))
      .catch(() => !cancelled && setComments([]));
    return () => {
      cancelled = true;
    };
  }, [expanded, comments, postId]);

  async function send() {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const { comment, commentsCount } = await fetchJson<{
        comment: FeedComment;
        commentsCount: number;
      }>(`/api/v1/social/posts/${postId}/comments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content: text }),
      });
      setComments((c) => [...(c ?? []), comment]);
      onCountChange(commentsCount);
      setDraft("");
    } catch {
      // silencieux : le champ reste rempli pour réessayer
    } finally {
      setSending(false);
    }
  }

  if (!expanded) return null;

  return (
    <div className="mt-3 space-y-3 border-t border-neutral-900 pt-3">
      {comments === null ? (
        <p className="text-xs text-neutral-500">Chargement…</p>
      ) : (
        comments.map((c) => (
          <div key={c.id} className="flex items-start gap-2.5">
            <Avatar user={c.author} size="sm" />
            <div className="min-w-0 flex-1 rounded-xl bg-neutral-900/70 px-3 py-2">
              <div className="flex items-baseline gap-2">
                <span className="truncate text-xs font-bold text-white">
                  {c.author.fullName}
                </span>
                <span className="shrink-0 text-[10px] text-neutral-500">
                  {timeAgo(c.createdAt)}
                </span>
              </div>
              <p className="mt-0.5 break-words text-sm text-neutral-200">
                {c.content}
              </p>
            </div>
          </div>
        ))
      )}

      {/* Saisie d'un commentaire */}
      <div className="flex items-center gap-2">
        <Avatar
          user={{
            id: profile?.id ?? "me",
            fullName: profile?.fullName ?? "Moi",
            avatarUrl: profile?.avatarUrl ?? null,
          }}
          size="sm"
        />
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder="Écrire un commentaire…"
          maxLength={1000}
          className="flex-1 rounded-full border border-neutral-800 bg-neutral-900/60 px-4 py-2 text-sm text-white placeholder:text-neutral-500 focus:border-orange-500/60 focus:outline-none"
        />
        <button
          type="button"
          onClick={send}
          disabled={!draft.trim() || sending}
          className="rounded-full bg-orange-500 px-4 py-2 text-xs font-bold text-black transition hover:bg-orange-400 disabled:opacity-40"
        >
          ➤
        </button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// CARTE DE PUBLICATION
// ------------------------------------------------------------

function PostCard({
  post,
  onLike,
  onPostComment,
  profile,
}: {
  post: FeedPost;
  onLike: (postId: string) => void;
  onPostComment: (post: FeedPost) => void;
  profile: ProfileSummary | null;
}) {
  const [commentsOpen, setCommentsOpen] = useState(false);

  return (
    <article className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4 sm:p-5">
      {/* En-tête : auteur */}
      <div className="flex items-center gap-3">
        <Avatar user={post.author} />
        <div className="min-w-0 flex-1">
          <Link
            href={`/profile/${post.author.id}`}
            className="block truncate text-sm font-bold text-white hover:underline"
          >
            {post.author.fullName}
          </Link>
          <div className="truncate text-xs text-neutral-500">
            {ROLE_LABELS[post.author.role] ?? post.author.role}
            {post.author.country ? ` · ${post.author.country}` : ""} ·{" "}
            {timeAgo(post.createdAt)}
          </div>
        </div>
      </div>

      {/* Contenu */}
      <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-neutral-100">
        {post.content}
      </p>

      {post.imageUrl && (
        <div className="mt-3 overflow-hidden rounded-xl border border-neutral-800">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={post.imageUrl}
            alt="Illustration de la publication"
            className="max-h-96 w-full object-cover"
            loading="lazy"
          />
        </div>
      )}

      {/* Compteurs */}
      <div className="mt-3 flex items-center justify-between text-xs text-neutral-500">
        <span>
          {post.likesCount > 0 && `👍 ${post.likesCount}`}
        </span>
        <span>
          {post.commentsCount > 0 &&
            `${post.commentsCount} commentaire${
              post.commentsCount > 1 ? "s" : ""
            }`}
        </span>
      </div>

      {/* Actions */}
      <div className="mt-2 grid grid-cols-2 gap-1 border-t border-neutral-900 pt-2">
        <button
          type="button"
          onClick={() => onLike(post.id)}
          className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${
            post.likedByMe
              ? "bg-orange-500/15 text-orange-400"
              : "text-neutral-400 hover:bg-neutral-900 hover:text-white"
          }`}
        >
          {post.likedByMe ? "👍 J'aime" : "👍 J'aime"}
        </button>
        <button
          type="button"
          onClick={() => setCommentsOpen((v) => !v)}
          className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${
            commentsOpen
              ? "bg-sky-500/15 text-sky-400"
              : "text-neutral-400 hover:bg-neutral-900 hover:text-white"
          }`}
        >
          💬 Commenter
        </button>
      </div>

      <CommentThread
        postId={post.id}
        expanded={commentsOpen}
        profile={profile}
        onCountChange={(n) =>
          onPostComment({ ...post, commentsCount: n })
        }
      />
    </article>
  );
}

// ------------------------------------------------------------
// COLONNES LATÉRALES
// ------------------------------------------------------------

function ProfileCard({ profile }: { profile: ProfileSummary | null }) {
  if (!profile) {
    return (
      <div className="animate-pulse rounded-2xl border border-neutral-800 bg-neutral-950 p-5">
        <div className="mx-auto h-14 w-14 rounded-full bg-neutral-800" />
        <div className="mx-auto mt-3 h-3 w-28 rounded bg-neutral-800" />
        <div className="mx-auto mt-2 h-2 w-20 rounded bg-neutral-800" />
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950">
      <div className="h-16 bg-gradient-to-r from-orange-500/60 via-amber-500/40 to-emerald-500/60" />
      <div className="-mt-7 flex flex-col items-center px-5 pb-5 text-center">
        <Avatar
          user={{
            id: profile.id,
            fullName: profile.fullName,
            avatarUrl: profile.avatarUrl,
          }}
          size="lg"
        />
        <Link
          href="/profile/me"
          className="mt-2 text-sm font-bold text-white hover:underline"
        >
          {profile.fullName}
        </Link>
        <p className="text-xs text-neutral-500">
          {ROLE_LABELS[profile.role] ?? profile.role}
          {profile.country ? ` · ${profile.country}` : ""}
        </p>
        {profile.bio && (
          <p className="mt-2 line-clamp-2 text-xs text-neutral-400">
            {profile.bio}
          </p>
        )}
        <div className="mt-4 grid w-full grid-cols-3 gap-2 border-t border-neutral-900 pt-3 text-center">
          <div>
            <div className="text-sm font-black text-white">
              {profile.postsCount}
            </div>
            <div className="text-[10px] uppercase tracking-wide text-neutral-500">
              Posts
            </div>
          </div>
          <div>
            <div className="text-sm font-black text-white">
              {profile.followersCount}
            </div>
            <div className="text-[10px] uppercase tracking-wide text-neutral-500">
              Abonnés
            </div>
          </div>
          <div>
            <div className="text-sm font-black text-white">
              {profile.followingCount}
            </div>
            <div className="text-[10px] uppercase tracking-wide text-neutral-500">
              Suivi·e·s
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function QuickLinks() {
  const links = [
    { href: "/courses", label: "Catalogue", icon: "🎓" },
    { href: "/dashboard", label: "Mon apprentissage", icon: "📊" },
    { href: "/messages", label: "Messagerie", icon: "💬" },
    { href: "/workspaces", label: "Espaces de travail", icon: "🏗️" },
    { href: "/jobs", label: "Emplois", icon: "💼" },
    { href: "/leaderboard", label: "Classement", icon: "🏆" },
  ];
  return (
    <nav className="rounded-2xl border border-neutral-800 bg-neutral-950 p-2">
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-neutral-300 transition hover:bg-neutral-900 hover:text-white"
        >
          <span aria-hidden>{l.icon}</span>
          {l.label}
        </Link>
      ))}
    </nav>
  );
}

function SuggestionsCard({
  suggestions,
  followingIds,
  onToggleFollow,
}: {
  suggestions: SuggestedUser[];
  followingIds: Set<string>;
  onToggleFollow: (id: string) => void;
}) {
  if (suggestions.length === 0) {
    return (
      <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-5 text-center text-xs text-neutral-500">
        Tu suis déjà tout le monde 🎉
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4">
      <h3 className="text-sm font-black text-white">Personnes à suivre</h3>
      <ul className="mt-3 space-y-3">
        {suggestions.map((u) => {
          const following = followingIds.has(u.id);
          return (
            <li key={u.id} className="flex items-center gap-3">
              <Avatar user={u} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-bold text-white">
                  {u.fullName}
                </div>
                <div className="truncate text-[11px] text-neutral-500">
                  {ROLE_LABELS[u.role] ?? u.role}
                  {u.followersCount > 0 &&
                    ` · ${u.followersCount} abonné${
                      u.followersCount > 1 ? "s" : ""
                    }`}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onToggleFollow(u.id)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition ${
                  following
                    ? "border border-neutral-700 text-neutral-300 hover:border-red-500/50 hover:text-red-400"
                    : "bg-white text-black hover:bg-neutral-200"
                }`}
              >
                {following ? "Suivi" : "+ Suivre"}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function TrendingCourses({ courses }: { courses: TrendCourse[] }) {
  if (courses.length === 0) return null;
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4">
      <h3 className="text-sm font-black text-white">Formations tendances</h3>
      <ul className="mt-3 space-y-2.5">
        {courses.map((c) => (
          <li key={c.slug}>
            <Link
              href={`/courses/${c.slug}`}
              className="group flex items-start gap-2.5 rounded-xl p-2 transition hover:bg-neutral-900"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-neutral-900 text-base group-hover:bg-neutral-800">
                {c.domain?.icon ?? "🎓"}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-xs font-bold text-neutral-200 group-hover:text-white">
                  {c.title}
                </span>
                <span className="text-[11px] text-neutral-500">
                  ⭐ {(c.rating / 10).toFixed(1)} ·{" "}
                  {c.studentsCount.toLocaleString("fr-FR")} apprenants
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <Link
        href="/courses"
        className="mt-3 block rounded-xl border border-neutral-800 py-2 text-center text-xs font-bold text-orange-400 transition hover:border-orange-500/50 hover:bg-orange-500/5"
      >
        Tout le catalogue →
      </Link>
    </div>
  );
}

// ------------------------------------------------------------
// COMPOSANT PRINCIPAL
// ------------------------------------------------------------

export function SocialFeed({
  initialProfile,
}: {
  initialProfile: ProfileSummary | null;
}) {
  const [profile, setProfile] = useState<ProfileSummary | null>(initialProfile);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestedUser[]>([]);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [courses, setCourses] = useState<TrendCourse[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const pendingRef = useRef<FeedPost[]>([]);
  const loadedRef = useRef(false);

  // Temps réel : nouveaux posts + compteurs likes/commentaires
  const { socket } = useSocket("/chat");

  // ----------------------------------------------------------
  // Chargement initial (fil + profil + suggestions + tendances)
  // ----------------------------------------------------------
  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;

    void fetchJson<{ items: FeedPost[]; nextCursor: string | null }>(
      "/api/v1/social/posts"
    )
      .then((d) => {
        setPosts(d.items);
        setNextCursor(d.nextCursor);
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    void fetchJson<{ profile: ProfileSummary }>("/api/v1/social/profile")
      .then((d) => setProfile(d.profile))
      .catch(() => {});

    void fetchJson<{ items: SuggestedUser[] }>("/api/v1/social/suggestions")
      .then((d) => setSuggestions(d.items))
      .catch(() => {});

    void fetchJson<{ courses: TrendCourse[] }>(
      "/api/courses?sort=popular&limit=5"
    )
      .then((d) => setCourses(d.courses ?? []))
      .catch(() => {});
  }, []);

  // ----------------------------------------------------------
  // Temps réel : room « feed »
  // ----------------------------------------------------------
  useEffect(() => {
    if (!socket) return;

    const onNew = ({ post }: { post: FeedPost }) => {
      // Mon propre post est déjà inséré par le composer ; les autres
      // arrivent derrière une bannière « X nouvelles publications »
      // (pattern Facebook — le fil ne saute pas sous les yeux).
      setPosts((current) => {
        if (current.some((p) => p.id === post.id)) return current;
        pendingRef.current = [post, ...pendingRef.current];
        queueMicrotask(() => setPendingCount(pendingRef.current.length));
        return current;
      });
    };

    const onLike = ({
      postId,
      likesCount,
    }: {
      postId: string;
      likesCount: number;
    }) => {
      setPosts((current) =>
        current.map((p) => (p.id === postId ? { ...p, likesCount } : p))
      );
    };

    const onComment = ({
      postId,
      commentsCount,
    }: {
      postId: string;
      commentsCount: number;
    }) => {
      setPosts((current) =>
        current.map((p) => (p.id === postId ? { ...p, commentsCount } : p))
      );
    };

    socket.on("post:new", onNew);
    socket.on("post:like", onLike);
    socket.on("post:comment", onComment);
    return () => {
      socket.off("post:new", onNew);
      socket.off("post:like", onLike);
      socket.off("post:comment", onComment);
    };
  }, [socket]);

  // ----------------------------------------------------------
  // Actions
  // ----------------------------------------------------------

  const addPosted = useCallback((post: FeedPost) => {
    setPosts((current) =>
      current.some((p) => p.id === post.id) ? current : [post, ...current]
    );
    setProfile((p) =>
      p ? { ...p, postsCount: p.postsCount + 1 } : p
    );
  }, []);

  const showPending = useCallback(() => {
    setPosts((current) => {
      const fresh = pendingRef.current.filter(
        (p) => !current.some((c) => c.id === p.id)
      );
      pendingRef.current = [];
      return [...fresh, ...current];
    });
    setPendingCount(0);
  }, []);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const d = await fetchJson<{
        items: FeedPost[];
        nextCursor: string | null;
      }>(`/api/v1/social/posts?cursor=${encodeURIComponent(nextCursor)}`);
      setPosts((current) => {
        const seen = new Set(current.map((p) => p.id));
        return [...current, ...d.items.filter((p) => !seen.has(p.id))];
      });
      setNextCursor(d.nextCursor);
    } catch {
      // l'utilisateur peut réessayer
    } finally {
      setLoadingMore(false);
    }
  }, [nextCursor, loadingMore]);

  const toggleLike = useCallback(async (postId: string) => {
    // Optimiste immédiat
    setPosts((current) =>
      current.map((p) =>
        p.id === postId
          ? {
              ...p,
              likedByMe: !p.likedByMe,
              likesCount: Math.max(0, p.likesCount + (p.likedByMe ? -1 : 1)),
            }
          : p
      )
    );
    try {
      const { liked, likesCount } = await fetchJson<{
        liked: boolean;
        likesCount: number;
      }>(`/api/v1/social/posts/${postId}/like`, { method: "POST" });
      setPosts((current) =>
        current.map((p) =>
          p.id === postId ? { ...p, likedByMe: liked, likesCount } : p
        )
      );
    } catch {
      // Rollback en rechargeant la valeur serveur au prochain render
    }
  }, []);

  const toggleFollow = useCallback(
    async (targetId: string) => {
      const wasFollowing = followingIds.has(targetId);
      try {
        const { following } = await fetchJson<{ following: boolean }>(
          `/api/v1/social/follow/${targetId}`,
          { method: "POST" }
        );
        setFollowingIds((current) => {
          const next = new Set(current);
          if (following) next.add(targetId);
          else next.delete(targetId);
          return next;
        });
        setProfile((p) =>
          p ? { ...p, followingCount: p.followingCount + (following && !wasFollowing ? 1 : !following && wasFollowing ? -1 : 0) } : p
        );
      } catch {
        // non bloquant
      }
    },
    [followingIds]
  );

  const updatePost = useCallback((updated: FeedPost) => {
    setPosts((current) =>
      current.map((p) => (p.id === updated.id ? updated : p))
    );
  }, []);

  // ----------------------------------------------------------
  // RENDU
  // ----------------------------------------------------------

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(0,1fr)_300px]">
        {/* Colonne gauche */}
        <aside className="hidden space-y-4 lg:block">
          <div className="sticky top-20 space-y-4">
            <ProfileCard profile={profile} />
            <QuickLinks />
          </div>
        </aside>

        {/* Colonne centre */}
        <main className="min-w-0 space-y-4">
          {/* Mini-profil mobile (au-dessus du composer) */}
          <div className="lg:hidden">
            <ProfileCard profile={profile} />
          </div>

          <Composer profile={profile} onPosted={addPosted} />

          {/* Bannière temps réel */}
          {pendingCount > 0 && (
            <button
              type="button"
              onClick={showPending}
              className="w-full rounded-xl border border-sky-500/30 bg-sky-500/10 py-2.5 text-sm font-bold text-sky-400 transition hover:bg-sky-500/20"
            >
              ↑ {pendingCount} nouvelle{pendingCount > 1 ? "s" : ""}{" "}
              publication{pendingCount > 1 ? "s" : ""}
            </button>
          )}

          {/* Publications */}
          {loading ? (
            <div className="space-y-4">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="animate-pulse rounded-2xl border border-neutral-800 bg-neutral-950 p-5"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-11 w-11 rounded-full bg-neutral-800" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-32 rounded bg-neutral-800" />
                      <div className="h-2 w-24 rounded bg-neutral-800" />
                    </div>
                  </div>
                  <div className="mt-4 space-y-2">
                    <div className="h-3 w-full rounded bg-neutral-800" />
                    <div className="h-3 w-3/4 rounded bg-neutral-800" />
                  </div>
                </div>
              ))}
            </div>
          ) : posts.length === 0 && pendingCount === 0 ? (
            <div className="rounded-2xl border border-dashed border-neutral-800 bg-neutral-950 p-10 text-center">
              <div className="text-4xl">🌍</div>
              <h3 className="mt-3 text-lg font-black text-white">
                Le fil t'attend !
              </h3>
              <p className="mx-auto mt-1 max-w-sm text-sm text-neutral-400">
                Sois la première personne à partager une avancée, une question
                ou une réussite avec la communauté AfricaSkills.
              </p>
            </div>
          ) : (
            posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                onLike={toggleLike}
                onPostComment={updatePost}
                profile={profile}
              />
            ))
          )}

          {nextCursor && !loading && (
            <button
              type="button"
              onClick={loadMore}
              disabled={loadingMore}
              className="w-full rounded-xl border border-neutral-800 bg-neutral-950 py-3 text-sm font-bold text-neutral-300 transition hover:border-orange-500/50 hover:text-white disabled:opacity-50"
            >
              {loadingMore ? "Chargement…" : "Voir plus de publications"}
            </button>
          )}
        </main>

        {/* Colonne droite (grand écran) */}
        <aside className="hidden space-y-4 xl:block">
          <div className="sticky top-20 space-y-4">
            <SuggestionsCard
              suggestions={suggestions}
              followingIds={followingIds}
              onToggleFollow={toggleFollow}
            />
            <TrendingCourses courses={courses} />
          </div>
        </aside>
      </div>

      {/* Suggestions + tendances empilées sous le fil (petit/moyen écran) */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:hidden">
        <SuggestionsCard
          suggestions={suggestions}
          followingIds={followingIds}
          onToggleFollow={toggleFollow}
        />
        <TrendingCourses courses={courses} />
      </div>
    </div>
  );
}
