// ============================================================
// POST /api/v1/profiles/me/avatar
// Upload de photo de profil (stockage local /public/uploads)
// En production : Cloudflare R2 + compression Sharp.
// ============================================================

import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { requireUser, AuthError } from "@/lib/auth";

export const dynamic = "force-dynamic";

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

export async function POST(req: Request) {
  try {
    const current = await requireUser();
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { ok: false, error: "Fichier requis" },
        { status: 400 }
      );
    }

    if (!ALLOWED.includes(file.type)) {
      return NextResponse.json(
        { ok: false, error: "Format non supporté (JPG, PNG, WebP uniquement)" },
        { status: 400 }
      );
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { ok: false, error: "Fichier trop volumineux (5 MB max)" },
        { status: 400 }
      );
    }

    const ext = file.type.split("/")[1] === "jpeg" ? "jpg" : file.type.split("/")[1];
    const filename = `avatar-${current.userId}.${ext}`;
    const dir = join(process.cwd(), "public", "uploads", "avatars");
    await mkdir(dir, { recursive: true });
    const filepath = join(dir, filename);

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filepath, buffer);

    const avatarUrl = `/uploads/avatars/${filename}?v=${Date.now()}`;
    await db
      .update(users)
      .set({ avatarUrl, updatedAt: new Date() })
      .where(eq(users.id, current.userId));

    return NextResponse.json({
      ok: true,
      avatarUrl,
      message: "Avatar mis à jour",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: error.status }
      );
    }
    console.error("avatar upload error:", error);
    return NextResponse.json({ ok: false, error: "Erreur serveur" }, { status: 500 });
  }
}
