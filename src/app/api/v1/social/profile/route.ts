// ============================================================
// /api/v1/social/profile
// GET — Mini-profil de l'utilisateur courant (colonne gauche
//       du fil) : identité + nombres de posts / abonnés / abonnements
// ============================================================

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { apiErrorResponse } from "@/lib/api/errors";
import { getProfileSummary } from "@/lib/social/service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireUser();
    const profile = await getProfileSummary(user.userId);
    return NextResponse.json({ ok: true, profile });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
