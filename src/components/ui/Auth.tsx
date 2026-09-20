// ============================================================
// COMPOSANTS UI D'AUTHENTIFICATION — Partagés entre pages
// ============================================================

"use client";

import Link from "next/link";

export const inputClass =
  "w-full rounded-xl border border-neutral-800 bg-black px-4 py-3 text-sm text-white placeholder-neutral-500 outline-none transition focus:border-orange-500";

export function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-center px-4 py-12">
      <Link href="/" className="mb-8 flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 via-amber-500 to-emerald-500 text-lg">
          🌍
        </div>
        <div className="text-base font-black text-white">
          Africa<span className="text-orange-500">Skills</span>
        </div>
      </Link>

      <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-8">
        <h1 className="text-2xl font-black text-white">{title}</h1>
        <p className="mt-1 text-sm text-neutral-400">{subtitle}</p>
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}

export function Field({
  label,
  right,
  children,
}: {
  label: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <label className="text-xs font-bold uppercase tracking-wider text-neutral-400">
          {label}
        </label>
        {right}
      </div>
      {children}
    </div>
  );
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
      ⚠️ {message}
    </div>
  );
}

export function SuccessBox({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300">
      ✓ {message}
    </div>
  );
}

export function SocialButtons() {
  return (
    <div className="grid grid-cols-2 gap-3">
      <button
        type="button"
        className="flex items-center justify-center gap-2 rounded-xl border border-neutral-800 bg-black py-3 text-sm font-semibold text-white transition hover:border-neutral-700"
      >
        <span>🔵</span> Google
      </button>
      <button
        type="button"
        className="flex items-center justify-center gap-2 rounded-xl border border-neutral-800 bg-black py-3 text-sm font-semibold text-white transition hover:border-neutral-700"
      >
        <span>🐙</span> GitHub
      </button>
    </div>
  );
}
