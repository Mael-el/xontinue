// ============================================================
// PAGE — Mon profil (édition)
// ============================================================

"use client";

import { useEffect, useState, FormEvent } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth/context";
import { Field, ErrorBox, SuccessBox, inputClass } from "@/components/ui/Auth";

export default function MyProfilePage() {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetch("/api/v1/profiles/me", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setProfile(d.profile);
          setForm({
            fullName: d.profile.fullName ?? "",
            bio: d.profile.bio ?? "",
            country: d.profile.country ?? "",
            city: d.profile.city ?? "",
            website: d.profile.website ?? "",
            twitter: d.profile.twitter ?? "",
            linkedin: d.profile.linkedin ?? "",
            github: d.profile.github ?? "",
          });
        }
      });
    fetch("/api/v1/profiles/me/statistics", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => d.ok && setStats(d.statistics));
  }, [isAuthenticated]);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/v1/profiles/me", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.ok) {
        setProfile(data.profile);
        setMsg({ ok: true, text: "Profil mis à jour" });
      } else {
        setMsg({ ok: false, text: data.error });
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/v1/profiles/me/avatar", {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      const data = await res.json();
      if (data.ok) {
        setProfile((p: any) => ({ ...p, avatarUrl: data.avatarUrl }));
        setMsg({ ok: true, text: "Avatar mis à jour" });
      } else {
        setMsg({ ok: false, text: data.error });
      }
    } finally {
      setUploading(false);
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12">
        <div className="animate-pulse space-y-4">
          <div className="h-10 w-48 rounded-lg bg-neutral-900" />
          <div className="h-64 rounded-2xl bg-neutral-900" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <div className="text-6xl">🔐</div>
        <h1 className="mt-4 text-2xl font-black text-white">
          Connecte-toi pour voir ton profil
        </h1>
        <Link
          href="/auth/login"
          className="mt-6 inline-block rounded-xl bg-orange-500 px-6 py-3 text-sm font-bold text-black"
        >
          Se connecter →
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-orange-500">
            Mon profil
          </div>
          <h1 className="mt-1 text-3xl font-black text-white">
            {profile?.fullName ?? user.fullName}
          </h1>
        </div>
        <button
          onClick={logout}
          className="rounded-lg border border-neutral-700 px-4 py-2 text-sm font-semibold text-white hover:border-red-500 hover:text-red-400"
        >
          Déconnexion
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Colonne gauche : avatar + stats */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6 text-center">
            <div className="relative mx-auto h-32 w-32">
              <div className="flex h-32 w-32 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-amber-500 text-5xl">
                {profile?.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profile.avatarUrl}
                    alt="avatar"
                    className="h-full w-full rounded-full object-cover"
                  />
                ) : (
                  <span>👤</span>
                )}
              </div>
              <label className="absolute bottom-0 right-0 cursor-pointer rounded-full bg-orange-500 px-2 py-1 text-xs font-bold text-black">
                📷
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleAvatar}
                  disabled={uploading}
                />
              </label>
            </div>
            <h3 className="mt-4 text-lg font-bold text-white">
              {profile?.fullName}
            </h3>
            <p className="text-xs text-neutral-500">
              {profile?.email ?? profile?.phone}
            </p>
            <div className="mt-3 inline-flex rounded-full bg-neutral-900 px-3 py-1 text-xs font-semibold capitalize text-orange-400">
              {profile?.role}
            </div>
          </div>

          {stats && (
            <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-5">
              <h4 className="mb-3 text-sm font-bold text-white">
                📊 Mes statistiques
              </h4>
              <StatRow label="XP total" value={stats.xp} />
              <StatRow label="Streak" value={`${stats.streak} jours`} />
              <StatRow
                label="Cours"
                value={`${stats.coursesCompleted}/${stats.coursesTotal}`}
              />
              <StatRow label="Badges" value={stats.badgesCount} />
              <StatRow label="Projets" value={stats.projectsCount} />
              <StatRow label="Compétences" value={stats.skillsCount} />
              <StatRow label="Candidatures" value={stats.applicationsCount} />
              <StatRow
                label="Heures apprises"
                value={`${stats.totalLearningHours}h`}
              />
            </div>
          )}

          <Link
            href={`/profile/${user.id}`}
            className="block rounded-xl border border-neutral-800 bg-neutral-950 p-4 text-center text-sm font-semibold text-orange-400 hover:border-orange-500/50"
          >
            👁️ Voir mon profil public
          </Link>
        </div>

        {/* Colonne droite : formulaire */}
        <div className="lg:col-span-2">
          <form
            onSubmit={handleSave}
            className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6"
          >
            <h3 className="mb-5 text-lg font-bold text-white">
              Informations personnelles
            </h3>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nom complet">
                <input
                  type="text"
                  value={form.fullName ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, fullName: e.target.value })
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="Pays">
                <input
                  type="text"
                  value={form.country ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, country: e.target.value })
                  }
                  placeholder="Bénin"
                  className={inputClass}
                />
              </Field>
              <Field label="Ville">
                <input
                  type="text"
                  value={form.city ?? ""}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  placeholder="Cotonou"
                  className={inputClass}
                />
              </Field>
              <Field label="Site web">
                <input
                  type="url"
                  value={form.website ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, website: e.target.value })
                  }
                  placeholder="https://monsite.com"
                  className={inputClass}
                />
              </Field>
            </div>

            <div className="mt-4">
              <Field label="Bio">
                <textarea
                  rows={4}
                  value={form.bio ?? ""}
                  onChange={(e) => setForm({ ...form, bio: e.target.value })}
                  placeholder="Parle de toi, de tes projets, de tes ambitions..."
                  className={`${inputClass} resize-none`}
                />
              </Field>
            </div>

            <h4 className="mt-6 mb-3 text-sm font-bold uppercase tracking-wider text-neutral-400">
              Réseaux sociaux
            </h4>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Twitter">
                <input
                  type="text"
                  value={form.twitter ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, twitter: e.target.value })
                  }
                  placeholder="@pseudo"
                  className={inputClass}
                />
              </Field>
              <Field label="GitHub">
                <input
                  type="text"
                  value={form.github ?? ""}
                  onChange={(e) => setForm({ ...form, github: e.target.value })}
                  placeholder="username"
                  className={inputClass}
                />
              </Field>
              <Field label="LinkedIn">
                <input
                  type="url"
                  value={form.linkedin ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, linkedin: e.target.value })
                  }
                  placeholder="https://linkedin.com/in/..."
                  className={inputClass}
                />
              </Field>
            </div>

            {msg && (
              <div className="mt-4">
                {msg.ok ? (
                  <SuccessBox message={msg.text} />
                ) : (
                  <ErrorBox message={msg.text} />
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="mt-6 w-full rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 py-3 text-sm font-bold text-black disabled:opacity-50"
            >
              {saving ? "Enregistrement..." : "Enregistrer les modifications"}
            </button>
          </form>

          {/* Sécurité */}
          <div className="mt-6 rounded-2xl border border-neutral-800 bg-neutral-950 p-6">
            <h3 className="text-lg font-bold text-white">🔐 Sécurité</h3>
            <div className="mt-4 space-y-2">
              <SecurityRow
                label="Email"
                value={profile?.email ?? "—"}
                verified={profile?.emailVerified}
              />
              <SecurityRow
                label="Téléphone"
                value={profile?.phone ?? "—"}
                verified={profile?.phoneVerified}
              />
              <SecurityRow
                label="2FA (TOTP)"
                value={profile?.twoFactorEnabled ? "Activée" : "Désactivée"}
                verified={profile?.twoFactorEnabled}
              />
              <SecurityRow
                label="Identité vérifiée"
                value={profile?.isVerifiedIdentity ? "Oui" : "Non"}
                verified={profile?.isVerifiedIdentity}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex items-center justify-between border-b border-neutral-900 py-2 last:border-0">
      <span className="text-xs text-neutral-400">{label}</span>
      <span className="text-sm font-bold text-white">{value}</span>
    </div>
  );
}

function SecurityRow({
  label,
  value,
  verified,
}: {
  label: string;
  value: string;
  verified?: boolean | null;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-black/30 px-3 py-2">
      <div>
        <div className="text-xs text-neutral-500">{label}</div>
        <div className="text-sm font-semibold text-white">{value}</div>
      </div>
      {verified ? (
        <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400">
          ✓ VÉRIFIÉ
        </span>
      ) : (
        <span className="rounded-full bg-neutral-800 px-2.5 py-0.5 text-[10px] font-bold text-neutral-400">
          NON VÉRIFIÉ
        </span>
      )}
    </div>
  );
}
