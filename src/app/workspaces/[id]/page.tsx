// ============================================================
// PAGE — Espace de travail (Discord-like)
// Salons par catégorie · messages en direct (socket.io)
// typing · vocal WebRTC full-mesh · membres + présence
// invitations par code.
// ============================================================

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/context";
import {
  usePresenceHeartbeat,
  usePresenceUpdates,
  useSocket,
  useTyping,
} from "@/lib/realtime/hooks";
import { RtcMesh } from "@/lib/realtime/rtc-mesh";

// ─── Types ───────────────────────────────────────────────────

interface Channel {
  id: string;
  name: string;
  type: "text" | "voice" | "announcement" | "forum";
  topic: string | null;
  categoryId: string | null;
  voiceParticipants: { userId: string; fullName: string; muted: boolean; deafened: boolean }[];
}

interface WsMessage {
  id: string;
  channelId: string;
  authorId: string;
  content: string;
  replyToId: string | null;
  replyTo?: { id: string; authorName: string; content: string } | null;
  editedAt: string | null;
  createdAt: string;
  author?: { id: string; fullName: string; avatarUrl: string | null } | null;
}

interface Member {
  id: string;
  userId: string;
  fullName: string;
  avatarUrl: string | null;
  isOwner: boolean;
  roles: { id: string; name: string; color: string | null }[];
}

interface WorkspaceDetail {
  id: string;
  name: string;
  icon: string | null;
  description: string | null;
  isOwner: boolean;
  myPermissions: string[];
}

const CHANNEL_ICONS: Record<Channel["type"], string> = {
  text: "#",
  voice: "🔊",
  announcement: "📢",
  forum: "💬",
};

// ─── Page ────────────────────────────────────────────────────

export default function WorkspacePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuth();

  const [workspace, setWorkspace] = useState<WorkspaceDetail | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { socket: wsSocket, connected: wsConnected } = useSocket("/workspace", isAuthenticated);
  const { socket: chatSocket } = useSocket("/chat", isAuthenticated);
  usePresenceHeartbeat(chatSocket);
  const { merge: mergePresence } = usePresenceUpdates(chatSocket);

  // ── Gate ──────────────────────────────────────────────────
  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace("/auth/login");
  }, [isLoading, isAuthenticated, router]);

  // ── Chargement initial ────────────────────────────────────
  const loadAll = useCallback(async () => {
    const [wsRes, chRes, mbRes] = await Promise.all([
      fetch(`/api/v1/workspaces/${params.id}`).then((r) => r.json()),
      fetch(`/api/v1/workspaces/${params.id}/channels`).then((r) => r.json()),
      fetch(`/api/v1/workspaces/${params.id}/members`).then((r) => r.json()),
    ]);
    if (!wsRes.ok) {
      setError(wsRes.error ?? "Espace inaccessible");
      return;
    }
    setWorkspace(wsRes.workspace);
    const chans: Channel[] = chRes.channels ?? [];
    setChannels(chans);
    setMembers(mbRes.members ?? []);
    setActiveChannel((cur) =>
      cur && chans.some((c) => c.id === cur.id)
        ? chans.find((c) => c.id === cur.id)!
        : (chans.find((c) => c.type !== "voice") ?? null)
    );
  }, [params.id]);

  useEffect(() => {
    if (isAuthenticated) void loadAll();
  }, [isAuthenticated, loadAll]);

  // ── Référence fraîche du salon actif pour les handlers WS ──
  const activeChannelRef = useRef<Channel | null>(null);
  activeChannelRef.current = activeChannel;

  // ── Socket workspace : join/leave du salon actif ───────────
  useEffect(() => {
    if (!wsSocket || !activeChannel || activeChannel.type === "voice") return;
    wsSocket.emit("channel:join", { channelId: activeChannel.id }, () => {});
    return () => {
      wsSocket.emit("channel:leave", { channelId: activeChannel.id });
    };
  }, [wsSocket, wsConnected, activeChannel]);

  const can = (perm: string) =>
    workspace?.isOwner || (workspace?.myPermissions ?? []).includes(perm);

  if (error) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#0A0A0A] text-neutral-300">
        <p className="text-4xl">⛔</p>
        <p>{error}</p>
        <button
          onClick={() => router.push("/workspaces")}
          className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-bold text-white"
        >
          Mes espaces
        </button>
      </main>
    );
  }

  if (!workspace) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0A0A0A] text-neutral-400">
        Chargement de l'espace…
      </main>
    );
  }

  return (
    <main className="flex h-[calc(100vh-4rem)] bg-[#0A0A0A] text-white">
      {/* ═══ Colonne salons ═══ */}
      <aside className="flex w-60 shrink-0 flex-col border-r border-white/10 bg-[#0F0F0F]">
        <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3.5">
          <span className="text-xl">{workspace.icon ?? "🏢"}</span>
          <span className="min-w-0 flex-1 truncate font-bold">{workspace.name}</span>
          <InviteButton workspaceId={workspace.id} />
        </div>

        <ChannelList
          channels={channels}
          active={activeChannel}
          onSelect={setActiveChannel}
          canManage={can("MANAGE_CHANNELS")}
          onCreated={loadAll}
          workspaceId={workspace.id}
        />

        <VoiceDock
          socket={wsSocket}
          userId={user!.id}
          channels={channels}
          onStateChange={loadAll}
        />
      </aside>

      {/* ═══ Zone centrale ═══ */}
      <section className="flex min-w-0 flex-1 flex-col">
        {activeChannel ? (
          <ChannelView
            key={activeChannel.id}
            channel={activeChannel}
            workspace={workspace}
            socket={wsSocket}
            currentUserId={user!.id}
            canSend={
              activeChannel.type !== "voice" &&
              (can("SEND_MESSAGES") &&
                (activeChannel.type !== "announcement" || can("MANAGE_WORKSPACE")))
            }
          />
        ) : (
          <div className="flex flex-1 items-center justify-center text-neutral-500">
            Sélectionne un salon
          </div>
        )}
      </section>

      {/* ═══ Colonne membres ═══ */}
      <aside className="hidden w-56 shrink-0 border-l border-white/10 bg-[#0F0F0F] lg:block">
        <p className="border-b border-white/10 px-4 py-3.5 text-xs font-bold uppercase tracking-wider text-neutral-500">
          Membres — {members.length}
        </p>
        <div className="space-y-0.5 overflow-y-auto p-2">
          {members.map((m) => {
            const p = mergePresence(m.userId, null);
            const online = p.status === "online" || p.status === "away" || p.status === "dnd";
            return (
              <div key={m.id} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-white/5">
                <div className="relative">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-orange-500/40 to-emerald-500/40 text-xs font-bold text-white">
                    {initials(m.fullName)}
                  </div>
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#0F0F0F] ${
                      online ? "bg-emerald-500" : "bg-neutral-600"
                    }`}
                  />
                </div>
                <div className="min-w-0">
                  <p className={`truncate text-sm ${online ? "text-white" : "text-neutral-500"}`}>
                    {m.fullName}
                    {m.isOwner && <span className="ml-1 text-orange-400">👑</span>}
                  </p>
                  {m.roles[0] && (
                    <p className="text-[10px] text-neutral-500">{m.roles[0].name}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </aside>
    </main>
  );
}

// ─── Liste des salons ────────────────────────────────────────

function ChannelList(props: {
  channels: Channel[];
  active: Channel | null;
  onSelect: (c: Channel) => void;
  canManage: boolean;
  onCreated: () => void;
  workspaceId: string;
}) {
  const grouped = useMemo(() => {
    const byCat = new Map<string | null, Channel[]>();
    for (const c of props.channels) {
      const arr = byCat.get(c.categoryId) ?? [];
      arr.push(c);
      byCat.set(c.categoryId, arr);
    }
    return [...byCat.entries()];
  }, [props.channels]);

  const [creating, setCreating] = useState(false);

  async function createChannel(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const res = await fetch(`/api/v1/workspaces/${props.workspaceId}/channels`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        type: form.get("type"),
      }),
    });
    if (res.ok) {
      setCreating(false);
      props.onCreated();
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-2">
      {grouped.map(([catId, chans]) => (
        <div key={catId ?? "sans"} className="mb-3">
          <div className="mb-1 flex items-center justify-between px-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
              Salons
            </span>
            {props.canManage && (
              <button
                onClick={() => setCreating((v) => !v)}
                className="text-neutral-500 hover:text-white"
                title="Créer un salon"
              >
                +
              </button>
            )}
          </div>
          {chans.map((c) => (
            <button
              key={c.id}
              onClick={() => props.onSelect(c)}
              className={`mb-0.5 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm ${
                props.active?.id === c.id
                  ? "bg-orange-500/15 text-orange-200"
                  : "text-neutral-400 hover:bg-white/5 hover:text-neutral-200"
              }`}
            >
              <span className="w-4 text-center text-neutral-500">
                {CHANNEL_ICONS[c.type]}
              </span>
              <span className="truncate">{c.name}</span>
              {c.type === "voice" && c.voiceParticipants.length > 0 && (
                <span className="ml-auto rounded bg-emerald-500/20 px-1.5 text-[10px] font-bold text-emerald-300">
                  {c.voiceParticipants.length}
                </span>
              )}
            </button>
          ))}
          {/* participants vocaux */}
          {chans
            .filter((c) => c.type === "voice" && c.voiceParticipants.length > 0)
            .map((c) => (
              <div key={`vp-${c.id}`} className="ml-8 space-y-0.5">
                {c.voiceParticipants.map((p) => (
                  <div key={p.userId} className="flex items-center gap-1.5 text-xs text-neutral-500">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    {p.fullName} {p.muted && "🔇"}
                  </div>
                ))}
              </div>
            ))}
        </div>
      ))}

      {creating && (
        <form onSubmit={createChannel} className="space-y-2 px-2">
          <input
            name="name"
            required
            placeholder="nom-du-salon"
            className="w-full rounded-lg border border-white/10 bg-[#111] px-2.5 py-1.5 text-sm outline-none focus:border-orange-500"
          />
          <select
            name="type"
            className="w-full rounded-lg border border-white/10 bg-[#111] px-2.5 py-1.5 text-sm outline-none"
          >
            <option value="text">Texte</option>
            <option value="voice">Vocal</option>
            <option value="announcement">Annonces</option>
            <option value="forum">Forum</option>
          </select>
          <button className="w-full rounded-lg bg-emerald-500 py-1.5 text-xs font-bold">
            Créer
          </button>
        </form>
      )}
    </div>
  );
}

// ─── Vue d'un salon (messages) ───────────────────────────────

function ChannelView(props: {
  channel: Channel;
  workspace: WorkspaceDetail;
  socket: ReturnType<typeof useSocket>["socket"];
  currentUserId: string;
  canSend: boolean;
}) {
  const { channel, socket, currentUserId } = props;
  const [messages, setMessages] = useState<WsMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<WsMessage | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const typers = useTyping(socket, channel.id);

  const loadPage = useCallback(
    async (before?: string) => {
      const qs = before ? `?before=${encodeURIComponent(before)}` : "?limit=50";
      const res = await fetch(
        `/api/v1/workspaces/${props.workspace.id}/channels/${channel.id}/messages${qs}`
      );
      if (!res.ok) return null;
      return (await res.json()) as {
        ok: boolean;
        messages: WsMessage[];
        hasMore: boolean;
        nextBefore: string | null;
      };
    },
    [channel.id, props.workspace.id]
  );

  useEffect(() => {
    void loadPage().then((json) => {
      if (!json) return;
      setMessages(json.messages);
      setHasMore(json.hasMore);
      setNextBefore(json.nextBefore);
      setTimeout(() => bottomRef.current?.scrollIntoView(), 50);
    });
  }, [loadPage]);

  // Réception temps réel
  useEffect(() => {
    if (!socket) return;
    const onNew = (data: { message: WsMessage; channelId: string }) => {
      if (data.channelId !== channel.id) return;
      setMessages((prev) =>
        prev.some((m) => m.id === data.message.id) ? prev : [...prev, data.message]
      );
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 30);
    };
    const onUpdate = (data: { message: WsMessage; channelId: string }) => {
      if (data.channelId !== channel.id) return;
      setMessages((prev) =>
        prev.map((m) => (m.id === data.message.id ? { ...m, ...data.message } : m))
      );
    };
    const onDelete = (data: { messageId: string; channelId: string }) => {
      if (data.channelId !== channel.id) return;
      setMessages((prev) => prev.filter((m) => m.id !== data.messageId));
    };
    socket.on("message:new", onNew);
    socket.on("message:update", onUpdate);
    socket.on("message:delete", onDelete);
    return () => {
      socket.off("message:new", onNew);
      socket.off("message:update", onUpdate);
      socket.off("message:delete", onDelete);
    };
  }, [socket, channel.id]);

  async function loadOlder() {
    if (!nextBefore || loadingMore) return;
    setLoadingMore(true);
    const json = await loadPage(nextBefore);
    if (json) {
      setMessages((prev) => [...json.messages, ...prev]);
      setHasMore(json.hasMore);
      setNextBefore(json.nextBefore);
    }
    setLoadingMore(false);
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const content = draft.trim();
    if (!content) return;
    setDraft("");
    setReplyTo(null);
    socket?.emit("typing:stop", { channelId: channel.id });
    await fetch(
      `/api/v1/workspaces/${props.workspace.id}/channels/${channel.id}/messages`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content, replyToId: replyTo?.id ?? null }),
      }
    );
  }

  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function onType(v: string) {
    setDraft(v);
    if (!socket) return;
    socket.emit("typing:start", { channelId: channel.id });
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(
      () => socket.emit("typing:stop", { channelId: channel.id }),
      2500
    );
  }

  async function removeMessage(id: string) {
    await fetch(
      `/api/v1/workspaces/${props.workspace.id}/channels/${channel.id}/messages/${id}`,
      { method: "DELETE" }
    );
  }

  // Grouper les messages consécutifs d'un même auteur (Discord-like)
  const rendered = useMemo(() => {
    return messages.map((m, i) => {
      const prev = messages[i - 1];
      const sameAuthor =
        prev &&
        prev.authorId === m.authorId &&
        new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() < 5 * 60_000;
      return { ...m, compact: !!sameAuthor };
    });
  }, [messages]);

  return (
    <>
      <header className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
        <span className="text-neutral-500">{CHANNEL_ICONS[channel.type]}</span>
        <h2 className="font-bold">{channel.name}</h2>
        {channel.topic && (
          <p className="truncate border-l border-white/10 pl-3 text-xs text-neutral-500">
            {channel.topic}
          </p>
        )}
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {hasMore && (
          <button
            onClick={loadOlder}
            disabled={loadingMore}
            className="mx-auto mb-3 block rounded-lg border border-white/10 px-3 py-1 text-xs text-neutral-400 hover:bg-white/5"
          >
            {loadingMore ? "Chargement…" : "↑ Messages plus anciens"}
          </button>
        )}
        {messages.length === 0 && (
          <div className="mt-16 text-center text-neutral-500">
            <p className="text-4xl">💬</p>
            <p className="mt-2 text-sm">
              Bienvenue dans <b className="text-orange-300">#{channel.name}</b> —
              lance la conversation !
            </p>
          </div>
        )}
        {rendered.map((m) => (
          <div
            key={m.id}
            className={`group relative flex gap-3 rounded-lg px-2 py-0.5 hover:bg-white/[0.03] ${
              m.compact ? "mt-0.5" : "mt-4"
            }`}
          >
            {!m.compact ? (
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-500/40 to-emerald-500/40 text-xs font-bold">
                {initials(m.author?.fullName ?? "?")}
              </div>
            ) : (
              <div className="w-9 shrink-0 text-right text-[10px] leading-9 text-neutral-600 opacity-0 group-hover:opacity-100">
                {new Date(m.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
              </div>
            )}
            <div className="min-w-0 flex-1">
              {!m.compact && (
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-bold text-orange-200">
                    {m.author?.fullName ?? "Utilisateur"}
                  </span>
                  <span className="text-[10px] text-neutral-500">
                    {new Date(m.createdAt).toLocaleString("fr-FR", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              )}
              {m.replyTo && (
                <p className="mb-0.5 truncate border-l-2 border-orange-500/40 pl-2 text-xs text-neutral-500">
                  ↩ {m.replyTo.authorName} : {m.replyTo.content}
                </p>
              )}
              <p className="whitespace-pre-wrap break-words text-sm text-neutral-100">
                {m.content}
                {m.editedAt && (
                  <span className="ml-1 text-[10px] text-neutral-600">(modifié)</span>
                )}
              </p>
            </div>
            <div className="absolute -top-3 right-2 hidden gap-1 rounded-lg border border-white/10 bg-[#171717] px-1 py-0.5 shadow group-hover:flex">
              <button
                onClick={() => setReplyTo(m)}
                className="rounded px-1.5 py-0.5 text-xs text-neutral-300 hover:bg-white/10"
                title="Répondre"
              >
                ↩
              </button>
              {m.authorId === currentUserId && (
                <button
                  onClick={() => void removeMessage(m.id)}
                  className="rounded px-1.5 py-0.5 text-xs text-red-400 hover:bg-white/10"
                  title="Supprimer"
                >
                  🗑
                </button>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {typers.length > 0 && (
        <p className="px-4 text-xs italic text-orange-300/80">
          {typers.join(", ")} {typers.length === 1 ? "écrit…" : "écrivent…"}
        </p>
      )}

      <footer className="px-4 pb-4 pt-2">
        {replyTo && (
          <div className="mb-1 flex items-center justify-between rounded-t-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-neutral-400">
            <span className="truncate">
              Réponse à <b>{replyTo.author?.fullName}</b> : {replyTo.content}
            </span>
            <button onClick={() => setReplyTo(null)} className="text-neutral-500 hover:text-white">
              ✕
            </button>
          </div>
        )}
        {props.canSend ? (
          <form onSubmit={send}>
            <input
              value={draft}
              onChange={(e) => onType(e.target.value)}
              placeholder={`Envoyer un message dans ${CHANNEL_ICONS[channel.type]} ${channel.name}`}
              className="w-full rounded-xl border border-white/10 bg-[#161616] px-4 py-3 text-sm outline-none placeholder:text-neutral-600 focus:border-orange-500/50"
            />
          </form>
        ) : (
          <div className="rounded-xl border border-white/10 bg-[#161616] px-4 py-3 text-sm text-neutral-500">
            {channel.type === "announcement"
              ? "📢 Salon d'annonces — seuls les administrateurs publient."
              : channel.type === "voice"
                ? "🔊 Salon vocal — rejoins depuis la barre en bas."
                : "Tu n'as pas la permission d'écrire ici."}
          </div>
        )}
      </footer>
    </>
  );
}

// ─── Dock vocal (bas de colonne) ─────────────────────────────

function VoiceDock(props: {
  socket: ReturnType<typeof useSocket>["socket"];
  userId: string;
  channels: Channel[];
  onStateChange: () => void;
}) {
  const { socket, userId } = props;
  const [joined, setJoined] = useState<string | null>(null); // channelId
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const meshRef = useRef<RtcMesh | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<Map<string, HTMLAudioElement>>(new Map());

  const joinedChannel = props.channels.find((c) => c.id === joined) ?? null;
  const voiceChannels = props.channels.filter((c) => c.type === "voice");

  const stop = useCallback(() => {
    meshRef.current?.destroy();
    meshRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    for (const a of audioRef.current.values()) a.remove();
    audioRef.current.clear();
    setJoined(null);
    setMuted(false);
  }, []);

  // Signal entrant → maillage
  useEffect(() => {
    if (!socket || !joined) return;
    const onSignal = (p: { fromUserId: string; data: unknown }) => {
      void meshRef.current?.handleSignal(p.fromUserId, p.data);
    };
    const onState = (p: { channelId: string; participants: { userId: string }[] }) => {
      if (p.channelId !== joined) return;
      const mesh = meshRef.current;
      if (!mesh) return;
      const ids = p.participants.map((x) => x.userId).filter((x) => x !== userId);
      for (const pid of ids) void mesh.addPeer(pid);
      for (const existing of mesh.peerIds()) {
        if (!ids.includes(existing)) mesh.removePeer(existing);
      }
    };
    socket.on("voice:signal", onSignal);
    socket.on("voice:state", onState);
    return () => {
      socket.off("voice:signal", onSignal);
      socket.off("voice:state", onState);
    };
  }, [socket, joined, userId]);

  async function join(channelId: string) {
    if (!socket) return;
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mesh = new RtcMesh({
        myUserId: userId,
        localStream: stream,
        sendSignal: (target, data) =>
          socket.emit("voice:signal", { targetUserId: target, channelId, data }),
        onTrack: (peerId, remoteStream) => {
          let audio = audioRef.current.get(peerId);
          if (!audio) {
            audio = document.createElement("audio");
            audio.autoplay = true;
            audioRef.current.set(peerId, audio);
            document.body.appendChild(audio);
          }
          audio.srcObject = remoteStream;
        },
        onPeerLeft: (peerId) => {
          audioRef.current.get(peerId)?.remove();
          audioRef.current.delete(peerId);
        },
      });
      meshRef.current = mesh;
      socket.emit("channel:join", { channelId }, () => {
        socket.emit("voice:join", { channelId }, (res: { ok: boolean; error?: string }) => {
          if (!res?.ok) {
            setError(res?.error ?? "Connexion vocale impossible");
            stop();
          } else {
            setJoined(channelId);
          }
          props.onStateChange();
        });
      });
    } catch {
      setError("Micro inaccessible — autorise l'accès audio");
    }
  }

  function leave() {
    socket?.emit("voice:leave", {});
    stop();
    props.onStateChange();
  }

  function toggleMute() {
    const next = !muted;
    setMuted(next);
    streamRef.current?.getAudioTracks().forEach((t) => (t.enabled = !next));
    socket?.emit("voice:mute", { muted: next, deafened: false });
  }

  // Nettoyage au démontage
  useEffect(() => () => stop(), [stop]);

  return (
    <div className="border-t border-white/10 p-3">
      {joined && joinedChannel ? (
        <div className="space-y-2">
          <p className="flex items-center gap-2 text-xs font-bold text-emerald-300">
            <span className="relative flex h-2 w-2">
              <span className="absolute h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            {joinedChannel.name} — connecté
          </p>
          <div className="flex gap-2">
            <button
              onClick={toggleMute}
              className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-bold ${
                muted ? "bg-red-500/20 text-red-300" : "bg-white/5 text-neutral-200 hover:bg-white/10"
              }`}
            >
              {muted ? "🔇 Muet" : "🎙 Micro"}
            </button>
            <button
              onClick={leave}
              className="flex-1 rounded-lg bg-red-500/80 px-2 py-1.5 text-xs font-bold text-white hover:bg-red-500"
            >
              Quitter
            </button>
          </div>
        </div>
      ) : (
        voiceChannels.map((c) => (
          <button
            key={c.id}
            onClick={() => void join(c.id)}
            className="mb-1 flex w-full items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/15"
          >
            🔊 Rejoindre « {c.name} »
            {c.voiceParticipants.length > 0 && (
              <span className="ml-auto">{c.voiceParticipants.length} 👤</span>
            )}
          </button>
        ))
      )}
      {error && <p className="mt-1 text-[11px] text-red-400">{error}</p>}
    </div>
  );
}

// ─── Invitations ─────────────────────────────────────────────

function InviteButton({ workspaceId }: { workspaceId: string }) {
  const [invite, setInvite] = useState<{ code: string; inviteUrl: string } | null>(null);

  async function create() {
    const res = await fetch(`/api/v1/workspaces/${workspaceId}/invites`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ maxUses: 50 }),
    });
    const json = await res.json();
    if (res.ok) setInvite({ code: json.invite.code, inviteUrl: json.inviteUrl });
  }

  return (
    <div className="relative">
      <button
        onClick={create}
        title="Créer un lien d'invitation"
        className="rounded-lg border border-white/10 px-2 py-1 text-xs text-neutral-300 hover:bg-white/5"
      >
        🔗
      </button>
      {invite && (
        <div className="absolute right-0 top-8 z-20 w-64 rounded-xl border border-white/10 bg-[#171717] p-3 shadow-xl">
          <p className="text-xs font-bold text-neutral-300">Lien d'invitation</p>
          <p className="mt-1 select-all rounded-lg bg-black/40 px-2 py-1.5 font-mono text-sm tracking-widest text-orange-300">
            {invite.code}
          </p>
          <button
            onClick={() => {
              void navigator.clipboard.writeText(
                `${window.location.origin}${invite.inviteUrl}`
              );
            }}
            className="mt-2 w-full rounded-lg bg-orange-500 px-2 py-1.5 text-xs font-bold text-white hover:bg-orange-400"
          >
            Copier le lien
          </button>
          <button
            onClick={() => setInvite(null)}
            className="mt-1 w-full py-1 text-[10px] text-neutral-500 hover:text-white"
          >
            Fermer
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Utilitaires ─────────────────────────────────────────────

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
