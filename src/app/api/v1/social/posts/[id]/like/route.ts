// ============================================================
// /api/v1/social/posts/[id]/like
// POST — Bascule le like de l'utilisateur courant (idempotent :
//        un like = un couple post/utilisateur) et renvoie le
//        compteur à jour → broadcast « post:like » sur « feed »
// ============================================================

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { apiErrorResponse } from "@/lib/api/errors";
import { toggleLike } from "@/lib/social/service";
import { emitToRoom } from "@/lib/realtime/emit";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const result = await toggleLike(user.userId, id);

    await emitToRoom("/chat", "feed", "post:like", {
      postId: id,
      likesCount: result.likesCount,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
