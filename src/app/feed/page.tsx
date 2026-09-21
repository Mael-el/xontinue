// ============================================================
// /feed — FIL D'ACTUALITÉ (alias explicite de l'accueil connecté)
// Réservé aux membres : un visiteur anonyme est renvoyé vers la
// connexion (avec retour sur /feed après login).
// ============================================================

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { SocialFeed } from "@/components/feed/SocialFeed";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Fil d'actualité — AfricaSkills",
};

export default async function FeedPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login?next=/feed");

  return <SocialFeed initialProfile={null} />;
}
