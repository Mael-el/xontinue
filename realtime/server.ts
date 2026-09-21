// ============================================================
// SERVEUR TEMPS RÉEL — socket.io dédié (namespaces /workspace
// et /chat) tournant dans son propre processus (tsx).
//
// ┌─────────────────┐  HTTP /internal (loopback) ┌───────────┐
// │  Next.js routes │ ─────────────────────────▶ │ CE SERVEUR │
// │  (REST v1)      │   emit / presence          │ port 3001  │
// └─────────────────┘                            │  socket.io │
//        navigateurs ───────WS (JWT)────────────▶│  /workspace│
//                                                │  /chat     │
//                                                └───────────┘
//
// Événements Workspace : channel:join/leave, message:send,
//   typing:start/stop, voice:join/leave/signal (relais WebRTC),
//   → message:new, message:update/delete (via REST), typing:update,
//     voice:state.
// Événements Chat : conversation:join/leave, message:send,
//   typing:start/stop, presence:heartbeat, call:signal (relais),
//   → message:new/update/delete/read, reaction:update,
//     presence:update, call:incoming/joined/left/ended (via REST).
// Démarrage : npm run realtime
// ============================================================

import "./env"; // ⚠️ EN PREMIER — peuple process.env avant les imports ci-dessous

import http from "node:http";
import { Server, type Socket } from "socket.io";
import { db } from "@/db";
import {
  users,
  workspaceChannels,
  workspaceVoiceStates,
} from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { verifyToken, type AuthPayload } from "@/lib/auth/jwt";
import {
  getMembership as getWsMembership,
  getPermissionMask,
  getWorkspaceOr404,
  sendWorkspaceMessage,
} from "@/lib/workspaces/service";
import {
  hasPermission,
  WS_PERMISSIONS,
} from "@/lib/workspaces/permissions";
import {
  getMembership as getChatMembership,
  sendChatMessage,
} from "@/lib/chat/service";
import {
  PRESENCE_TTL_MS,
  persistLastSeen,
  type PresenceStatus,
} from "@/lib/chat/presence";

// ------------------------------------------------------------
// CONFIG
// ------------------------------------------------------------

const PORT = Number(process.env.REALTIME_PORT ?? 3001);
const EMIT_SECRET = process.env.REALTIME_EMIT_SECRET ?? "dev-realtime-secret-change-me";

if (
  process.env.NODE_ENV === "production" &&
  EMIT_SECRET === "dev-realtime-secret-change-me"
) {
  console.warn(
    "⚠️  REALTIME_EMIT_SECRET utilise la valeur de développement — définis-la en production."
  );
}

// ------------------------------------------------------------
// MÉMOIRE DU SERVEUR : présence + voix + cache noms
// ------------------------------------------------------------

/** Sockets connectés par utilisateur (namespace /chat). */
const chatSockets = new Map<string, Set<string>>();
/** Statut en ligne déclaré (TTL 120 s, refresh heartbeat 30 s). */
const online = new Map<string, { status: PresenceStatus; expiresAt: number }>();

/** États vocaux : channelId → userId → { muted, deafened }. */
const voiceStates = new Map<string, Map<string, { muted: boolean; deafened: boolean }>>();

/** Cache userId → nom affiché (évite une requête par événement typing). */
const nameCache = new Map<string, { name: string; until: number }>();

async function getUserName(userId: string): Promise<string> {
  const cached = nameCache.get(userId);
  if (cached && cached.until > Date.now()) return cached.name;
  const [u] = await db
    .select({ fullName: users.fullName })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const name = u?.fullName ?? "Utilisateur";
  nameCache.set(userId, { name, until: Date.now() + 60_000 });
  return name;
}

// ------------------------------------------------------------
// HTTP INTERNE : pont pour les Route Handlers Next
// ------------------------------------------------------------

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (c) => {
      body += c;
      if (body.length > 1_000_000) req.socket.destroy();
    });
    req.on("end", () => resolve(body));
  });
}

const httpServer = http.createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");

  // Santé (diagnostic rapide)
  if (url.pathname === "/healthz") {
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ ok: true, service: "realtime" }));
    return;
  }

  // API interne : POST only, loopback + secret partagé
  if (url.pathname.startsWith("/internal/")) {
    const auth = req.headers.authorization ?? "";
    if (auth !== `Bearer ${EMIT_SECRET}`) {
      res.statusCode = 401;
      res.end(JSON.stringify({ error: "unauthorized" }));
      return;
    }
    void (async () => {
      const body = JSON.parse((await readBody(req)) || "{}") as Record<string, unknown>;
      res.setHeader("content-type", "application/json");

      if (url.pathname === "/internal/emit") {
        const namespace = body.namespace as "/workspace" | "/chat";
        const event = body.event as string;
        const data = body.data ?? {};
        const rooms: string[] = [];
        if (Array.isArray(body.rooms)) rooms.push(...(body.rooms as string[]));
        if (typeof body.room === "string") rooms.push(body.room);
        if (!namespace || !event || rooms.length === 0) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: "namespace/event/room requis" }));
          return;
        }
        io.of(namespace).to(rooms).emit(event, data);
        res.end(JSON.stringify({ ok: true, delivered: rooms.length }));
        return;
      }

      if (url.pathname === "/internal/presence") {
        const userIds = (body.userIds as string[] | undefined) ?? [];
        const presence: Record<string, string> = {};
        const now = Date.now();
        for (const id of userIds) {
          const entry = online.get(id);
          presence[id] = entry && entry.expiresAt > now ? entry.status : "offline";
        }
        res.end(JSON.stringify({ ok: true, presence }));
        return;
      }

      res.statusCode = 404;
      res.end(JSON.stringify({ error: "not found" }));
    })().catch((error) => {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: String(error) }));
    });
    return;
  }

  res.statusCode = 404;
  res.end("not found");
});

// ------------------------------------------------------------
// SOCKET.IO — monté sur le même serveur HTTP
// ------------------------------------------------------------

const io = new Server(httpServer, {
  cors: { origin: true, credentials: true },
  // Ping/pong natif en complément du heartbeat applicatif
  pingInterval: 25_000,
  pingTimeout: 20_000,
});

/** Parse le cookie `as_access` depuis les en-têtes du handshake. */
function cookieToken(cookieHeader?: string): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === "as_access") return decodeURIComponent(rest.join("="));
  }
  return null;
}

/** Middleware JWT commun aux deux namespaces. */
function jwtAuth(socket: Socket, next: (err?: Error) => void): void {
  const token =
    (socket.handshake.auth?.token as string | undefined) ??
    cookieToken(socket.handshake.headers.cookie);
  if (!token) {
    next(new Error("unauthorized: token manquant"));
    return;
  }
  void verifyToken<AuthPayload>(token)
    .then((payload) => {
      // Cookie as_access (même hôte) OU jeton realtime court
      // (GET /api/v1/realtime/token — hôte différent / preview)
      const type = payload.type as string;
      if ((type !== "access" && type !== "realtime") || !payload.sub) {
        throw new Error("mauvais type de token");
      }
      socket.data.userId = payload.sub;
      next();
    })
    .catch(() => next(new Error("unauthorized: token invalide")));
}

// ------------------------------------------------------------
// ERREURS : ack uniforme { ok:false, error }
// ------------------------------------------------------------

type Ack = (response: { ok: boolean; error?: string; [k: string]: unknown }) => void;

function ackError(ack: unknown, error: unknown): void {
  if (typeof ack === "function") {
    (ack as Ack)({
      ok: false,
      error: error instanceof Error ? error.message : "Erreur interne",
    });
  }
}

// ============================================================
// NAMESPACE /workspace — salons, typing, voix
// ============================================================

const workspaceNs = io.of("/workspace");
workspaceNs.use(jwtAuth);

workspaceNs.on("connection", (socket) => {
  const userId = socket.data.userId as string;
  void socket.join(`user:${userId}`);

  // --- Salon texte : rejoindre / quitter ----------------------
  socket.on("channel:join", async (payload: { channelId?: string }, ack?: Ack) => {
    try {
      const channelId = String(payload?.channelId ?? "");
      const [channel] = await db
        .select()
        .from(workspaceChannels)
        .where(eq(workspaceChannels.id, channelId))
        .limit(1);
      if (!channel) throw new Error("Salon introuvable");
      await getWsMembership(channel.workspaceId, userId).then((m) => {
        if (!m) throw new Error("Tu n'es pas membre de cet espace");
      });
      await socket.join(`channel:${channelId}`);
      ack?.({ ok: true });
    } catch (error) {
      ackError(ack, error);
    }
  });

  socket.on("channel:leave", async (payload: { channelId?: string }) => {
    const channelId = String(payload?.channelId ?? "");
    await socket.leave(`channel:${channelId}`);
  });

  // --- Message en direct (REST offre la même chose) -----------
  socket.on(
    "message:send",
    async (
      payload: {
        channelId?: string;
        content?: string;
        replyToId?: string | null;
        clientRef?: string;
      },
      ack?: Ack
    ) => {
      try {
        const channelId = String(payload?.channelId ?? "");
        const content = String(payload?.content ?? "");
        const [channel] = await db
          .select()
          .from(workspaceChannels)
          .where(eq(workspaceChannels.id, channelId))
          .limit(1);
        if (!channel) throw new Error("Salon introuvable");
        const workspace = await getWorkspaceOr404(channel.workspaceId);
        const { message, author } = await sendWorkspaceMessage({
          workspace,
          channel,
          authorId: userId,
          content,
          replyToId: payload?.replyToId ?? null,
        });
        const data = {
          message: { ...message, author },
          channelId,
          workspaceId: workspace.id,
        };
        workspaceNs.to(`channel:${channelId}`).emit("message:new", data);
        ack?.({ ok: true, ...data, clientRef: payload?.clientRef ?? null });
      } catch (error) {
        ackError(ack, error);
      }
    }
  );

  // --- Indicateur de frappe -----------------------------------
  for (const [event, isTyping] of [
    ["typing:start", true],
    ["typing:stop", false],
  ] as const) {
    socket.on(event, async (payload: { channelId?: string }) => {
      const channelId = String(payload?.channelId ?? "");
      if (!channelId) return;
      const name = await getUserName(userId);
      socket.to(`channel:${channelId}`).emit("typing:update", {
        channelId,
        userId,
        userName: name,
        isTyping,
      });
    });
  }

  // --- Salons vocaux : état + relais signalisation WebRTC -----
  socket.on("voice:join", async (payload: { channelId?: string }, ack?: Ack) => {
    try {
      const channelId = String(payload?.channelId ?? "");
      const [channel] = await db
        .select()
        .from(workspaceChannels)
        .where(eq(workspaceChannels.id, channelId))
        .limit(1);
      if (!channel || channel.type !== "voice") throw new Error("Salon vocal introuvable");
      const workspace = await getWorkspaceOr404(channel.workspaceId);
      const membership = await getWsMembership(workspace.id, userId);
      if (!membership) throw new Error("Tu n'es pas membre de cet espace");
      const mask = await getPermissionMask(workspace, userId);
      if (!hasPermission(mask, WS_PERMISSIONS.CONNECT_VOICE)) {
        throw new Error("Permission voix refusée");
      }

      // État mémoire + persistance BDD (l'UI liste les présents par REST)
      if (!voiceStates.has(channelId)) voiceStates.set(channelId, new Map());
      voiceStates.get(channelId)!.set(userId, { muted: false, deafened: false });
      await db
        .insert(workspaceVoiceStates)
        .values({ channelId, userId })
        .onConflictDoNothing();
      socket.data.voiceChannelId = channelId;

      // État complet diffusé aux abonnés du salon
      workspaceNs.to(`channel:${channelId}`).emit("voice:state", {
        channelId,
        participants: voiceParticipants(channelId),
      });
      ack?.({ ok: true, participants: voiceParticipants(channelId) });
    } catch (error) {
      ackError(ack, error);
    }
  });

  socket.on("voice:leave", async () => {
    await leaveVoice(socket);
  });

  socket.on(
    "voice:mute",
    async (payload: { muted?: boolean; deafened?: boolean }) => {
      const channelId = socket.data.voiceChannelId as string | undefined;
      if (!channelId) return;
      const state = voiceStates.get(channelId)?.get(userId);
      if (!state) return;
      state.muted = !!payload?.muted;
      state.deafened = !!payload?.deafened;
      await db
        .update(workspaceVoiceStates)
        .set({ muted: state.muted, deafened: state.deafened })
        .where(
          and(
            eq(workspaceVoiceStates.channelId, channelId),
            eq(workspaceVoiceStates.userId, userId)
          )
        );
      workspaceNs.to(`channel:${channelId}`).emit("voice:state", {
        channelId,
        participants: voiceParticipants(channelId),
      });
    }
  );

  // Relais de la signalisation WebRTC (offer/answer/ICE) —
  // le serveur ne lit jamais le contenu : simple aiguillage.
  socket.on(
    "voice:signal",
    (payload: { targetUserId?: string; channelId?: string; data?: unknown }) => {
      const target = String(payload?.targetUserId ?? "");
      if (!target) return;
      workspaceNs.to(`user:${target}`).emit("voice:signal", {
        fromUserId: userId,
        channelId: payload?.channelId ?? null,
        data: payload?.data ?? null,
      });
    }
  );

  socket.on("disconnect", () => {
    void leaveVoice(socket);
  });
});

function voiceParticipants(channelId: string) {
  return [...(voiceStates.get(channelId)?.entries() ?? [])].map(
    ([userId, s]) => ({ userId, ...s })
  );
}

async function leaveVoice(socket: Socket): Promise<void> {
  const channelId = socket.data.voiceChannelId as string | undefined;
  if (!channelId) return;
  socket.data.voiceChannelId = undefined;
  const userId = socket.data.userId as string;
  voiceStates.get(channelId)?.delete(userId);
  if ((voiceStates.get(channelId)?.size ?? 0) === 0) voiceStates.delete(channelId);
  await db
    .delete(workspaceVoiceStates)
    .where(
      and(
        eq(workspaceVoiceStates.channelId, channelId),
        eq(workspaceVoiceStates.userId, userId)
      )
    )
    .catch(() => {});
  workspaceNs.to(`channel:${channelId}`).emit("voice:state", {
    channelId,
    participants: voiceParticipants(channelId),
  });
}

// ============================================================
// NAMESPACE /chat — conversations, présence, appels
// ============================================================

const chatNs = io.of("/chat");
chatNs.use(jwtAuth);

chatNs.on("connection", (socket) => {
  const userId = socket.data.userId as string;
  void socket.join(`user:${userId}`);
  // Fil social : tout utilisateur connecté reçoit les nouveaux
  // posts en direct (room publique, lecture seule — l'écriture
  // passe par l'API REST /api/v1/social/posts).
  void socket.join("feed");

  // --- Présence : première socket → en ligne -------------------
  const sockets = chatSockets.get(userId) ?? new Set<string>();
  const wasOffline = sockets.size === 0;
  sockets.add(socket.id);
  chatSockets.set(userId, sockets);
  if (wasOffline) {
    setPresence(userId, "online");
    void persistLastSeen(userId, "online").catch(() => {});
  }

  socket.on("presence:heartbeat", (payload?: { status?: PresenceStatus }) => {
    const status = payload?.status ?? "online";
    setPresence(userId, status);
  });

  // --- Rooms conversation ---------------------------------------
  socket.on("conversation:join", async (payload: { conversationId?: string }, ack?: Ack) => {
    try {
      const conversationId = String(payload?.conversationId ?? "");
      const m = await getChatMembership(conversationId, userId);
      if (!m) throw new Error("Tu n'es pas membre de cette conversation");
      await socket.join(`conversation:${conversationId}`);
      ack?.({ ok: true });
    } catch (error) {
      ackError(ack, error);
    }
  });

  socket.on("conversation:leave", async (payload: { conversationId?: string }) => {
    await socket.leave(`conversation:${String(payload?.conversationId ?? "")}`);
  });

  // --- Envoi en direct (équivalent du POST REST) ---------------
  socket.on(
    "message:send",
    async (
      payload: {
        conversationId?: string;
        content?: string;
        replyToId?: string | null;
        clientRef?: string;
      },
      ack?: Ack
    ) => {
      try {
        const conversationId = String(payload?.conversationId ?? "");
        const { message, author } = await sendChatMessage({
          conversationId,
          senderId: userId,
          content: payload?.content ?? "",
          replyToId: payload?.replyToId ?? null,
        });
        const data = {
          message: { ...message, author, reactions: [], delivery: "sent" },
          conversationId,
        };
        chatNs.to(`conversation:${conversationId}`).emit("message:new", data);
        ack?.({ ok: true, ...data, clientRef: payload?.clientRef ?? null });
      } catch (error) {
        ackError(ack, error);
      }
    }
  );

  // --- Typing ----------------------------------------------------
  chatTypingHandler(socket, userId);

  // --- Signalisation d'appel WebRTC : relais pur ----------------
  socket.on(
    "call:signal",
    (payload: { targetUserId?: string; callId?: string; data?: unknown }) => {
      const target = String(payload?.targetUserId ?? "");
      if (!target) return;
      chatNs
        .to(`user:${target}`)
        .emit("call:signal", {
          fromUserId: userId,
          callId: payload?.callId ?? null,
          data: payload?.data ?? null,
        });
    }
  );

  // --- Déconnexion : dernière socket → hors ligne ----------------
  socket.on("disconnect", () => {
    const set = chatSockets.get(userId);
    set?.delete(socket.id);
    if (!set || set.size === 0) {
      chatSockets.delete(userId);
      online.delete(userId);
      // Petit délai de grâce : un rafraîchissement de page ne doit
      // pas faire clignoter « hors ligne » chez les correspondants
      setTimeout(() => {
        if (!chatSockets.has(userId)) {
          void persistLastSeen(userId, "offline").catch(() => {});
          chatNs.emit("presence:update", {
            userId,
            status: "offline",
            lastSeenAt: new Date().toISOString(),
          });
        }
      }, 8000);
    }
  });
});

function chatTypingHandler(socket: Socket, userId: string): void {
  for (const [event, isTyping] of [
    ["typing:start", true],
    ["typing:stop", false],
  ] as const) {
    socket.on(event, async (payload: { conversationId?: string }) => {
      const conversationId = String(payload?.conversationId ?? "");
      if (!conversationId) return;
      const name = await getUserName(userId);
      socket.to(`conversation:${conversationId}`).emit("typing:update", {
        conversationId,
        userId,
        userName: name,
        isTyping,
      });
    });
  }
}

/** Pose le statut (TTL 120 s) + diffuse aux connectés du namespace. */
function setPresence(userId: string, status: PresenceStatus): void {
  online.set(userId, { status, expiresAt: Date.now() + PRESENCE_TTL_MS });
  chatNs.emit("presence:update", {
    userId,
    status,
    lastSeenAt: new Date().toISOString(),
  });
}

// Balayage périodique : entrées de présence expirées sans heartbeat
setInterval(() => {
  const now = Date.now();
  for (const [userId, entry] of online) {
    if (entry.expiresAt < now && !chatSockets.has(userId)) {
      online.delete(userId);
      void persistLastSeen(userId, "offline").catch(() => {});
      chatNs.emit("presence:update", {
        userId,
        status: "offline",
        lastSeenAt: new Date().toISOString(),
      });
    }
  }
}, PRESENCE_TTL_MS / 2).unref();

// ------------------------------------------------------------
// DÉMARRAGE
// ------------------------------------------------------------

httpServer.listen(PORT, () => {
  console.log(
    `[realtime] socket.io prêt sur :${PORT} (namespaces /workspace /chat, API interne /internal/*)`
  );
});

// Propreté des tests/scripts
export { io, httpServer, online, chatSockets };
