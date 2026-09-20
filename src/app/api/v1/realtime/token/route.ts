// ============================================================
// GET /api/v1/realtime/token
// Émet un JETON COURT (10 min, type « realtime ») pour ouvrir
// les sockets du serveur temps réel. Nécessaire quand le cookie
// httpOnly `as_access` n'est pas transmissible au handshake WS
// (hôte différent, ex: 3000-xxx.e2b.app → 3001-xxx.e2b.app).
// Le client ne stocke jamais ce jeton (mémoire uniquement).
// ============================================================

import { NextResponse } from "next/server";
import { SignJWT } from "jose";
import { requireUser } from "@/lib/auth";
import { apiErrorResponse } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

const TTL_SECONDS = 10 * 60;

const DEV_SECRET = "africaskills-dev-secret-change-me-32-chars";

/** Même règle que src/lib/auth/jwt.ts : jamais de secret de dev en prod. */
function signingSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET || DEV_SECRET;
  if (
    process.env.NODE_ENV === "production" &&
    (!process.env.JWT_SECRET || secret === DEV_SECRET || secret.length < 32)
  ) {
    throw new Error(
      "JWT_SECRET (≥ 32 caractères) est obligatoire en production"
    );
  }
  return new TextEncoder().encode(secret);
}

export async function GET() {
  try {
    const user = await requireUser();
    const secret = signingSecret();
    const token = await new SignJWT({
      role: user.role,
      type: "realtime",
      sessionId: user.sessionId,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(user.userId)
      .setIssuedAt()
      .setIssuer("africaskills")
      .setExpirationTime(`${TTL_SECONDS}s`)
      .sign(secret);

    return NextResponse.json({
      ok: true,
      token,
      expiresIn: TTL_SECONDS,
      /** URL publique du serveur temps réel (overridable env). */
      realtimeUrl:
        process.env.NEXT_PUBLIC_REALTIME_URL ?? "http://localhost:3001",
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
