// ============================================================
// PAGE — Inscription (email ou téléphone)
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
  SuccessBox,
  SocialButtons,
  inputClass,
} from "@/components/ui/Auth";

export default function RegisterPage() {
  const router = useRouter();
  const { registerEmail, registerPhone } = useAuth();
  const [mode, setMode] = useState<"email" | "phone">("email");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    userId: string;
    devOtp?: string;
  } | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result =
        mode === "email"
          ? await registerEmail({ email, fullName, password })
          : await registerPhone({ phone, fullName, password });

      if (result.ok && result.userId) {
        setSuccess({ userId: result.userId, devOtp: result.devOtp });
      } else {
        setError(result.error ?? "Erreur d'inscription");
      }
    } catch {
      setError("Erreur réseau");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <AuthLayout
        title="Vérifie ta boîte 📬"
        subtitle={`Un code OTP a été envoyé ${
          mode === "email" ? "à ton email" : "par SMS"
        }.`}
      >
        <VerifyOtpForm
          userId={success.userId}
          devOtp={success.devOtp}
          type={mode === "email" ? "email_verification" : "phone_verification"}
        />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Rejoins AfricaSkills 🌍"
      subtitle="Crée ton compte en 30 secondes."
    >
      <div className="mb-5 flex gap-2 rounded-xl bg-black p-1">
        <TabBtn active={mode === "email"} onClick={() => setMode("email")}>
          📧 Email
        </TabBtn>
        <TabBtn active={mode === "phone"} onClick={() => setMode("phone")}>
          📱 Téléphone
        </TabBtn>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Nom complet">
          <input
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Kwame Mensah"
            className={inputClass}
          />
        </Field>

        {mode === "email" ? (
          <Field label="Email">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="toi@email.com"
              className={inputClass}
            />
          </Field>
        ) : (
          <Field label="Téléphone">
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+229 01 00 00 00"
              className={inputClass}
            />
          </Field>
        )}

        <Field label="Mot de passe">
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Min. 8 caractères, 1 maj, 1 chiffre"
            className={inputClass}
          />
          <p className="mt-1.5 text-[11px] text-neutral-500">
            Le mot de passe doit contenir au moins 8 caractères, 1 majuscule et
            1 chiffre.
          </p>
        </Field>

        {error && <ErrorBox message={error} />}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 py-3.5 text-sm font-bold text-black shadow-lg shadow-orange-500/30 transition hover:from-orange-400 hover:to-amber-400 disabled:opacity-50"
        >
          {loading ? "Création..." : "Créer mon compte →"}
        </button>

        <div className="relative py-1 text-center">
          <span className="relative z-10 bg-neutral-950 px-3 text-xs text-neutral-500">
            ou
          </span>
          <div className="absolute inset-x-0 top-1/2 h-px bg-neutral-800" />
        </div>

        <SocialButtons />

        <p className="text-center text-sm text-neutral-400">
          Déjà inscrit ?{" "}
          <Link
            href="/auth/login"
            className="font-bold text-orange-400 hover:text-orange-300"
          >
            Se connecter
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
        active
          ? "bg-gradient-to-r from-orange-500 to-amber-500 text-black"
          : "text-neutral-400 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function VerifyOtpForm({
  userId,
  devOtp,
  type,
}: {
  userId: string;
  devOtp?: string;
  type: string;
}) {
  const router = useRouter();
  const { verifyOtp } = useAuth();
  const [code, setCode] = useState(devOtp ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await verifyOtp(userId, code, type);
    setLoading(false);
    if (res.ok) {
      router.push("/dashboard");
    } else {
      setError(res.error ?? "Code incorrect");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label="Code à 6 chiffres">
        <input
          type="text"
          inputMode="numeric"
          maxLength={6}
          required
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          placeholder="123456"
          className={`${inputClass} text-center text-2xl tracking-[0.5em]`}
          autoFocus
        />
      </Field>

      {devOtp && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
          <span className="font-bold">🛠️ Mode dev :</span> ton code est{" "}
          <code className="font-mono font-bold">{devOtp}</code>
        </div>
      )}

      {error && <ErrorBox message={error} />}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 py-3.5 text-sm font-bold text-black"
      >
        {loading ? "Vérification..." : "Vérifier →"}
      </button>

      <button
        type="button"
        className="w-full text-center text-xs font-semibold text-neutral-400 hover:text-white"
      >
        Je n'ai pas reçu le code · Renvoyer
      </button>
    </form>
  );
}
