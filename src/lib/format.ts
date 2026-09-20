// ============================================================
// UTILITAIRES DE FORMATAGE — AfricaSkills
// ============================================================

/**
 * Formate un montant en FCFA avec séparateur de milliers.
 * Ex: 45000 → "45 000 FCFA"
 */
export function formatXof(amount: number): string {
  return `${new Intl.NumberFormat("fr-FR").format(amount)} FCFA`;
}

/**
 * Retourne une note formatée sur 5 avec une décimale.
 * Ex: 48 (sur 50) → "4.8"
 */
export function formatRating(rating: number): string {
  return (rating / 10).toFixed(1);
}

/**
 * Formate un nombre d'étudiants.
 * Ex: 1243 → "1.2K", 512 → "512"
 */
export function formatStudents(count: number): string {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count.toString();
}

/**
 * Retourne une classe Tailwind de couleur selon la rareté du badge.
 */
export function rarityColor(
  rarity: "common" | "rare" | "epic" | "legendary"
): string {
  switch (rarity) {
    case "common":
      return "from-slate-400 to-slate-600";
    case "rare":
      return "from-sky-400 to-blue-600";
    case "epic":
      return "from-purple-400 to-fuchsia-600";
    case "legendary":
      return "from-amber-400 via-orange-500 to-red-600";
  }
}

/**
 * Libellé français pour un niveau de cours.
 */
export function levelLabel(
  level: "beginner" | "intermediate" | "advanced" | "expert"
): string {
  switch (level) {
    case "beginner":
      return "Débutant";
    case "intermediate":
      return "Intermédiaire";
    case "advanced":
      return "Avancé";
    case "expert":
      return "Expert";
  }
}

/**
 * Libellé français pour un type d'emploi.
 */
export function jobTypeLabel(
  type: "full_time" | "part_time" | "freelance" | "internship" | "contract"
): string {
  switch (type) {
    case "full_time":
      return "Temps plein";
    case "part_time":
      return "Temps partiel";
    case "freelance":
      return "Freelance";
    case "internship":
      return "Stage";
    case "contract":
      return "CDD / Mission";
  }
}

/**
 * Temps relatif en français ("il y a 5 min", "il y a 2 j"…).
 * À appeler hors du rendu (handlers, callbacks) — utilise Date.now().
 */
export function relativeTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const diffSec = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
  if (diffSec < 60) return "à l'instant";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `il y a ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `il y a ${diffH} h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 30) return `il y a ${diffD} j`;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

/**
 * Génère un slug URL-friendly à partir d'une chaîne.
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export type ApplicationStatus =
  | "pending"
  | "reviewed"
  | "shortlisted"
  | "interview"
  | "accepted"
  | "rejected"
  | "withdrawn";

/**
 * Libellé français pour un statut de candidature.
 */
export function applicationStatusLabel(status: ApplicationStatus): string {
  switch (status) {
    case "pending":
      return "En attente";
    case "reviewed":
      return "Examinée";
    case "shortlisted":
      return "Présélectionnée";
    case "interview":
      return "Entretien";
    case "accepted":
      return "Acceptée 🎉";
    case "rejected":
      return "Refusée";
    case "withdrawn":
      return "Retirée";
  }
}

/**
 * Classes Tailwind associées à un statut de candidature.
 */
export function applicationStatusColor(status: ApplicationStatus): string {
  switch (status) {
    case "pending":
      return "bg-amber-500/15 text-amber-300 border-amber-500/30";
    case "reviewed":
      return "bg-sky-500/15 text-sky-300 border-sky-500/30";
    case "shortlisted":
      return "bg-violet-500/15 text-violet-300 border-violet-500/30";
    case "interview":
      return "bg-blue-500/15 text-blue-300 border-blue-500/30";
    case "accepted":
      return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
    case "rejected":
      return "bg-red-500/15 text-red-300 border-red-500/30";
    case "withdrawn":
      return "bg-neutral-500/15 text-neutral-400 border-neutral-600";
  }
}
