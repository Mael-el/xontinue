// ============================================================
// PAGE — Aperçu + acceptation d'une invitation workspace
// /workspaces/invite/[code]
// ============================================================

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/context";

interface InvitePreview {
  workspace: {
    id: string;
    name: string;
    icon: string | null;
    description: string | null;
    memberCount: number;
  };
  valid: boolean;
  message: string | null;
  alreadyMember: boolean;
}

export default function InvitePage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace(`/auth/login?next=${encodeURIComponent(`/workspaces/invite/${params.code}`)}`);
    }
  }, [isLoading, isAuthenticated, router, params.code]);

  useEffect(() => {
    if (!isAuthenticated) return;
    void fetch(`/api/v1/workspaces/invite/${encodeURIComponent(params.code)}`)
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error ?? "Invitation invalide");
        setPreview(json as InvitePreview);
      })
      .catch((e: Error) => setError(e.message));
  }, [isAuthenticated, params.code]);

  async function accept() {
    setBusy(true);
    const res = await fetch(
      `/api/v1/workspaces/invite/${encodeURIComponent(params.code)}`,
      { method: "POST" }
    );
    const json = await res.json();
    if (res.ok) router.push(`/workspaces/${json.workspace.id}`);
    else {
      setError(json.error ?? "Impossible de rejoindre");
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0A0A0A] px-4">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center">
        {error && (
          <>
            <p className="text-5xl">😕</p>
            <h1 className="mt-4 text-xl font-bold text-white">Invitation invalide</h1>
            <p className="mt-2 text-sm text-neutral-400">{error}</p>
            <Link
              href="/workspaces"
              className="mt-6 inline-block rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-bold text-white hover:bg-orange-400"
            >
              Voir mes espaces
            </Link>
          </>
        )}

        {!error && !preview && (
          <p className="text-neutral-400">Chargement de l'invitation…</p>
        )}

        {preview && (
          <>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500/30 to-emerald-500/30 text-3xl">
              {preview.workspace.icon ?? "🏢"}
            </div>
            <h1 className="mt-4 text-2xl font-black text-white">
              {preview.workspace.name}
            </h1>
            <p className="mt-1 text-xs text-neutral-500">
              👥 {preview.workspace.memberCount} membre
              {preview.workspace.memberCount > 1 ? "s" : ""}
            </p>
            {preview.workspace.description && (
              <p className="mt-3 text-sm text-neutral-400">
                {preview.workspace.description}
              </p>
            )}

            {!preview.valid && (
              <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {preview.message}
              </p>
            )}
            {preview.alreadyMember && (
              <p className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
                Tu es déjà membre de cet espace.
              </p>
            )}

            <button
              onClick={accept}
              disabled={busy || (!preview.valid && !preview.alreadyMember)}
              className="mt-6 w-full rounded-xl bg-emerald-500 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy
                ? "Connexion…"
                : preview.alreadyMember
                  ? "Entrer dans l'espace"
                  : "Rejoindre l'espace"}
            </button>
          </>
        )}
      </div>
    </main>
  );
}
