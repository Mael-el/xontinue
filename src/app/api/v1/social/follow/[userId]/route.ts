// ============================================================
// /api/v1/social/follow/[userId]
// POST — Bascule follow/unfollow (idempotent : un couple
//        follower/followee unique) et renvoie le nombre
//        d'abonnés de la cible à jour
// ============================================================

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { apiErrorResponse } from "@/lib/api/errors";
import { toggleFollow } from "@/lib/social/service";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ userId: string }> };

export async function POST(_req: Request, { params }: RouteContext) {
  try {
    const user = await requireUser();
    const { userId } = await params;

    const result = await toggleFollow(user.userId, userId);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
