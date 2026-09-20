// ============================================================
// GET /api/v1/leaderboard?limit=
// Classement public des étudiants (XP, série, badges, cours).
// Si connecté : ajoute `currentUser` avec le rang exact,
// même hors du top N.
// ============================================================

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getLeaderboard, getUserRankEntry } from "@/lib/leaderboard";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const limit = Math.min(
      Math.max(1, Number(url.searchParams.get("limit") ?? 50) || 50),
      100
    );

    const entries = await getLeaderboard(limit);

    // Position de l'utilisateur connecté (même hors du top)
    let currentUser = null;
    const current = await getCurrentUser();
    if (current) {
      currentUser = await getUserRankEntry(current.userId);
    }

    return NextResponse.json({ ok: true, entries, currentUser });
  } catch (error) {
    console.error("leaderboard GET error:", error);
    return NextResponse.json(
      { ok: false, error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
