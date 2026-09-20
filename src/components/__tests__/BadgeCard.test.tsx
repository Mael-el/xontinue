// ============================================================
// TESTS — Composant BadgeCard (Testing Library)
// ============================================================

import { render, screen } from "@testing-library/react";
import { BadgeCard } from "@/components/BadgeCard";

describe("BadgeCard", () => {
  const base = {
    name: "Premier pas",
    description: "Termine ta première leçon",
    icon: "🎯",
    rarity: "common" as const,
    requiredXp: 50,
  };

  it("affiche nom, description, icône et rareté", () => {
    render(<BadgeCard {...base} />);
    expect(screen.getByText("Premier pas")).toBeInTheDocument();
    expect(
      screen.getByText("Termine ta première leçon")
    ).toBeInTheDocument();
    expect(screen.getByText("🎯")).toBeInTheDocument();
    expect(screen.getByText("Commun")).toBeInTheDocument();
  });

  it("affiche le seuil d'XP requis", () => {
    render(<BadgeCard {...base} requiredXp={1500} />);
    expect(screen.getByText(/1.?500/)).toBeInTheDocument();
    expect(screen.getByText(/XP/)).toBeInTheDocument();
  });

  it("affiche « ✓ Obtenu » quand le badge est débloqué", () => {
    render(<BadgeCard {...base} earned />);
    expect(screen.getByText(/Obtenu/)).toBeInTheDocument();
  });

  it("n'affiche pas « Obtenu » quand le badge n'est pas débloqué", () => {
    render(<BadgeCard {...base} earned={false} />);
    expect(screen.queryByText(/Obtenu/)).not.toBeInTheDocument();
  });

  it("affiche le domaine quand fourni", () => {
    render(
      <BadgeCard
        {...base}
        domain={{ name: "Anglais", icon: "🇬🇧" }}
      />
    );
    expect(screen.getByText(/Anglais/)).toBeInTheDocument();
  });

  it("utilise l'icône 🏆 par défaut et traduit les raretés", () => {
    render(<BadgeCard {...base} icon={null} rarity="legendary" />);
    expect(screen.getByText("🏆")).toBeInTheDocument();
    expect(screen.getByText("Légendaire")).toBeInTheDocument();
  });
});
