// ============================================================
// PAGE — Connexion
// ============================================================

"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/context";
import {
  AuthLayout,
  Field,
  ErrorBox,
  SocialButtons,
  inputClass,
} from "@/components/ui/Auth";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [require2fa, setRequire2fa] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await login(identifier, password, totpCode || undefined);
      if (result.ok) {
        router.push("/dashboard");
      } else if (result.require2fa) {
        setRequire2fa(true);
        setError("Entre le code 2FA de ton application d'authentification.");
      } else {
        setError(result.error ?? "Erreur de connexion");
      }
    } catch {
      setError("Erreur réseau");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Bon retour 👋🏾"
      subtitle="Connecte-toi pour reprendre ta formation."
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <Field label="Email ou téléphone">
          <input
            type="text"
            required
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="toi@email.com ou +229 01 00 00 00"
            className={inputClass}
          />
        </Field>

        <Field
          label="Mot de passe"
          right={
            <Link
              href="/auth/forgot-password"
              className="text-xs font-semibold text-orange-400 hover:text-orange-300"
            >
              Mot de passe oublié ?
            </Link>
          }
        >
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className={inputClass}
          />
        </Field>

        {require2fa && (
          <Field label="Code 2FA (6 chiffres)">
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ""))}
              placeholder="123456"
              className={inputClass}
              autoFocus
            />
          </Field>
        )}

        {error && <ErrorBox message={error} />}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 py-3.5 text-sm font-bold text-black shadow-lg shadow-orange-500/30 transition hover:from-orange-400 hover:to-amber-400 disabled:opacity-50"
        >
          {loading ? "Connexion..." : "Se connecter →"}
        </button>

        <div className="relative py-2 text-center">
          <span className="relative z-10 bg-neutral-950 px-3 text-xs text-neutral-500">
            ou
          </span>
          <div className="absolute inset-x-0 top-1/2 h-px bg-neutral-800" />
        </div>

        <SocialButtons />

        <p className="text-center text-sm text-neutral-400">
          Pas encore de compte ?{" "}
          <Link
            href="/auth/register"
            className="font-bold text-orange-400 hover:text-orange-300"
          >
            S'inscrire gratuitement
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
