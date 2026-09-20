// ============================================================
// CRÉATION D'UN WORKSPACE — structure par défaut
// Catégorie « Général » + salon « général » + rôles Admin/Membre.
// ============================================================

import { db } from "@/db";
import {
  workspaceCategories,
  workspaceChannels,
  workspaceMembers,
  workspaceMemberRoles,
  workspaceRoles,
  workspaces,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  ALL_PERMISSIONS,
  DEFAULT_MEMBER_PERMISSIONS,
} from "./permissions";
import { uniqueWorkspaceSlug, WorkspaceError } from "./service";

interface CreateWorkspaceInput {
  name: string;
  description?: string;
  icon?: string;
  isPublic?: boolean;
}

/**
 * Crée un workspace complet en un appel :
 *  - catégorie par défaut « Général »
 *  - salon « général » (texte) + salon « Vocal » (voix)
 *  - rôles « Admin » (toutes permissions) et « Membre » (par défaut)
 *  - le propriétaire rejoint avec le rôle Admin
 */
export async function createWorkspaceWithDefaults(
  ownerId: string,
  input: CreateWorkspaceInput
) {
  const name = input.name.trim();
  if (!name || name.length > 120) {
    throw new WorkspaceError("Le nom de l'espace est requis (≤ 120 caractères)");
  }
  const slug = await uniqueWorkspaceSlug(name);

  const [ws] = await db
    .insert(workspaces)
    .values({
      name,
      slug,
      description: input.description?.trim() || null,
      icon: input.icon || "🏢",
      ownerId,
      isPublic: input.isPublic ?? false,
      memberCount: 1,
    })
    .returning();

  // Catégorie + salons par défaut
  const [category] = await db
    .insert(workspaceCategories)
    .values({ workspaceId: ws.id, name: "Général", position: 0 })
    .returning();
  await db.insert(workspaceChannels).values([
    {
      workspaceId: ws.id,
      categoryId: category.id,
      name: "général",
      type: "text",
      position: 0,
    },
    {
      workspaceId: ws.id,
      categoryId: category.id,
      name: "Vocal",
      type: "voice",
      position: 1,
    },
  ]);

  // Rôles par défaut
  const [adminRole, memberRole] = await db
    .insert(workspaceRoles)
    .values([
      {
        workspaceId: ws.id,
        name: "Admin",
        color: "#F97316",
        permissions: ALL_PERMISSIONS,
        position: 1,
      },
      {
        workspaceId: ws.id,
        name: "Membre",
        color: "#94A3B8",
        permissions: DEFAULT_MEMBER_PERMISSIONS,
        position: 0,
      },
    ])
    .returning();

  // Le propriétaire rejoint avec le rôle Admin
  const [member] = await db
    .insert(workspaceMembers)
    .values({ workspaceId: ws.id, userId: ownerId })
    .returning();
  await db.insert(workspaceMemberRoles).values({
    memberId: member.id,
    roleId: adminRole.id,
  });

  return {
    workspace: ws,
    defaultChannel: category,
    roles: { admin: adminRole, member: memberRole },
  };
}

/** Récupère le rôle par défaut « Membre » (le plus bas). */
export async function getDefaultMemberRole(workspaceId: string) {
  const [role] = await db
    .select()
    .from(workspaceRoles)
    .where(eq(workspaceRoles.workspaceId, workspaceId))
    .orderBy(workspaceRoles.position)
    .limit(1);
  return role ?? null;
}
