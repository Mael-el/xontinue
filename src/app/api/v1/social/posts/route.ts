// ============================================================
// /api/v1/social/posts
// GET  — Page du fil d'actualité (?cursor=&limit=) et suggestions
//        intégrées : tri anti-chronologique, curseur stable
// POST — Créer une publication : { content, imageUrl? }
//        → broadcast WS « post:new » sur la room « feed »
// ============================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { apiErrorResponse, readJson } from "@/lib/api/errors";
import { createPost, getFeed } from "@/lib/social/service";
import { emitToRoom } from "@/lib/realtime/emit";

export const dynamic = "force-dynamic";

const createPostSchema = z.object({
  content: z.string().trim().min(1, "Le contenu est requis").max(2000),
  imageUrl: z.string().url("URL d'image invalide").max(500).nullish(),
});

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const url = new URL(req.url);
    const cursor = url.searchParams.get("cursor") ?? undefined;
    const limitParam = url.searchParams.get("limit");
    const limit = limitParam ? Number(limitParam) : undefined;

    const page = await getFeed(
      user.userId,
      cursor,
      Number.isFinite(limit) ? limit : undefined
    );
    return NextResponse.json({ ok: true, ...page });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = createPostSchema.parse(await readJson(req));

    const post = await createPost(user.userId, {
      content: body.content,
      imageUrl: body.imageUrl ?? null,
    });

    // Diffusion temps réel (best-effort — l'API REST reste la vérité)
    await emitToRoom("/chat", "feed", "post:new", { post });

    return NextResponse.json({ ok: true, post }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
