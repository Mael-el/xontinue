// ============================================================
// STORE ZUSTAND — État UI d'authentification
// Complète le contexte React avec des préférences persistées.
// ============================================================

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AuthUIState {
  rememberMe: boolean;
  lastIdentifier: string;
  theme: "dark" | "light" | "system";
  setRememberMe: (v: boolean) => void;
  setLastIdentifier: (v: string) => void;
  setTheme: (t: "dark" | "light" | "system") => void;
}

export const useAuthUIStore = create<AuthUIState>()(
  persist(
    (set) => ({
      rememberMe: true,
      lastIdentifier: "",
      theme: "dark",
      setRememberMe: (v) => set({ rememberMe: v }),
      setLastIdentifier: (v) => set({ lastIdentifier: v }),
      setTheme: (t) => set({ theme: t }),
    }),
    { name: "africaskills-auth-ui" }
  )
);

// ============================================================
// STORE DASHBOARD — Filtres et préférences du dashboard
// ============================================================

interface DashboardState {
  view: "grid" | "list";
  timeRange: "7d" | "30d" | "90d" | "all";
  selectedDomain: string | null;
  setView: (v: "grid" | "list") => void;
  setTimeRange: (t: "7d" | "30d" | "90d" | "all") => void;
  setSelectedDomain: (d: string | null) => void;
}

export const useDashboardStore = create<DashboardState>()((set) => ({
  view: "grid",
  timeRange: "30d",
  selectedDomain: null,
  setView: (v) => set({ view: v }),
  setTimeRange: (t) => set({ timeRange: t }),
  setSelectedDomain: (d) => set({ selectedDomain: d }),
}));
