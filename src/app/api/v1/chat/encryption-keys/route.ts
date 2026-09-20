// ============================================================
// /api/v1/chat/encryption-keys — POINT D'EXTENSION E2E
//
// Le chiffrement de bout en bout (Signal Protocol / MLS) est
// une extension NON IMPLÉMENTÉE : la messagerie stocke les
// messages en clair côté serveur. Ce endpoint pose la brique
// minimale côté serveur pour y arriver plus tard :
//  - GET ?userIds=... → clés PUBLIQUES des correspondants
//    (pour un chiffrement côté client hybride X25519+AES)
//  - PUT { publicKey }  → publie/renouvelle MA clé publique
// Le serveur ne stocke JAMAIS de clé privée ; les messages
// chiffrés resteraient inaccessibles au serveur (validation
// E2E côté clients uniquement — à faire en PARTIE suivante).
// ============================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/db";
import { encryptionKeys } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { apiErrorResponse, readJson } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

const putSchema = z.object({
  publicKey: z.string().min(32).max(4096),
});

export async function GET(req: Request) {
  try {
    await requireUser();
    const url = new URL(req.url);
    const userIds = [
      ...new Set(
        (url.searchParams.get("userIds") ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      ),
    ].slice(0, 100);

    const keys =
      userIds.length > 0
        ? await db
            .select({
              userId: encryptionKeys.userId,
              publicKey: encryptionKeys.publicKey,
              createdAt: encryptionKeys.createdAt,
            })
            .from(encryptionKeys)
            .where(inArray(encryptionKeys.userId, userIds))
        : [];

    return NextResponse.json({
      ok: true,
      e2eImplemented: false,
      keys,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PUT(req: Request) {
  try {
    const user = await requireUser();
    const { publicKey } = putSchema.parse(await readJson(req));

    const [row] = await db
      .insert(encryptionKeys)
      .values({ userId: user.userId, publicKey })
      .onConflictDoUpdate({
        target: encryptionKeys.userId,
        set: { publicKey, createdAt: new Date() },
      })
      .returning();

    return NextResponse.json({
      ok: true,
      e2eImplemented: false,
      key: { userId: row.userId, createdAt: row.createdAt },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
