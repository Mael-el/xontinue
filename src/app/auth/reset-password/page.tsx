// ============================================================
// PAGE — Réinitialisation du mot de passe (avec token)
// ============================================================

"use client";

import { useState, FormEvent, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AuthLayout,
  Field,
  ErrorBox,
  SuccessBox,
  inputClass,
} from "@/components/ui/Auth";

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <AuthLayout title="..." subtitle="Chargement">
          <div />
        </AuthLayout>
      }
    >
      <ResetPasswordInner />
    </Suspense>
  );
}

function ResetPasswordInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!token) {
    return (
      <AuthLayout title="Lien invalide" subtitle="">
        <ErrorBox message="Ce lien de réinitialisation est invalide." />
        <Link
          href="/auth/forgot-password"
          className="mt-4 block w-full rounded-xl bg-orange-500 py-3 text-center text-sm font-bold text-black"
        >
          Demander un nouveau lien
        </Link>
      </AuthLayout>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Les mots de passe ne correspondent pas");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/v1/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: password }),
      });
      const data = await res.json();
      if (data.ok) {
        setDone(true);
        setTimeout(() => router.push("/auth/login"), 2000);
      } else {
        setError(data.error ?? "Erreur");
      }
    } catch {
      setError("Erreur réseau");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <AuthLayout title="Mot de passe changé 🎉" subtitle="">
        <SuccessBox message="Ton mot de passe a été réinitialisé. Redirection vers la connexion..." />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Nouveau mot de passe"
      subtitle="Choisis un mot de passe fort et unique."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Nouveau mot de passe">
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Min. 8 caractères"
            className={inputClass}
            autoFocus
          />
        </Field>
        <Field label="Confirmer">
          <input
            type="password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Retape le mot de passe"
            className={inputClass}
          />
        </Field>

        {error && <ErrorBox message={error} />}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 py-3.5 text-sm font-bold text-black disabled:opacity-50"
        >
          {loading ? "..." : "Réinitialiser →"}
        </button>
      </form>
    </AuthLayout>
  );
}
