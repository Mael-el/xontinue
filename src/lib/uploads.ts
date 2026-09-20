// ============================================================
// UPLOADS — stockage local des pièces jointes (dev/demo)
// Sauvegarde sous public/uploads/attachments/ — servi par Next
// en statique. En production : remplacer par un bucket objet
// (S3/Cloudflare R2) en conservant la même signature.
// ============================================================

import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

/** Taille maximale d'une pièce jointe : 10 Mo. */
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

const UPLOAD_DIR = path.join(
  process.cwd(),
  "public",
  "uploads",
  "attachments"
);

export class UploadError extends Error {
  constructor(
    message: string,
    readonly status: number = 400
  ) {
    super(message);
  }
}

/** Noms de fichiers sûrs (anti-traversal, ASCII + tirets). */
function sanitizeFileName(name: string): string {
  const cleaned = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");
  return cleaned.slice(-80) || "fichier";
}

/**
 * Sauvegarde un attachment encodé en base64.
 * Retourne l'URL publique « /uploads/attachments/… », la taille
 * réelle et le nom assaini.
 */
export async function saveAttachmentFromBase64(input: {
  fileName: string;
  mimeType: string;
  dataBase64: string;
}): Promise<{ url: string; fileName: string; sizeBytes: number }> {
  let buffer: Buffer;
  try {
    buffer = Buffer.from(input.dataBase64, "base64");
  } catch {
    throw new UploadError("Pièce jointe illisible (base64 invalide)");
  }
  if (buffer.length === 0) {
    throw new UploadError("Pièce jointe vide");
  }
  if (buffer.length > MAX_ATTACHMENT_BYTES) {
    throw new UploadError("Pièce jointe trop lourde (10 Mo max)", 413);
  }

  const safeName = `${randomUUID()}-${sanitizeFileName(input.fileName)}`;
  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(path.join(UPLOAD_DIR, safeName), buffer);

  return {
    url: `/uploads/attachments/${safeName}`,
    fileName: sanitizeFileName(input.fileName).slice(0, 255),
    sizeBytes: buffer.length,
  };
}
