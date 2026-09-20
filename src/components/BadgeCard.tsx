// ============================================================
// CARTE DE BADGE — AfricaSkills
// ============================================================

import { rarityColor } from "@/lib/format";

export interface BadgeCardProps {
  name: string;
  description: string | null;
  icon: string | null;
  rarity: "common" | "rare" | "epic" | "legendary";
  requiredXp: number;
  domain?: { name: string; icon: string | null } | null;
  earned?: boolean;
}

export function BadgeCard({
  name,
  description,
  icon,
  rarity,
  requiredXp,
  domain,
  earned,
}: BadgeCardProps) {
  const rarityLabel = {
    common: "Commun",
    rare: "Rare",
    epic: "Épique",
    legendary: "Légendaire",
  }[rarity];

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border ${
        earned ? "border-orange-500/50" : "border-neutral-800"
      } bg-gradient-to-br from-neutral-900 to-neutral-950 p-6`}
    >
      <div
        className={`absolute -left-8 -top-8 h-32 w-32 rounded-full bg-gradient-to-br ${rarityColor(
          rarity
        )} opacity-20 blur-2xl`}
      />

      <div className="relative">
        <div className="flex items-start justify-between">
          <div
            className={`flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${rarityColor(
              rarity
            )} text-4xl shadow-xl`}
          >
            {icon ?? "🏆"}
          </div>
          <span
            className={`rounded-full bg-gradient-to-r ${rarityColor(
              rarity
            )} px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white`}
          >
            {rarityLabel}
          </span>
        </div>

        <h3 className="mt-4 text-lg font-bold text-white">{name}</h3>
        {description && (
          <p className="mt-1 text-sm text-neutral-400">{description}</p>
        )}

        <div className="mt-4 flex items-center justify-between text-xs">
          {domain ? (
            <span className="text-neutral-500">
              {domain.icon} {domain.name}
            </span>
          ) : (
            <span />
          )}
          <span className="font-semibold text-amber-400">
            ⚡ {requiredXp.toLocaleString("fr-FR")} XP
          </span>
        </div>

        {earned ? (
          <div className="mt-4 rounded-lg bg-emerald-500/10 px-3 py-2 text-center text-xs font-semibold text-emerald-400">
            ✓ Obtenu
          </div>
        ) : (
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-neutral-800">
            <div
              className={`h-full bg-gradient-to-r ${rarityColor(rarity)}`}
              style={{ width: `${Math.min(15, (100 * 150) / Math.max(requiredXp, 1))}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
