// ============================================================
// AUTH CONTEXT + HOOK useAuth
// Gère l'état global de l'authentification côté client.
// ============================================================

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export interface AuthUser {
  id: string;
  email: string | null;
  phone: string | null;
  fullName: string;
  role: "student" | "instructor" | "mentor" | "company" | "admin";
  avatarUrl: string | null;
  emailVerified: boolean | null;
  phoneVerified: boolean | null;
  twoFactorEnabled: boolean | null;
}

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthContextValue extends AuthState {
  login: (identifier: string, password: string, totpCode?: string) => Promise<LoginResult>;
  registerEmail: (data: {
    email: string;
    fullName: string;
    password: string;
  }) => Promise<RegisterResult>;
  registerPhone: (data: {
    phone: string;
    fullName: string;
    password: string;
  }) => Promise<RegisterResult>;
  verifyOtp: (userId: string, code: string, type: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
}

export interface LoginResult {
  ok: boolean;
  error?: string;
  user?: AuthUser;
  require2fa?: boolean;
  userId?: string;
}

export interface RegisterResult {
  ok: boolean;
  error?: string;
  userId?: string;
  devOtp?: string;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
  });

  // Au chargement, récupérer le profil via /api/v1/profiles/me
  const refreshMe = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/profiles/me", { credentials: "include" });
      if (!res.ok) {
        setState({ user: null, isLoading: false, isAuthenticated: false });
        return;
      }
      const data = await res.json();
      if (data.ok && data.profile) {
        const p = data.profile;
        setState({
          user: {
            id: p.id,
            email: p.email,
            phone: p.phone,
            fullName: p.fullName,
            role: p.role,
            avatarUrl: p.avatarUrl,
            emailVerified: p.emailVerified,
            phoneVerified: p.phoneVerified,
            twoFactorEnabled: p.twoFactorEnabled,
          },
          isLoading: false,
          isAuthenticated: true,
        });
      } else {
        setState({ user: null, isLoading: false, isAuthenticated: false });
      }
    } catch {
      setState({ user: null, isLoading: false, isAuthenticated: false });
    }
  }, []);

  useEffect(() => {
    refreshMe();
  }, [refreshMe]);

  // Auto-refresh du token toutes les 12 minutes
  useEffect(() => {
    if (!state.isAuthenticated) return;
    const interval = setInterval(async () => {
      await fetch("/api/v1/auth/refresh", {
        method: "POST",
        credentials: "include",
      }).catch(() => {});
    }, 12 * 60 * 1000);
    return () => clearInterval(interval);
  }, [state.isAuthenticated]);

  const login = useCallback(
    async (identifier: string, password: string, totpCode?: string): Promise<LoginResult> => {
      const res = await fetch("/api/v1/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password, totpCode }),
      });
      const data = await res.json();
      if (data.ok) {
        await refreshMe();
        return { ok: true, user: data.user };
      }
      return {
        ok: false,
        error: data.error,
        require2fa: data.require2fa,
        userId: data.userId,
      };
    },
    [refreshMe]
  );

  const registerEmail = useCallback(async (data: {
    email: string;
    fullName: string;
    password: string;
  }): Promise<RegisterResult> => {
    const res = await fetch("/api/v1/auth/register/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    return {
      ok: json.ok,
      error: json.error,
      userId: json.userId,
      devOtp: json.devOtp,
    };
  }, []);

  const registerPhone = useCallback(async (data: {
    phone: string;
    fullName: string;
    password: string;
  }): Promise<RegisterResult> => {
    const res = await fetch("/api/v1/auth/register/phone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    return {
      ok: json.ok,
      error: json.error,
      userId: json.userId,
      devOtp: json.devOtp,
    };
  }, []);

  const verifyOtp = useCallback(
    async (userId: string, code: string, type: string) => {
      const res = await fetch("/api/v1/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, code, type }),
      });
      const json = await res.json();
      if (json.ok) await refreshMe();
      return { ok: json.ok, error: json.error };
    },
    [refreshMe]
  );

  const logout = useCallback(async () => {
    await fetch("/api/v1/auth/logout", {
      method: "POST",
      credentials: "include",
    }).catch(() => {});
    setState({ user: null, isLoading: false, isAuthenticated: false });
  }, []);

  const value = useMemo(
    () => ({
      ...state,
      login,
      registerEmail,
      registerPhone,
      verifyOtp,
      logout,
      refreshMe,
    }),
    [state, login, registerEmail, registerPhone, verifyOtp, logout, refreshMe]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé dans un <AuthProvider>");
  return ctx;
}
