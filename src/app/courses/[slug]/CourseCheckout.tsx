// ============================================================
// COMPOSANT CLIENT — CHECKOUT D'UN COURS (MOBILE MONEY)
//
// Flux v1 (utilisateur connecté) :
//   1. POST /api/v1/payments → paiement "pending" + instructions
//   2. Confirmation (démo : bouton de simulation ; production :
//      webhook provider) → paiement "success" + inscription
// Flux public (non connecté) : repli sur le mock legacy /api/payments.
// ============================================================

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatXof } from "@/lib/format";

interface Props {
  priceXof: number;
  courseSlug: string;
  courseTitle: string;
}

const PAYMENT_METHODS = [
  { id: "mtn_mobile_money", label: "MTN Mobile Money", icon: "🟡", color: "border-yellow-500" },
  { id: "orange_money", label: "Orange Money", icon: "🟠", color: "border-orange-500" },
  { id: "moov_money", label: "Moov Money", icon: "🔵", color: "border-blue-500" },
  { id: "fedapay", label: "FedaPay (carte)", icon: "💳", color: "border-purple-500" },
  { id: "kkiapay", label: "KkiaPay", icon: "⚡", color: "border-emerald-500" },
] as const;

interface PendingPayment {
  reference: string;
  amountXof: number;
  instructions: string | null;
  demo: boolean;
}

export function CourseCheckout({ priceXof, courseSlug, courseTitle }: Props) {
  const router = useRouter();
  const [method, setMethod] = useState<string>("mtn_mobile_money");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [enrollLoading, setEnrollLoading] = useState(false);
  const [enrollError, setEnrollError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingPayment | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<null | {
    ok: boolean;
    message: string;
    reference?: string;
    alreadyOwned?: boolean;
  }>(null);

  /** Inscription gratuite via l'API v1, puis espace d'apprentissage. */
  async function handleFreeEnroll() {
    setEnrollLoading(true);
    setEnrollError(null);
    try {
      const res = await fetch("/api/v1/enrollments", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseSlug }),
      });
      if (res.status === 401) {
        router.push("/auth/login");
        return;
      }
      const data = await res.json();
      if (data.ok) {
        router.push(`/courses/${courseSlug}/learn`);
        return;
      }
      setEnrollError(data.error ?? "Impossible de s'inscrire");
    } catch {
      setEnrollError("Erreur réseau. Réessaie plus tard.");
    } finally {
      setEnrollLoading(false);
    }
  }

  /** Initiation du paiement (v1 authentifié, sinon repli public). */
  async function handlePay(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/v1/payments", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseSlug, method, phoneNumber: phone }),
      });

      // Non connecté → flux public legacy (démo sans compte)
      if (res.status === 401) {
        await handleLegacyPay();
        return;
      }

      const data = await res.json();

      if (data.ok) {
        // Paiement initié → attente de confirmation
        setPending({
          reference: data.payment.reference,
          amountXof: data.payment.amountXof,
          instructions: data.instructions ?? null,
          demo: Boolean(data.demo),
        });
        return;
      }

      if (res.status === 409 && (data.alreadyEnrolled || data.alreadyPaid)) {
        setResult({
          ok: true,
          alreadyOwned: true,
          message: data.error ?? "Tu as déjà accès à ce cours.",
        });
        return;
      }

      setResult({ ok: false, message: data.error ?? "Erreur de paiement" });
    } catch {
      setResult({ ok: false, message: "Erreur réseau. Réessaie plus tard." });
    } finally {
      setLoading(false);
    }
  }

  /** Repli public (non connecté) : mock legacy, succès immédiat. */
  async function handleLegacyPay() {
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseSlug, phoneNumber: phone, method }),
      });
      const data = await res.json();
      if (data.ok) {
        setResult({
          ok: true,
          message: `${data.message} Connecte-toi avec ce numéro pour retrouver ton inscription.`,
          reference: data.payment?.reference,
        });
        setPhone("");
      } else {
        setResult({ ok: false, message: data.error ?? "Erreur de paiement" });
      }
    } catch {
      setResult({ ok: false, message: "Erreur réseau. Réessaie plus tard." });
    }
  }

  /** Simulation de la confirmation Mobile Money (mode démo/mock). */
  async function handleConfirm(outcome: "success" | "failed") {
    if (!pending || confirming) return;
    setConfirming(true);
    try {
      const res = await fetch(
        `/api/v1/payments/${pending.reference}/confirm`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ outcome }),
        }
      );
      const data = await res.json();
      if (data.ok && data.payment?.status === "success") {
        setPending(null);
        setResult({
          ok: true,
          message: `Paiement confirmé ! Bienvenue dans ${courseTitle}.`,
          reference: pending.reference,
        });
      } else if (data.ok && data.payment?.status === "failed") {
        setPending(null);
        setResult({
          ok: false,
          message: "Paiement refusé (simulation). Réessaie avec un autre numéro.",
        });
      } else {
        setResult({ ok: false, message: data.error ?? "Erreur de confirmation" });
      }
    } catch {
      setResult({ ok: false, message: "Erreur réseau. Réessaie plus tard." });
    } finally {
      setConfirming(false);
    }
  }

  // ----------------------------------------------------------
  // Cours gratuit
  // ----------------------------------------------------------

  if (priceXof === 0) {
    return (
      <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-transparent p-6">
        <div className="text-xs font-bold uppercase tracking-wider text-emerald-400">
          Formation gratuite
        </div>
        <div className="mt-2 text-4xl font-black text-white">0 FCFA</div>
        <button
          onClick={handleFreeEnroll}
          disabled={enrollLoading}
          className="mt-5 w-full rounded-xl bg-emerald-500 px-4 py-3.5 text-sm font-bold text-black transition hover:bg-emerald-400 disabled:opacity-50"
        >
          {enrollLoading ? "⏳ Inscription…" : "Commencer gratuitement"}
        </button>
        {enrollError && (
          <p className="mt-3 rounded-lg bg-red-500/10 p-3 text-xs text-red-300">
            {enrollError}
          </p>
        )}
        <p className="mt-3 text-center text-[11px] text-neutral-500">
          🔐 Connexion requise pour suivre ta progression
        </p>
      </div>
    );
  }

  // ----------------------------------------------------------
  // Paiement en attente de confirmation
  // ----------------------------------------------------------

  if (pending) {
    return (
      <div className="rounded-2xl border border-amber-500/40 bg-gradient-to-br from-amber-500/10 to-transparent p-6">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-400">
          <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" />
          En attente de confirmation
        </div>
        <div className="mt-2 text-2xl font-black text-white">
          {formatXof(pending.amountXof)}
        </div>
        {pending.instructions && (
          <p className="mt-3 text-sm leading-relaxed text-neutral-300">
            {pending.instructions}
          </p>
        )}
        <p className="mt-2 font-mono text-[11px] text-neutral-500">
          Réf : {pending.reference}
        </p>

        {pending.demo && (
          <div className="mt-5 space-y-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
              🧪 Mode démo — simule la réponse du téléphone
            </div>
            <button
              onClick={() => handleConfirm("success")}
              disabled={confirming}
              className="w-full rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-black transition hover:bg-emerald-400 disabled:opacity-50"
            >
              {confirming ? "⏳…" : "📱 Confirmer sur le téléphone"}
            </button>
            <button
              onClick={() => handleConfirm("failed")}
              disabled={confirming}
              className="w-full rounded-xl border border-neutral-700 px-4 py-2.5 text-xs font-semibold text-neutral-400 transition hover:border-red-500/40 hover:text-red-400 disabled:opacity-50"
            >
              Simuler un refus
            </button>
          </div>
        )}
        {!pending.demo && (
          <p className="mt-5 text-xs text-neutral-500">
            La confirmation arrive automatiquement une fois le paiement validé
            sur ton téléphone.
          </p>
        )}

        <button
          onClick={() => setPending(null)}
          className="mt-3 w-full text-center text-[11px] text-neutral-600 underline underline-offset-2 hover:text-neutral-400"
        >
          Annuler et changer de méthode
        </button>
      </div>
    );
  }

  // ----------------------------------------------------------
  // Formulaire d'initiation
  // ----------------------------------------------------------

  return (
    <form
      onSubmit={handlePay}
      className="rounded-2xl border border-neutral-800 bg-gradient-to-b from-neutral-900 to-neutral-950 p-6 shadow-xl"
    >
      <div className="flex items-baseline justify-between">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-neutral-500">
            Prix unique
          </div>
          <div className="text-3xl font-black text-white">
            {formatXof(priceXof)}
          </div>
        </div>
        <span className="rounded-full bg-orange-500/20 px-3 py-1 text-xs font-bold text-orange-400">
          -40% promo
        </span>
      </div>

      <div className="mt-5">
        <div className="mb-2 text-xs font-bold uppercase tracking-wider text-neutral-500">
          Méthode de paiement
        </div>
        <div className="space-y-2">
          {PAYMENT_METHODS.map((m) => (
            <label
              key={m.id}
              className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 px-3 py-2.5 text-sm transition ${
                method === m.id
                  ? `${m.color} bg-black/50`
                  : "border-neutral-800 hover:border-neutral-700"
              }`}
            >
              <input
                type="radio"
                name="method"
                value={m.id}
                checked={method === m.id}
                onChange={() => setMethod(m.id)}
                className="accent-orange-500"
              />
              <span className="text-lg">{m.icon}</span>
              <span className="font-semibold text-white">{m.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="mt-5">
        <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-neutral-500">
          Numéro Mobile Money
        </label>
        <input
          type="tel"
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+229 01 00 00 00"
          className="w-full rounded-xl border border-neutral-800 bg-black px-4 py-3 text-white placeholder-neutral-500 outline-none transition focus:border-orange-500"
        />
        <p className="mt-1.5 text-[11px] text-neutral-500">
          Tu recevras une notification sur ton téléphone pour confirmer.
        </p>
      </div>

      <button
        type="submit"
        disabled={loading || !phone}
        className="mt-5 w-full rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-3.5 text-sm font-bold text-black shadow-lg shadow-orange-500/30 transition hover:from-orange-400 hover:to-amber-400 disabled:opacity-50"
      >
        {loading ? "⏳ Traitement..." : `Payer ${formatXof(priceXof)}`}
      </button>

      {result && (
        <div
          className={`mt-4 rounded-xl p-4 text-sm ${
            result.ok
              ? "bg-emerald-500/10 text-emerald-300"
              : "bg-red-500/10 text-red-300"
          }`}
        >
          <div className="font-bold">
            {result.ok ? "✓ Paiement réussi !" : "✗ Échec du paiement"}
          </div>
          <div className="mt-1 text-xs">{result.message}</div>
          {result.reference && (
            <div className="mt-2 font-mono text-[11px] text-neutral-400">
              Réf : {result.reference}
            </div>
          )}
          {result.ok && (
            <Link
              href={`/courses/${courseSlug}/learn`}
              className="mt-3 block rounded-lg bg-emerald-500 px-4 py-2.5 text-center text-xs font-bold text-black transition hover:bg-emerald-400"
            >
              🎓 Accéder au cours
            </Link>
          )}
        </div>
      )}

      <div className="mt-4 text-center text-[11px] text-neutral-500">
        🔒 Paiement sécurisé · {courseTitle}
      </div>
    </form>
  );
}
