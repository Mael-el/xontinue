// ============================================================
// TESTS — Champ de bits de permissions workspace
// (src/lib/workspaces/permissions.ts)
// ============================================================

import {
  ALL_PERMISSIONS,
  DEFAULT_MEMBER_PERMISSIONS,
  effectivePermissions,
  hasAllPermissions,
  hasPermission,
  permissionNames,
  permissionsFromNames,
  WS_PERMISSIONS,
} from "@/lib/workspaces/permissions";

describe("WS_PERMISSIONS (champ de bits)", () => {
  it("chaque permission est un bit distinct (puissance de 2, unique)", () => {
    const values = Object.values(WS_PERMISSIONS);
    for (const v of values) expect(v & (v - 1)).toBe(0);
    expect(new Set(values).size).toBe(values.length);
  });

  it("couvre les 10 permissions du spec", () => {
    expect(Object.keys(WS_PERMISSIONS)).toEqual([
      "MANAGE_WORKSPACE",
      "MANAGE_CHANNELS",
      "MANAGE_MEMBERS",
      "MANAGE_ROLES",
      "KICK_MEMBERS",
      "BAN_MEMBERS",
      "SEND_MESSAGES",
      "VIEW_CHANNELS",
      "CONNECT_VOICE",
      "SPEAK",
    ]);
  });
});

describe("hasPermission / hasAllPermissions", () => {
  it("détecte la présence et l'absence de bits", () => {
    const mask = WS_PERMISSIONS.SEND_MESSAGES | WS_PERMISSIONS.VIEW_CHANNELS;
    expect(hasPermission(mask, WS_PERMISSIONS.SEND_MESSAGES)).toBe(true);
    expect(hasPermission(mask, WS_PERMISSIONS.KICK_MEMBERS)).toBe(false);
  });

  it("hasAllPermissions exige TOUS les bits listés", () => {
    const mask = ALL_PERMISSIONS;
    expect(
      hasAllPermissions(mask, WS_PERMISSIONS.SEND_MESSAGES, WS_PERMISSIONS.SPEAK)
    ).toBe(true);
    expect(hasAllPermissions(0, WS_PERMISSIONS.SEND_MESSAGES)).toBe(false);
  });
});

describe("noms ↔ masque", () => {
  it("permissionNames traduit un masque", () => {
    const names = permissionNames(DEFAULT_MEMBER_PERMISSIONS);
    expect(names.sort()).toEqual(
      ["CONNECT_VOICE", "SEND_MESSAGES", "SPEAK", "VIEW_CHANNELS"].sort()
    );
  });

  it("permissionsFromNames ignore les noms inconnus (entrée API hostile)", () => {
    expect(permissionsFromNames(["SEND_MESSAGES", "HACK", "", "SPEAK"])).toBe(
      WS_PERMISSIONS.SEND_MESSAGES | WS_PERMISSIONS.SPEAK
    );
  });

  it("aller-retour noms ↔ masque", () => {
    const mask = permissionsFromNames(["MANAGE_CHANNELS", "BAN_MEMBERS"]);
    expect(permissionNames(mask).sort()).toEqual(["BAN_MEMBERS", "MANAGE_CHANNELS"]);
  });
});

describe("effectivePermissions", () => {
  it("OU de tous les rôles du membre", () => {
    const mask = effectivePermissions(
      [WS_PERMISSIONS.SEND_MESSAGES, WS_PERMISSIONS.CONNECT_VOICE, 0],
      false
    );
    expect(mask).toBe(WS_PERMISSIONS.SEND_MESSAGES | WS_PERMISSIONS.CONNECT_VOICE);
  });

  it("le propriétaire a implicitement TOUTES les permissions", () => {
    expect(effectivePermissions([], true)).toBe(ALL_PERMISSIONS);
    expect(effectivePermissions([0], true)).toBe(ALL_PERMISSIONS);
  });

  it("membre sans rôle = aucune permission", () => {
    expect(effectivePermissions([], false)).toBe(0);
  });
});
