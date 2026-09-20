// ============================================================
// PAGE — Mot de passe oublié
// ============================================================

"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import {
  AuthLayout,
  Field,
  ErrorBox,
  SuccessBox,
  inputClass,
} from "@/components/ui/Auth";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (data.ok) setSent(true);
      else setError(data.error ?? "Erreur");
    } catch {
      setError("Erreur réseau");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Mot de passe oublié 🔑"
      subtitle="On va t'envoyer un lien de réinitialisation."
    >
      {sent ? (
        <div className="space-y-4">
          <SuccessBox message="Si un compte existe avec cet email, un lien de réinitialisation a été envoyé." />
          <p className="text-sm text-neutral-400">
            Vérifie ta boîte de réception (et les spams). Le lien est valide 1
            heure.
          </p>
          <Link
            href="/auth/login"
            className="block w-full rounded-xl border border-neutral-700 py-3 text-center text-sm font-semibold text-white hover:border-white/30"
          >
            Retour à la connexion
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Email du compte">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="toi@email.com"
              className={inputClass}
              autoFocus
            />
          </Field>

          {error && <ErrorBox message={error} />}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 py-3.5 text-sm font-bold text-black disabled:opacity-50"
          >
            {loading ? "Envoi..." : "Envoyer le lien →"}
          </button>

          <Link
            href="/auth/login"
            className="block text-center text-sm text-neutral-400 hover:text-white"
          >
            ← Retour à la connexion
          </Link>
        </form>
      )}
    </AuthLayout>
  );
}
