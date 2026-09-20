// ============================================================
// COMPOSANT CLIENT — ACTIONS DU CERTIFICAT
// Imprimer (dialogue navigateur → PDF), Partager (Web Share API
// avec repli presse-papiers), Copier le lien de vérification.
// ============================================================

"use client";

import { useRef, useState } from "react";

export function CertificateActions({ courseTitle }: { courseTitle: string }) {
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(message: string) {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }

  /** Copie l'URL de vérification dans le presse-papiers. */
  async function copyLink(): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(window.location.href);
      return true;
    } catch {
      return false;
    }
  }

  /** Partage natif si disponible, sinon copie du lien. */
  async function handleShare() {
    const shareData = {
      title: `Certificat AfricaSkills — ${courseTitle}`,
      text: `J'ai terminé la formation « ${courseTitle} » sur AfricaSkills ! 🏆`,
      url: window.location.href,
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch {
        // Partage annulé ou non abouti → on ne fait rien
        return;
      }
    }
    const copied = await copyLink();
    showToast(copied ? "🔗 Lien copié dans le presse-papiers !" : "Copie impossible sur ce navigateur");
  }

  async function handleCopy() {
    const copied = await copyLink();
    showToast(copied ? "🔗 Lien copié !" : "Copie impossible sur ce navigateur");
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleShare}
        className="rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-2.5 text-xs font-bold text-black transition hover:from-orange-400 hover:to-amber-400"
      >
        📤 Partager
      </button>
      <button
        onClick={() => window.print()}
        className="rounded-xl border border-neutral-700 px-4 py-2.5 text-xs font-bold text-neutral-200 transition hover:border-emerald-500/50 hover:text-emerald-300"
      >
        🖨️ Imprimer / PDF
      </button>
      <button
        onClick={handleCopy}
        className="rounded-xl border border-neutral-700 px-4 py-2.5 text-xs font-bold text-neutral-200 transition hover:border-sky-500/50 hover:text-sky-300"
      >
        🔗 Copier le lien
      </button>
      {toast && (
        <span className="rounded-lg bg-neutral-900 px-3 py-2 text-xs text-emerald-300">
          {toast}
        </span>
      )}
    </div>
  );
}
