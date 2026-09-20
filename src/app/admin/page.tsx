// ============================================================
// PAGE — ADMINISTRATION (rôle admin uniquement, sinon 404)
// Vue d'ensemble, modération des avis, gestion des utilisateurs.
// ============================================================

import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { AdminOverview } from "./AdminOverview";
import { AdminReviewsSection } from "./AdminReviewsSection";
import { AdminUsersSection } from "./AdminUsersSection";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const current = await getCurrentUser();
  if (!current || current.role !== "admin") notFound();

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      {/* En-tête */}
      <div className="mb-8">
        <div className="text-xs font-bold uppercase tracking-[0.2em] text-orange-500">
          Back-office
        </div>
        <h1 className="mt-2 text-3xl font-black text-white sm:text-4xl">
          🛠️ Administration
        </h1>
        <p className="mt-2 text-sm text-neutral-400">
          Pilote la plateforme : statistiques en temps réel, modération des
          avis et gestion des comptes.
        </p>
      </div>

      <AdminOverview />
      <AdminReviewsSection />
      <AdminUsersSection currentUserId={current.userId} />
    </div>
  );
}
