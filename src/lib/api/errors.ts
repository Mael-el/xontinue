// ============================================================
// API — transformation uniforme des erreurs en réponses JSON
// Partagée par toutes les routes v1 (cohérence des statuts).
// ============================================================

import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthError } from "@/lib/auth";

/** Erreur métier transportant un statut HTTP. */
export interface StatusErrorLike {
  message: string;
  status: number;
}

export function isStatusError(error: unknown): error is StatusErrorLike {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof (error as { status: unknown }).status === "number"
  );
}

/**
 * Convertit n'importe quelle erreur en NextResponse JSON
 * { ok:false, error, details? } avec le bon statut.
 */
export function apiErrorResponse(error: unknown): NextResponse {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        ok: false,
        error: "Requête invalide",
        details: error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
      },
      { status: 400 }
    );
  }
  if (error instanceof AuthError || isStatusError(error)) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: error.status }
    );
  }
  console.error("api error:", error);
  return NextResponse.json(
    { ok: false, error: "Erreur interne du serveur" },
    { status: 500 }
  );
}

/** Lit le corps JSON ({} par défaut, jamais d'exception). */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return {};
  }
}
