// ============================================================
// SERVICE WORKSPACE — requêtes et contrôle d'accès
// Utilisé par les routes /api/v1/workspaces/* et le serveur
// temps réel (realtime/server.ts).
// ============================================================

import { db } from "@/db";
import {
  users,
  workspaceChannels,
  workspaceMemberRoles,
  workspaceMembers,
  workspaceMessages,
  workspaceRoles,
  workspaces,
} from "@/db/schema";
import { and, eq } from "drizzle-orm";
import {
  effectivePermissions,
  hasPermission,
  permissionNames,
  WS_PERMISSIONS,
  type WsPermissionName,
} from "./permissions";

export type WorkspaceRow = typeof workspaces.$inferSelect;
export type ChannelRow = typeof workspaceChannels.$inferSelect;
export type MemberRow = typeof workspaceMembers.$inferSelect;

/** Erreur métier mappée en statut HTTP par les routes. */
export class WorkspaceError extends Error {
  constructor(
    message: string,
    readonly status: number = 400
  ) {
    super(message);
  }
}

/** Récupère un workspace ou 404. */
export async function getWorkspaceOr404(id: string): Promise<WorkspaceRow> {
  const [ws] = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, id))
    .limit(1);
  if (!ws) throw new WorkspaceError("Espace de travail introuvable", 404);
  return ws;
}

/** Récupère le salon + vérifie son appartenance si workspaceId fourni. */
export async function getChannelOr404(
  channelId: string,
  workspaceId?: string
): Promise<ChannelRow> {
  const [ch] = await db
    .select()
    .from(workspaceChannels)
    .where(eq(workspaceChannels.id, channelId))
    .limit(1);
  if (!ch || (workspaceId && ch.workspaceId !== workspaceId)) {
    throw new WorkspaceError("Salon introuvable", 404);
  }
  return ch;
}

/** Adhésion d'un utilisateur à un workspace (null si non membre). */
export async function getMembership(
  workspaceId: string,
  userId: string
): Promise<MemberRow | null> {
  const [m] = await db
    .select()
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, userId)
      )
    )
    .limit(1);
  return m ?? null;
}

/** Adhésion exigée — 403 si l'utilisateur n'est pas membre. */
export async function requireMembership(
  workspaceId: string,
  userId: string
): Promise<MemberRow> {
  const m = await getMembership(workspaceId, userId);
  if (!m) throw new WorkspaceError("Tu n'es pas membre de cet espace", 403);
  return m;
}

/**
 * Calcule le masque de permissions effectives d'un utilisateur.
 * Propriétaire = toutes. Sinon OU des rôles du membre.
 */
export async function getPermissionMask(
  ws: WorkspaceRow,
  userId: string
): Promise<number> {
  const member = await getMembership(ws.id, userId);
  const masks: number[] = [];
  if (member) {
    const rows = await db
      .select({ permissions: workspaceRoles.permissions })
      .from(workspaceMemberRoles)
      .innerJoin(
        workspaceRoles,
        eq(workspaceMemberRoles.roleId, workspaceRoles.id)
      )
      .where(eq(workspaceMemberRoles.memberId, member.id));
    masks.push(...rows.map((r) => r.permissions));
  }
  return effectivePermissions(masks, ws.ownerId === userId);
}

/**
 * Exige une permission (ou plusieurs) — 403 sinon.
 * Retourne le masque effectif (évite un recalcul dans la route).
 */
export async function requirePermission(
  ws: WorkspaceRow,
  userId: string,
  perm: number,
  ...more: number[]
): Promise<number> {
  const mask = await getPermissionMask(ws, userId);
  const all = [perm, ...more];
  if (!all.every((p) => hasPermission(mask, p))) {
    throw new WorkspaceError("Permission insuffisante", 403);
  }
  return mask;
}

/** Liste les workspaces dont l'utilisateur est membre. */
export async function listMyWorkspaces(userId: string) {
  return db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      slug: workspaces.slug,
      icon: workspaces.icon,
      description: workspaces.description,
      isPublic: workspaces.isPublic,
      memberCount: workspaces.memberCount,
      ownerId: workspaces.ownerId,
      createdAt: workspaces.createdAt,
    })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(eq(workspaceMembers.userId, userId));
}

/** Workspace public minimal pour les réponses API. */
export function toPublicWorkspace(ws: WorkspaceRow, extras?: object) {
  return {
    id: ws.id,
    name: ws.name,
    slug: ws.slug,
    description: ws.description,
    icon: ws.icon,
    bannerUrl: ws.bannerUrl,
    isPublic: ws.isPublic,
    memberCount: ws.memberCount,
    ownerId: ws.ownerId,
    createdAt: ws.createdAt,
    ...extras,
  };
}

/** Informations publiques d'un utilisateur (pour membres/messages). */
export async function getUserSummary(userId: string) {
  const [u] = await db
    .select({
      id: users.id,
      fullName: users.fullName,
      avatarUrl: users.avatarUrl,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return u ?? null;
}

/** Slug unique à partir d'un nom (…-2, …-3 si pris). */
export async function uniqueWorkspaceSlug(name: string): Promise<string> {
  const { slugify } = await import("@/lib/format");
  const base = slugify(name).slice(0, 120) || "espace";
  for (let i = 0; i < 10; i++) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    const [existing] = await db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(eq(workspaces.slug, candidate))
      .limit(1);
    if (!existing) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

/** Noms de permissions d'un masque (réponses API rôles/membres). */
export function maskToNames(mask: number): WsPermissionName[] {
  return permissionNames(mask);
}

/**
 * Poste un message dans un salon avec TOUTES les règles métier :
 *  - membre + permission SEND_MESSAGES
 *  - salon vocal : pas de messages
 *  - salon d'annonces : réservé aux administrateurs (MANAGE_WORKSPACE)
 * Appelé par la route REST ET par l'événement WS `message:send`.
 */
export async function sendWorkspaceMessage(opts: {
  workspace: WorkspaceRow;
  channel: ChannelRow;
  authorId: string;
  content: string;
  replyToId?: string | null;
}) {
  const { workspace, channel, authorId, content } = opts;
  const trimmed = content.trim();
  if (!trimmed || trimmed.length > 4000) {
    throw new WorkspaceError("Message vide ou trop long (4000 caractères)");
  }
  if (channel.type === "voice") {
    throw new WorkspaceError(
      "Les salons vocaux n'acceptent pas de messages",
      400
    );
  }
  await requireMembership(workspace.id, authorId);
  const mask = await getPermissionMask(workspace, authorId);
  if (!hasPermission(mask, WS_PERMISSIONS.SEND_MESSAGES)) {
    throw new WorkspaceError("Permission insuffisante", 403);
  }
  if (
    channel.type === "announcement" &&
    !hasPermission(mask, WS_PERMISSIONS.MANAGE_WORKSPACE)
  ) {
    throw new WorkspaceError(
      "Seuls les administrateurs publient dans un salon d'annonces",
      403
    );
  }

  const [message] = await db
    .insert(workspaceMessages)
    .values({
      channelId: channel.id,
      authorId,
      content: trimmed,
      replyToId: opts.replyToId ?? null,
    })
    .returning();

  const author = await getUserSummary(authorId);
  return { message, author };
}
