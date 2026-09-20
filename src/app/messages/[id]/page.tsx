// ============================================================
// PAGE — Fil de conversation (WhatsApp-like)
// Bulles · accusés ✓/✓✓/bleu · réactions emoji (20 max)
// réponses citées · typing · messages vocaux · pièces jointes
// appels audio/vidéo WebRTC (signalisation socket.io).
// ============================================================

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/context";
import {
  usePresenceHeartbeat,
  usePresenceUpdates,
  useSocket,
  useTyping,
} from "@/lib/realtime/hooks";
import { RtcMesh } from "@/lib/realtime/rtc-mesh";
import { VoiceRecorder, type VoiceRecording } from "@/components/chat/VoiceRecorder";

// ─── Types ───────────────────────────────────────────────────

interface Attachment {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
  durationSeconds: number | null;
}

interface Reaction {
  emoji: string;
  count: number;
  reacted: boolean;
}

interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  type: "text" | "image" | "file" | "audio" | "video";
  content: string | null;
  replyToId: string | null;
  replyTo?: {
    id: string;
    senderName: string;
    type: string;
    content: string | null;
  } | null;
  editedAt: string | null;
  createdAt: string;
  author?: { id: string; fullName: string; avatarUrl: string | null } | null;
  attachments: Attachment[];
  reactions: Reaction[];
  delivery?: "sent" | "delivered" | "read";
  clientRef?: string | null;
}

interface MemberInfo {
  userId: string;
  fullName: string;
  avatarUrl: string | null;
  role: "admin" | "member";
  presence: { status: string; lastSeenAt: string | null } | null;
}

interface ConversationInfo {
  id: string;
  type: "direct" | "group";
  name: string | null;
  avatarUrl: string | null;
}

const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🔥", "🎉", "🙏"];

// ─── Page ────────────────────────────────────────────────────

export default function ConversationPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuth();
  const cid = params.id;

  const [conversation, setConversation] = useState<ConversationInfo | null>(null);
  const [members, setMembers] = useState<MemberInfo[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [peerReadAt, setPeerReadAt] = useState<Date | null>(null);

  const { socket } = useSocket("/chat", isAuthenticated);
  usePresenceHeartbeat(socket);
  const { merge: mergePresence } = usePresenceUpdates(socket);
  const typers = useTyping(socket, cid);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace("/auth/login");
  }, [isLoading, isAuthenticated, router]);

  // ── Chargement ──
  const loadDetail = useCallback(async () => {
    const res = await fetch(`/api/v1/chat/conversations/${cid}`);
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Conversation inaccessible");
      return;
    }
    setConversation(json.conversation);
    setMembers(json.members);
  }, [cid]);

  const loadMessages = useCallback(
    async (before?: string) => {
      const qs = before ? `?before=${encodeURIComponent(before)}` : "?limit=50";
      const res = await fetch(`/api/v1/chat/conversations/${cid}/messages${qs}`);
      if (!res.ok) return null;
      return (await res.json()) as {
        ok: boolean;
        messages: ChatMessage[];
        hasMore: boolean;
        nextBefore: string | null;
      };
    },
    [cid]
  );

  useEffect(() => {
    if (!isAuthenticated) return;
    void loadDetail();
    void loadMessages().then((json) => {
      if (!json) return;
      setMessages(json.messages);
      setHasMore(json.hasMore);
      setNextBefore(json.nextBefore);
    });
  }, [isAuthenticated, loadDetail, loadMessages]);

  // ── Room + marquage lu ──
  const markRead = useCallback(() => {
    void fetch(`/api/v1/chat/conversations/${cid}/read`, { method: "POST" });
  }, [cid]);

  useEffect(() => {
    if (!socket) return;
    socket.emit("conversation:join", { conversationId: cid }, () => {});
    markRead();
    return () => {
      socket.emit("conversation:leave", { conversationId: cid });
    };
  }, [socket, cid, markRead]);

  // ── Événements temps réel ──
  useEffect(() => {
    if (!socket) return;

    const onNew = (data: { message: ChatMessage; conversationId: string }) => {
      if (data.conversationId !== cid) return;
      setMessages((prev) =>
        prev.some((m) => m.id === data.message.id)
          ? prev
          : [
              ...prev,
              {
                ...data.message,
                attachments: data.message.attachments ?? [],
                reactions: data.message.reactions ?? [],
              },
            ]
      );
      if (document.visibilityState === "visible") markRead();
    };
    const onUpdate = (data: { message: ChatMessage; conversationId: string }) => {
      if (data.conversationId !== cid) return;
      setMessages((prev) =>
        prev.map((m) => (m.id === data.message.id ? { ...m, ...data.message } : m))
      );
    };
    const onDelete = (data: { messageId: string; conversationId: string }) => {
      if (data.conversationId !== cid) return;
      setMessages((prev) => prev.filter((m) => m.id !== data.messageId));
    };
    const onReaction = (data: { messageId: string; conversationId: string; reactions: Reaction[] }) => {
      if (data.conversationId !== cid) return;
      setMessages((prev) =>
        prev.map((m) => (m.id === data.messageId ? { ...m, reactions: data.reactions } : m))
      );
    };
    const onRead = (data: { conversationId: string; userId: string; lastReadMessageId: string }) => {
      if (data.conversationId !== cid || !user || data.userId === user.id) return;
      setPeerReadAt(new Date());
    };

    socket.on("message:new", onNew);
    socket.on("message:update", onUpdate);
    socket.on("message:delete", onDelete);
    socket.on("reaction:update", onReaction);
    socket.on("message:read", onRead);
    return () => {
      socket.off("message:new", onNew);
      socket.off("message:update", onUpdate);
      socket.off("message:delete", onDelete);
      socket.off("reaction:update", onReaction);
      socket.off("message:read", onRead);
    };
  }, [socket, cid, user, markRead]);

  // ── Infos dérivées ──
  const peer = conversation?.type === "direct"
    ? members.find((m) => m.userId !== user?.id) ?? null
    : null;
  const title = conversation?.type === "group"
    ? (conversation?.name ?? "Groupe")
    : (peer?.fullName ?? "Conversation");
  const peerPresence = peer ? mergePresence(peer.userId, peer.presence as never) : null;

  if (error) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#0A0A0A] text-neutral-300">
        <p className="text-4xl">⛔</p>
        <p>{error}</p>
        <Link href="/messages" className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-bold text-white">
          Mes messages
        </Link>
      </main>
    );
  }

  if (!conversation || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0A0A0A] text-neutral-400">
        Chargement…
      </main>
    );
  }

  return (
    <main className="flex h-[calc(100vh-4rem)] flex-col bg-[#0A0A0A] text-white">
      {/* ═══ En-tête ═══ */}
      <header className="flex items-center gap-3 border-b border-white/10 bg-[#0F0F0F] px-4 py-3">
        <Link href="/messages" className="text-neutral-400 hover:text-white" title="Retour">
          ←
        </Link>
        <div className="relative">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-orange-500/40 to-emerald-500/40 text-sm font-bold">
            {initials(title)}
          </div>
          {conversation.type === "direct" && (
            <span
              className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#0F0F0F] ${
                peerPresence?.status === "online" ? "bg-emerald-500" : "bg-neutral-600"
              }`}
            />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-bold">
            {conversation.type === "group" ? "👥 " : ""}
            {title}
          </h1>
          <p className="truncate text-xs text-neutral-400">
            {typers.length > 0
              ? `${typers.join(", ")} écrit…`
              : conversation.type === "direct" && peerPresence
                ? peerPresence.status === "online"
                  ? "en ligne"
                  : formatLastSeen(peerPresence.lastSeenAt)
                : conversation.type === "group"
                  ? `${members.length} membres`
                  : ""}
          </p>
        </div>
        {conversation.type === "direct" && peer && (
          <CallButtons
            conversationId={cid}
            peerId={peer.userId}
            peerName={peer.fullName}
            userId={user.id}
            socket={socket}
          />
        )}
      </header>

      {/* ═══ Messages ═══ */}
      <Thread
        messages={messages}
        setMessages={setMessages}
        hasMore={hasMore}
        nextBefore={nextBefore}
        loadMessages={loadMessages}
        setPaging={(h: boolean, b: string | null) => { setHasMore(h); setNextBefore(b); }}
        userId={user.id}
        conversationId={cid}
        peerReadAt={peerReadAt}
        isGroup={conversation.type === "group"}
      />

      {/* typing bubble */}
      {typers.length > 0 && (
        <div className="px-4 pb-1">
          <span className="inline-flex items-center gap-1.5 rounded-2xl rounded-bl-sm bg-[#1B1B1B] px-4 py-2.5">
            <Dot /> <Dot delay={0.15} /> <Dot delay={0.3} />
          </span>
        </div>
      )}

      {/* ═══ Rédaction ═══ */}
      <Composer conversationId={cid} socket={socket} />
    </main>
  );
}

// ─── Fil de messages ─────────────────────────────────────────

function Thread(props: {
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  hasMore: boolean;
  nextBefore: string | null;
  loadMessages: (before?: string) => Promise<{ ok: boolean; messages: ChatMessage[]; hasMore: boolean; nextBefore: string | null } | null>;
  setPaging: (hasMore: boolean, nextBefore: string | null) => void;
  userId: string;
  conversationId: string;
  peerReadAt: Date | null;
  isGroup: boolean;
}) {
  const { messages, userId, peerReadAt } = props;
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastCount = useRef(0);

  useEffect(() => {
    if (messages.length > lastCount.current) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 30);
    }
    lastCount.current = messages.length;
  }, [messages.length]);

  async function loadOlder() {
    if (!props.nextBefore) return;
    const json = await props.loadMessages(props.nextBefore);
    if (json) {
      props.setMessages((prev) => [...json.messages, ...prev]);
      props.setPaging(json.hasMore, json.nextBefore);
    }
  }

  async function toggleReaction(m: ChatMessage, emoji: string) {
    // Optimiste
    props.setMessages((prev) =>
      prev.map((x) => {
        if (x.id !== m.id) return x;
        const existing = x.reactions.find((r) => r.emoji === emoji);
        if (existing) {
          const mine = existing.reacted;
          const list = mine
            ? existing.count - 1 === 0
              ? x.reactions.filter((r) => r.emoji !== emoji)
              : x.reactions.map((r) =>
                  r.emoji === emoji ? { ...r, count: r.count - 1, reacted: false } : r
                )
            : x.reactions.map((r) =>
                r.emoji === emoji ? { ...r, count: r.count + 1, reacted: true } : r
              );
          return { ...x, reactions: list };
        }
        return { ...x, reactions: [...x.reactions, { emoji, count: 1, reacted: true }] };
      })
    );
    await fetch(
      `/api/v1/chat/conversations/${props.conversationId}/messages/${m.id}/reactions`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ emoji }),
      }
    );
  }

  const withDays = useMemo(() => groupByDay(messages), [messages]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4" style={{ background: "radial-gradient(circle at 30% 20%, rgba(249,115,22,0.04), transparent 40%)" }}>
      {props.hasMore && (
        <button
          onClick={loadOlder}
          className="mx-auto mb-4 block rounded-lg border border-white/10 px-3 py-1 text-xs text-neutral-400 hover:bg-white/5"
        >
          ↑ Charger plus
        </button>
      )}
      {messages.length === 0 && (
        <div className="mt-20 text-center text-neutral-500">
          <p className="text-4xl">👋</p>
          <p className="mt-2 text-sm">Dis bonjour pour commencer !</p>
        </div>
      )}
      {withDays.map(({ day, items }) => (
        <div key={day}>
          <div className="my-4 text-center">
            <span className="rounded-full border border-white/10 bg-[#141414] px-3 py-1 text-[11px] text-neutral-500">
              {day}
            </span>
          </div>
          {items.map((m) => {
            const mine = m.senderId === userId;
            const delivery = mine
              ? peerReadAt && new Date(m.createdAt) <= peerReadAt
                ? "read"
                : (m.delivery ?? "sent")
              : undefined;
            return (
              <Bubble
                key={m.id}
                message={m}
                mine={mine}
                delivery={delivery}
                showAuthor={props.isGroup && !mine}
                onReply={() => setReplyForComposer(m)}
                onReact={(emoji) => void toggleReaction(m, emoji)}
              />
            );
          })}
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}

// Petit pont DOM : déposer la réponse dans le Composer via CustomEvent
function setReplyForComposer(m: ChatMessage) {
  window.dispatchEvent(new CustomEvent("chat:set-reply", { detail: m }));
}

function Bubble(props: {
  message: ChatMessage;
  mine: boolean;
  delivery?: "sent" | "delivered" | "read";
  showAuthor: boolean;
  onReply: () => void;
  onReact: (emoji: string) => void;
}) {
  const { message: m, mine } = props;
  const [picker, setPicker] = useState(false);

  return (
    <div className={`group mb-1.5 flex ${mine ? "justify-end" : "justify-start"}`}>
      <div className={`relative max-w-[78%] sm:max-w-[65%] ${mine ? "order-2" : ""}`}>
        <div
          className={`rounded-2xl px-3.5 py-2 text-sm shadow ${
            mine
              ? "rounded-br-sm bg-orange-600 text-white"
              : "rounded-bl-sm bg-[#1F1F1F] text-neutral-100"
          }`}
        >
          {props.showAuthor && m.author && (
            <p className="mb-0.5 text-xs font-bold text-emerald-300">{m.author.fullName}</p>
          )}
          {m.replyTo && (
            <div className={`mb-1 rounded-lg border-l-2 px-2 py-1 text-xs ${mine ? "border-white/40 bg-white/10" : "border-orange-500/50 bg-black/20"}`}>
              <b>{m.replyTo.senderName}</b> — {m.replyTo.content ?? m.replyTo.type}
            </div>
          )}

          {/* Attachments */}
          {m.attachments.map((a) => (
            <AttachmentView key={a.id} a={a} mine={mine} />
          ))}

          {m.content && <p className="whitespace-pre-wrap break-words leading-snug">{m.content}</p>}

          <span className={`mt-0.5 flex items-center justify-end gap-1 text-[10px] ${mine ? "text-orange-100/70" : "text-neutral-500"}`}>
            {m.editedAt && "modifié · "}
            {new Date(m.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
            {props.delivery === "sent" && <span aria-label="envoyé">✓</span>}
            {props.delivery === "delivered" && <span aria-label="livré">✓✓</span>}
            {props.delivery === "read" && <span className="text-sky-300" aria-label="lu">✓✓</span>}
          </span>
        </div>

        {/* Réactions affichées */}
        {m.reactions.length > 0 && (
          <div className={`mt-1 flex flex-wrap gap-1 ${mine ? "justify-end" : ""}`}>
            {m.reactions.map((r) => (
              <button
                key={r.emoji}
                onClick={() => props.onReact(r.emoji)}
                className={`rounded-full border px-2 py-0.5 text-xs ${
                  r.reacted
                    ? "border-orange-500/50 bg-orange-500/20"
                    : "border-white/10 bg-white/5"
                }`}
              >
                {r.emoji} {r.count}
              </button>
            ))}
          </div>
        )}

        {/* Actions au survol */}
        <div className={`absolute -top-3 z-10 hidden gap-1 group-hover:flex ${mine ? "-left-20 flex-row-reverse" : "-right-20"}`}>
          <div className="flex rounded-lg border border-white/10 bg-[#171717] shadow">
            <button onClick={() => setPicker((v) => !v)} className="px-2 py-1 text-sm hover:scale-110" title="Réagir">
              😊
            </button>
            <button onClick={props.onReply} className="px-2 py-1 text-sm hover:scale-110" title="Répondre">
              ↩
            </button>
          </div>
        </div>

        {/* Picker d'emojis */}
        {picker && (
          <div className={`absolute top-8 z-20 flex gap-1 rounded-xl border border-white/10 bg-[#171717] p-2 shadow-xl ${mine ? "right-0" : "left-0"}`}>
            {QUICK_EMOJIS.map((e) => (
              <button
                key={e}
                onClick={() => { setPicker(false); props.onReact(e); }}
                className="rounded-lg px-1.5 py-1 text-lg hover:scale-125"
              >
                {e}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AttachmentView({ a, mine }: { a: Attachment; mine: boolean }) {
  if (a.mimeType.startsWith("image/")) {
    return (
      <a href={a.url} target="_blank" rel="noreferrer" className="mb-1 block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={a.url}
          alt={a.fileName}
          className="max-h-64 rounded-xl object-cover"
          loading="lazy"
        />
      </a>
    );
  }
  if (a.mimeType.startsWith("audio/")) {
    return (
      <div className="mb-1 min-w-[220px]">
        <audio controls preload="metadata" src={a.url} className="h-10 w-full" />
        {a.durationSeconds && (
          <p className={`text-[10px] ${mine ? "text-orange-100/60" : "text-neutral-500"}`}>
            🎙 {a.durationSeconds}s
          </p>
        )}
      </div>
    );
  }
  if (a.mimeType.startsWith("video/")) {
    return <video controls preload="metadata" src={a.url} className="mb-1 max-h-64 rounded-xl" />;
  }
  return (
    <a
      href={a.url}
      download
      className={`mb-1 flex items-center gap-2 rounded-xl border px-3 py-2 text-xs ${
        mine ? "border-white/20 bg-white/10" : "border-white/10 bg-black/20"
      }`}
    >
      📎 <span className="truncate font-semibold">{a.fileName}</span>
      <span className="opacity-60">({formatSize(a.sizeBytes)})</span>
    </a>
  );
}

// ─── Rédaction ───────────────────────────────────────────────

function Composer(props: {
  conversationId: string;
  socket: ReturnType<typeof useSocket>["socket"];
}) {
  const { socket } = props;
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<ChatMessage>).detail;
      setReplyTo(detail);
    };
    window.addEventListener("chat:set-reply", handler);
    return () => window.removeEventListener("chat:set-reply", handler);
  }, []);

  function onType(v: string) {
    setDraft(v);
    socket?.emit("typing:start", { conversationId: props.conversationId });
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(
      () => socket?.emit("typing:stop", { conversationId: props.conversationId }),
      2500
    );
  }

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    const content = draft.trim();
    if (!content || busy) return;
    setBusy(true);
    setDraft("");
    const reply = replyTo;
    setReplyTo(null);
    socket?.emit("typing:stop", { conversationId: props.conversationId });
    await fetch(`/api/v1/chat/conversations/${props.conversationId}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content, replyToId: reply?.id ?? null }),
    });
    setBusy(false);
  }

  async function sendFile(file: File) {
    setBusy(true);
    const base64 = await fileToBase64(file);
    const isImage = file.type.startsWith("image/");
    await fetch(`/api/v1/chat/conversations/${props.conversationId}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: isImage ? "image" : "file",
        content: draft.trim() || null,
        replyToId: replyTo?.id ?? null,
        attachments: [
          { fileName: file.name, mimeType: file.type || "application/octet-stream", dataBase64: base64 },
        ],
      }),
    });
    setDraft("");
    setReplyTo(null);
    setBusy(false);
  }

  async function sendVoice(rec: VoiceRecording) {
    setRecording(false);
    await fetch(`/api/v1/chat/conversations/${props.conversationId}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: "audio",
        replyToId: replyTo?.id ?? null,
        attachments: [rec],
      }),
    });
    setReplyTo(null);
  }

  return (
    <footer className="border-t border-white/10 bg-[#0F0F0F] px-4 py-3">
      {replyTo && (
        <div className="mb-2 flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-neutral-400">
          <span className="truncate">
            Réponse à <b className="text-orange-300">{replyTo.author?.fullName ?? "message"}</b> : {replyTo.content ?? replyTo.type}
          </span>
          <button onClick={() => setReplyTo(null)} className="ml-2 text-neutral-500 hover:text-white">✕</button>
        </div>
      )}

      {recording ? (
        <VoiceRecorder onReady={sendVoice} onCancel={() => setRecording(false)} />
      ) : (
        <form onSubmit={send} className="flex items-end gap-2">
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void sendFile(f);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-neutral-300 hover:bg-white/10"
            title="Joindre un fichier"
          >
            📎
          </button>
          <textarea
            value={draft}
            onChange={(e) => onType(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            rows={1}
            placeholder="Écris un message…"
            className="max-h-32 flex-1 resize-none rounded-xl border border-white/10 bg-[#161616] px-4 py-2.5 text-sm outline-none placeholder:text-neutral-600 focus:border-orange-500/50"
          />
          {draft.trim() ? (
            <button
              disabled={busy}
              className="rounded-xl bg-orange-500 px-4 py-2.5 font-bold text-white shadow-lg shadow-orange-500/30 hover:bg-orange-400 disabled:opacity-50"
              aria-label="Envoyer"
            >
              ➤
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setRecording(true)}
              className="rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 hover:bg-white/10"
              title="Message vocal"
            >
              🎙
            </button>
          )}
        </form>
      )}
    </footer>
  );
}

// ─── Appels (boutons + overlay) ──────────────────────────────

interface ActiveCall {
  id: string;
  type: "audio" | "video";
  direction: "outgoing" | "incoming";
  status: "ringing" | "ongoing";
}

function CallButtons(props: {
  conversationId: string;
  peerId: string;
  peerName: string;
  userId: string;
  socket: ReturnType<typeof useSocket>["socket"];
}) {
  const { socket, userId, peerId } = props;
  const [incoming, setIncoming] = useState<{ callId: string; type: "audio" | "video" } | null>(null);
  const [call, setCall] = useState<ActiveCall | null>(null);
  const [muted, setMuted] = useState(false);
  const meshRef = useRef<RtcMesh | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const remoteMediaRef = useRef<HTMLDivElement>(null);

  // Entrée d'appel + fin
  useEffect(() => {
    if (!socket) return;
    const onIncoming = (p: { call: { id: string; type: "audio" | "video" }; conversationId: string }) => {
      if (p.conversationId !== props.conversationId) return;
      setIncoming({ callId: p.call.id, type: p.call.type });
    };
    const onEnded = (p: { callId: string }) => {
      if (call?.id === p.callId) stopAll();
      if (incoming?.callId === p.callId) setIncoming(null);
    };
    const onJoined = (p: { callId: string; userId: string }) => {
      if (call?.id === p.callId) {
        setCall((c) => (c ? { ...c, status: "ongoing" } : c));
        void meshRef.current?.addPeer(p.userId);
      }
    };
    const onSignal = (p: { fromUserId: string; callId: string | null; data: unknown }) => {
      if (!call || p.callId !== call.id) return;
      void meshRef.current?.handleSignal(p.fromUserId, p.data);
    };
    socket.on("call:incoming", onIncoming);
    socket.on("call:ended", onEnded);
    socket.on("call:joined", onJoined);
    socket.on("call:signal", onSignal);
    return () => {
      socket.off("call:incoming", onIncoming);
      socket.off("call:ended", onEnded);
      socket.off("call:joined", onJoined);
      socket.off("call:signal", onSignal);
    };
  }, [socket, call?.id, incoming?.callId, props.conversationId]);

  const stopAll = useCallback(() => {
    meshRef.current?.destroy();
    meshRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCall(null);
    setIncoming(null);
    setMuted(false);
    if (remoteMediaRef.current) remoteMediaRef.current.innerHTML = "";
  }, [socket]);

  async function startMedia(type: "audio" | "video", callId: string) {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: type === "video",
    });
    streamRef.current = stream;
    meshRef.current = new RtcMesh({
      myUserId: userId,
      localStream: stream,
      sendSignal: (target, data) =>
        socket?.emit("call:signal", { targetUserId: target, callId, data }),
      onTrack: (pid, remoteStream) => {
        if (!remoteMediaRef.current) return;
        remoteMediaRef.current.innerHTML = "";
        const el = document.createElement(type === "video" ? "video" : "audio");
        el.autoplay = true;
        el.srcObject = remoteStream;
        if (type === "video") el.className = "h-full w-full rounded-xl object-cover";
        remoteMediaRef.current.appendChild(el);
      },
      onPeerLeft: () => {
        if (remoteMediaRef.current) remoteMediaRef.current.innerHTML = "";
      },
    });
  }

  async function start(type: "audio" | "video") {
    const res = await fetch(`/api/v1/chat/conversations/${props.conversationId}/calls`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type }),
    });
    const json = await res.json();
    if (!res.ok) return alert(json.error ?? "Appel impossible");
    try {
      await startMedia(type, json.call.id);
      setCall({ id: json.call.id, type, direction: "outgoing", status: "ringing" });
    } catch {
      alert("Micro/caméra inaccessible");
      await fetch(`/api/v1/chat/calls/${json.call.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "end" }),
      });
    }
  }

  async function accept() {
    if (!incoming) return;
    await fetch(`/api/v1/chat/calls/${incoming.callId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "join" }),
    });
    try {
      await startMedia(incoming.type, incoming.callId);
      setCall({
        id: incoming.callId,
        type: incoming.type,
        direction: "incoming",
        status: "ongoing",
      });
      void meshRef.current?.addPeer(peerId);
    } catch {
      alert("Micro/caméra inaccessible");
    }
    setIncoming(null);
  }

  async function decline() {
    if (!incoming) return;
    await fetch(`/api/v1/chat/calls/${incoming.callId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "decline" }),
    });
    setIncoming(null);
  }

  async function hangup() {
    if (!call) return;
    await fetch(`/api/v1/chat/calls/${call.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: call.status === "ringing" ? "end" : "leave" }),
    });
    stopAll();
  }

  function toggleMute() {
    const next = !muted;
    setMuted(next);
    streamRef.current?.getAudioTracks().forEach((t) => (t.enabled = !next));
  }

  return (
    <>
      <button
        onClick={() => void start("audio")}
        className="rounded-xl border border-white/10 px-3 py-2 text-neutral-200 hover:bg-white/5"
        title="Appel audio"
      >
        📞
      </button>
      <button
        onClick={() => void start("video")}
        className="rounded-xl border border-white/10 px-3 py-2 text-neutral-200 hover:bg-white/5"
        title="Appel vidéo"
      >
        🎥
      </button>

      {/* Appel entrant */}
      {incoming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
          <div className="w-72 rounded-3xl border border-white/10 bg-[#141414] p-6 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-orange-500/40 to-emerald-500/40 text-2xl">
              📞
            </div>
            <p className="mt-3 font-bold">{props.peerName}</p>
            <p className="text-sm text-neutral-400">
              Appel {incoming.type === "video" ? "vidéo" : "audio"} entrant…
            </p>
            <div className="mt-5 flex justify-center gap-4">
              <button onClick={decline} className="h-12 w-12 rounded-full bg-red-500 text-lg text-white">✕</button>
              <button onClick={accept} className="h-12 w-12 animate-pulse rounded-full bg-emerald-500 text-lg text-white">
                {incoming.type === "video" ? "🎥" : "📞"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Appel en cours */}
      {call && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85">
          <div className="flex w-full max-w-lg flex-col rounded-3xl border border-white/10 bg-[#101010] p-6">
            <p className="text-center text-sm text-neutral-400">
              {call.status === "ringing" ? "Sonnerie…" : "En ligne"} · {call.type === "video" ? "Vidéo" : "Audio"}
            </p>
            <div className="mt-4 h-72 overflow-hidden rounded-2xl bg-black/60">
              {call.type === "video" ? (
                <div ref={remoteMediaRef} className="flex h-full items-center justify-center text-neutral-600">
                  {call.status === "ringing" ? "⌛" : ""}
                </div>
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-3">
                  <div className={`flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-orange-500/40 to-emerald-500/40 text-2xl ${call.status === "ongoing" ? "animate-pulse" : ""}`}>
                    📞
                  </div>
                  <p className="text-neutral-400">{props.peerName}</p>
                  <div ref={remoteMediaRef} />
                </div>
              )}
            </div>
            <div className="mt-5 flex justify-center gap-4">
              <button
                onClick={toggleMute}
                className={`h-12 w-12 rounded-full text-lg ${muted ? "bg-white/20" : "bg-white/10"} text-white`}
                title="Micro on/off"
              >
                {muted ? "🔇" : "🎙"}
              </button>
              <button onClick={() => void hangup()} className="h-12 w-12 rounded-full bg-red-500 text-lg text-white" title="Raccrocher">
                ✕
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Utilitaires ─────────────────────────────────────────────

function groupByDay(messages: ChatMessage[]) {
  const groups: { day: string; items: ChatMessage[] }[] = [];
  for (const m of messages) {
    const d = new Date(m.createdAt);
    const today = new Date();
    const yesterday = new Date(Date.now() - 86400_000);
    const day =
      d.toDateString() === today.toDateString()
        ? "Aujourd'hui"
        : d.toDateString() === yesterday.toDateString()
          ? "Hier"
          : d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.items.push(m);
    else groups.push({ day, items: [m] });
  }
  return groups;
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/** Fichier → base64 (chunked pour éviter les dépassements de pile). */
function fileToBase64(file: File): Promise<string> {
  return file.arrayBuffer().then((buffer) => {
    let binary = "";
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.length; i += 8192) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    }
    return btoa(binary);
  });
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function formatLastSeen(lastSeenAt: string | null): string {
  if (!lastSeenAt) return "hors ligne";
  const d = new Date(lastSeenAt);
  const today = new Date();
  const time = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  if (d.toDateString() === today.toDateString()) return `vu à ${time}`;
  return `vu le ${d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} à ${time}`;
}

function Dot({ delay = 0 }: { delay?: number }) {
  return (
    <span
      className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-400"
      style={{ animationDelay: `${delay}s` }}
    />
  );
}
