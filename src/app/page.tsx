// ============================================================
// / — ACCUEIL CONDITIONNEL
// Connecté     → fil social AfricaSkills (Facebook/LinkedIn-like)
// Non connecté → page marketing (hero, domaines, cours vedettes)
// ============================================================

import { db } from "@/db";
import { domains } from "@/db/schema";
import { sql } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import HomeMarketing from "@/components/HomeMarketing";
import { SocialFeed } from "@/components/feed/SocialFeed";

export const dynamic = "force-dynamic";

async function ensureSeed() {
  // Le seed automatique au premier rendu n'a lieu qu'en développement :
  // en production, l'initialisation est une opération explicite et
  // protégée (POST /api/seed avec l'en-tête x-seed-secret).
  if (process.env.NODE_ENV === "production") return;

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(domains);
  if (count === 0) {
    // Appel interne au seed
    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
    try {
      await fetch(`${baseUrl}/api/seed`, {
        method: "POST",
        cache: "no-store",
      });
    } catch {
      // silencieux — le seed peut échouer lors du premier render
    }
  }
}

export default async function HomePage() {
  await ensureSeed();

  const user = await getCurrentUser();
  if (!user) {
    return <HomeMarketing />;
  }

  // Connecté : le fil d'actualité prend la place de la landing
  return <SocialFeed initialProfile={null} />;
}
