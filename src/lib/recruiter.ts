// ============================================================
// RECRUTEUR — Guard d'accès aux espaces entreprise
// Un recruteur = utilisateur authentifié propriétaire d'une
// ligne dans `companies` (ou admin).
// ============================================================

import { db } from "@/db";
import { companies, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireUser, AuthError, type CurrentUser } from "@/lib/auth";

export interface RecruiterContext {
  user: CurrentUser;
  company: typeof companies.$inferSelect;
}

/**
 * Exige un utilisateur authentifié ET propriétaire d'une entreprise.
 * Retourne l'utilisateur courant et son entreprise.
 * @throws AuthError 401 si non connecté, 403 si pas d'entreprise.
 */
export async function requireRecruiter(): Promise<RecruiterContext> {
  const user = await requireUser();

  const [company] = await db
    .select()
    .from(companies)
    .where(eq(companies.userId, user.userId))
    .limit(1);

  if (company) {
    return { user, company };
  }

  // Un admin peut opérer sur la première entreprise demandée ? Non :
  // sans entreprise associée, pas d'espace recruteur.
  throw new AuthError(
    "Aucune entreprise associée à ce compte. Crée d'abord ton entreprise.",
    403
  );
}

/**
 * Retourne l'entreprise de l'utilisateur (ou null) — version
 * non bloquante pour les GET d'état.
 */
export async function getRecruiterCompany(userId: string) {
  const [company] = await db
    .select({
      company: companies,
      ownerName: users.fullName,
    })
    .from(companies)
    .leftJoin(users, eq(companies.userId, users.id))
    .where(eq(companies.userId, userId))
    .limit(1);

  return company ?? null;
}
