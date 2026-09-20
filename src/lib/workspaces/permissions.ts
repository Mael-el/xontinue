// ============================================================
// PERMISSIONS WORKSPACE — champ de bits granulaire
// Chaque permission est un bit ; un rôle stocke l'ENTIER des
// bits autorisés. Rapide, compact, équivalent des « flags »
// de Discord. Voir tests : __tests__/permissions.test.ts
// ============================================================

export const WS_PERMISSIONS = {
  MANAGE_WORKSPACE: 1 << 0,
  MANAGE_CHANNELS: 1 << 1,
  MANAGE_MEMBERS: 1 << 2,
  MANAGE_ROLES: 1 << 3,
  KICK_MEMBERS: 1 << 4,
  BAN_MEMBERS: 1 << 5,
  SEND_MESSAGES: 1 << 6,
  VIEW_CHANNELS: 1 << 7,
  CONNECT_VOICE: 1 << 8,
  SPEAK: 1 << 9,
} as const;

export type WsPermissionName = keyof typeof WS_PERMISSIONS;

/** Permissions par défaut d'un simple membre. */
export const DEFAULT_MEMBER_PERMISSIONS =
  WS_PERMISSIONS.SEND_MESSAGES |
  WS_PERMISSIONS.VIEW_CHANNELS |
  WS_PERMISSIONS.CONNECT_VOICE |
  WS_PERMISSIONS.SPEAK;

/** Toutes les permissions (rôle « Admin » créé par défaut). */
export const ALL_PERMISSIONS = Object.values(WS_PERMISSIONS).reduce(
  (acc, bit) => acc | bit,
  0
);

/** Vérifie qu'un masque possède une permission. */
export function hasPermission(mask: number, perm: number): boolean {
  return (mask & perm) === perm;
}

/** Vérifie qu'un masque possède TOUTES les permissions listées. */
export function hasAllPermissions(mask: number, ...perms: number[]): boolean {
  return perms.every((p) => hasPermission(mask, p));
}

/** Traduit un masque en liste de noms ( pour l'API/UI ). */
export function permissionNames(mask: number): WsPermissionName[] {
  return (Object.keys(WS_PERMISSIONS) as WsPermissionName[]).filter((name) =>
    hasPermission(mask, WS_PERMISSIONS[name])
  );
}

/** Traduit des noms en masque (entrée API). Noms inconnus ignorés. */
export function permissionsFromNames(names: string[]): number {
  return names.reduce((acc, name) => {
    const bit = WS_PERMISSIONS[name as WsPermissionName];
    return bit === undefined ? acc : acc | bit;
  }, 0);
}

/**
 * Permissions EFFECTIVES d'un membre = OU de tous ses rôles.
 * Le propriétaire du workspace a implicitement TOUTES les permissions.
 */
export function effectivePermissions(roleMasks: number[], isOwner: boolean): number {
  if (isOwner) return ALL_PERMISSIONS;
  return roleMasks.reduce((acc, m) => acc | m, 0);
}
