// ============================================================
// NAVBAR — AfricaSkills (avec état auth en temps réel)
// ============================================================

"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth/context";
import { NotificationBell } from "@/components/NotificationBell";

export function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();

  return (
    <header className="sticky top-0 z-50 border-b border-orange-900/20 bg-[#0A0A0A]/95 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 via-amber-500 to-emerald-500 text-lg shadow-lg shadow-orange-500/30">
            🌍
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-base font-black tracking-tight text-white">
              Africa<span className="text-orange-500">Skills</span>
            </span>
            <span className="text-[10px] uppercase tracking-widest text-neutral-500">
              Form. Cert. Emploie.
            </span>
          </div>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          <NavLink href="/courses">Formations</NavLink>
          <NavLink href="/badges">Badges</NavLink>
          <NavLink href="/leaderboard">Classement</NavLink>
          <NavLink href="/jobs">Emplois</NavLink>
          {isAuthenticated && <NavLink href="/dashboard">Dashboard</NavLink>}
          {isAuthenticated && <NavLink href="/messages">Messages</NavLink>}
          {isAuthenticated && <NavLink href="/workspaces">Espaces</NavLink>}
          {isAuthenticated && <NavLink href="/recruiter">Recruteur</NavLink>}
          {isAuthenticated &&
            (user?.role === "instructor" || user?.role === "admin") && (
              <NavLink href="/instructor">Formateur</NavLink>
            )}
          {isAuthenticated && user?.role === "admin" && (
            <NavLink href="/admin">Admin</NavLink>
          )}
          <NavLink href="/about">À propos</NavLink>
        </nav>

        <div className="flex items-center gap-2">
          {isAuthenticated && user ? (
            <>
              <NotificationBell />
              <Link
                href="/settings"
                title="Réglages des notifications"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-800 text-sm transition hover:border-orange-500/50"
              >
                ⚙️
              </Link>
              <Link
                href="/profile/me"
                className="flex items-center gap-2 rounded-lg border border-neutral-800 px-3 py-1.5 text-sm text-white transition hover:border-orange-500/50"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-amber-500 text-xs">
                  {user.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={user.avatarUrl}
                      alt=""
                      className="h-full w-full rounded-full object-cover"
                    />
                  ) : (
                    <span>👤</span>
                  )}
                </div>
                <span className="hidden max-w-[120px] truncate font-medium sm:inline">
                  {user.fullName}
                </span>
              </Link>
              <button
                onClick={logout}
                className="rounded-lg border border-neutral-800 px-3 py-1.5 text-sm font-medium text-neutral-300 transition hover:border-red-500/50 hover:text-red-400"
                title="Déconnexion"
              >
                🚪
              </button>
            </>
          ) : (
            <>
              <Link
                href="/auth/login"
                className="hidden rounded-lg border border-neutral-800 px-3 py-1.5 text-sm font-medium text-neutral-300 transition hover:border-neutral-700 hover:text-white sm:inline-block"
              >
                Connexion
              </Link>
              <Link
                href="/auth/register"
                className="rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-1.5 text-sm font-semibold text-black shadow-lg shadow-orange-500/30 transition hover:from-orange-400 hover:to-amber-400"
              >
                S&apos;inscrire
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-md px-3 py-1.5 text-sm font-medium text-neutral-300 transition hover:bg-neutral-900 hover:text-white"
    >
      {children}
    </Link>
  );
}
