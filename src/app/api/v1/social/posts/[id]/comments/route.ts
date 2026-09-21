// ============================================================
// /api/v1/social/posts/[id]/comments
// GET  — Commentaires d'une publication (ordre chronologique)
// POST — Créer un commentaire { content } + compteur incrémenté
//        → broadcast « post:comment » sur « feed »
// ============================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { apiErrorResponse, readJson } from "@/lib/api/errors";
import {
  addComment,
  ensurePostExists,
  listComments,
} from "@/lib/social/service";
import { emitToRoom } from "@/lib/realtime/emit";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

const createCommentSchema = z.object({
  content: z.string().trim().min(1, "Le commentaire est requis").max(1000),
});

export async function GET(_req: Request, { params }: RouteContext) {
  try {
    await requireUser();
    const { id } = await params;
    const comments = await listComments(id);
    return NextResponse.json({ ok: true, items: comments });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(req: Request, { params }: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await params;
    await ensurePostExists(id);

    const body = createCommentSchema.parse(await readJson(req));
    const { comment, commentsCount } = await addComment(
      user.userId,
      id,
      body.content
    );

    await emitToRoom("/chat", "feed", "post:comment", {
      postId: id,
      commentsCount,
      comment,
    });

    return NextResponse.json(
      { ok: true, comment, commentsCount },
      { status: 201 }
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
