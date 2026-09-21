// ============================================================
// /api/v1/social/suggestions
// GET — Personnes à suivre : utilisateurs que je ne suis pas,
//       triés par nombre d'abonnés décroissant (?limit=, max 20)
// ============================================================

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { apiErrorResponse } from "@/lib/api/errors";
import { getSuggestions } from "@/lib/social/service";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const url = new URL(req.url);
    const limitParam = url.searchParams.get("limit");
    const limit = limitParam ? Number(limitParam) : 5;

    const items = await getSuggestions(
      user.userId,
      Number.isFinite(limit) ? limit : 5
    );
    return NextResponse.json({ ok: true, items });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
