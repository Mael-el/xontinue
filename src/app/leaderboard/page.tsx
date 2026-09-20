// ============================================================
// PAGE — CLASSEMENT DES TALENTS
// Podium top 3, tableau complet, carte "ta position" si connecté.
// ============================================================

import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import {
  getLeaderboard,
  getUserRankEntry,
  type LeaderboardEntry,
} from "@/lib/leaderboard";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  const [entries, current] = await Promise.all([
    getLeaderboard(50),
    getCurrentUser(),
  ]);

  const myEntry = current ? await getUserRankEntry(current.userId) : null;
  const myInTop = myEntry ? entries.some((e) => e.userId === myEntry.userId) : false;

  // XP à rattraper pour gagner une place
  const ahead = myEntry
    ? entries.find((e) => e.rank === myEntry.rank - 1)
    : null;
  const xpToCatchUp =
    myEntry && myEntry.rank > 1 && ahead ? ahead.xp - myEntry.xp + 1 : null;

  const podium = entries.slice(0, 3);
  const rest = entries.slice(3);

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      {/* En-tête */}
      <div className="mb-10 text-center">
        <div className="text-xs font-bold uppercase tracking-[0.2em] text-orange-500">
          Gamification
        </div>
        <h1 className="mt-2 text-3xl font-black text-white sm:text-4xl lg:text-5xl">
          🏆 Classement des talents
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-neutral-400">
          Les étudiants les plus assidus d’AfricaSkills. Valide des leçons,
          termine des formations et garde ta série 🔥 pour monter au classement.
        </p>
      </div>

      {/* Carte "ta position" */}
      {current && myEntry && !myInTop && (
        <div className="mb-8 rounded-2xl border border-orange-500/40 bg-gradient-to-r from-orange-500/10 to-transparent p-5">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 text-xl font-black text-black">
              #{myEntry.rank}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate font-bold text-white">
                Ta position : {myEntry.fullName}
              </div>
              <div className="text-xs text-neutral-400">
                ⚡ {myEntry.xp} XP · 🔥 {myEntry.streak} jour
                {myEntry.streak > 1 ? "s" : ""}
                {xpToCatchUp != null && (
                  <>
                    {" "}
                    · encore{" "}
                    <span className="font-bold text-orange-400">
                      {xpToCatchUp} XP
                    </span>{" "}
                    pour gagner une place
                  </>
                )}
              </div>
            </div>
            <Link
              href="/dashboard"
              className="rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-2.5 text-xs font-bold text-black transition hover:from-orange-400 hover:to-amber-400"
            >
              Gagner de l’XP →
            </Link>
          </div>
        </div>
      )}

      {!current && (
        <div className="mb-8 rounded-2xl border border-neutral-800 bg-neutral-950 p-5 text-center text-sm text-neutral-400">
          <Link
            href="/auth/login"
            className="font-semibold text-orange-400 hover:text-orange-300"
          >
            Connecte-toi
          </Link>{" "}
          pour voir ta position au classement.
        </div>
      )}

      {entries.length === 0 ? (
        <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-16 text-center">
          <div className="text-5xl">🌱</div>
          <h3 className="mt-4 text-xl font-bold text-white">
            Le classement démarre bientôt
          </h3>
          <p className="mx-auto mt-2 max-w-md text-neutral-400">
            Aucun étudiant actif pour le moment. Inscris-toi, valide ta
            première leçon et deviens le numéro 1 !
          </p>
          <Link
            href="/courses"
            className="mt-5 inline-block rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-3 text-sm font-bold text-black transition hover:from-orange-400 hover:to-amber-400"
          >
            Commencer une formation 🚀
          </Link>
        </div>
      ) : (
        <>
          {/* Podium top 3 */}
          <div className="mb-8 grid gap-4 sm:grid-cols-3">
            {podium.map((entry) => (
              <PodiumCard key={entry.userId} entry={entry} />
            ))}
          </div>

          {/* Tableau du reste du classement */}
          {rest.length > 0 && (
            <div className="overflow-hidden rounded-2xl border border-neutral-800">
              <div className="grid grid-cols-[3rem_1fr_auto] items-center gap-2 border-b border-neutral-800 bg-neutral-950 px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-neutral-500 sm:grid-cols-[3rem_1fr_repeat(4,auto)] sm:gap-4">
                <span>Rang</span>
                <span>Étudiant</span>
                <span className="text-right">XP</span>
                <span className="hidden text-right sm:block">Série</span>
                <span className="hidden text-right sm:block">Badges</span>
                <span className="hidden text-right sm:block">Formations</span>
              </div>
              {rest.map((entry) => (
                <LeaderboardRow
                  key={entry.userId}
                  entry={entry}
                  isMe={myEntry?.userId === entry.userId}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Rappel des règles XP */}
      <div className="mt-8 grid gap-3 rounded-2xl border border-neutral-800 bg-neutral-950 p-6 text-sm text-neutral-400 sm:grid-cols-3">
        <div>
          <span className="font-bold text-white">⚡ +10 XP</span> par leçon
          validée
        </div>
        <div>
          <span className="font-bold text-white">🏆 +100 XP</span> bonus par
          formation terminée
        </div>
        <div>
          <span className="font-bold text-white">🔥 Série</span> : reviens
          chaque jour pour l’augmenter
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// Carte podium (top 3)
// ------------------------------------------------------------

const PODIUM_STYLE: Record<
  number,
  { medal: string; ring: string; height: string; label: string }
> = {
  1: {
    medal: "🥇",
    ring: "border-amber-400/60 bg-gradient-to-b from-amber-500/15 to-transparent",
    height: "sm:mt-0",
    label: "Champion",
  },
  2: {
    medal: "🥈",
    ring: "border-neutral-400/40 bg-gradient-to-b from-neutral-400/10 to-transparent",
    height: "sm:mt-6",
    label: "2e place",
  },
  3: {
    medal: "🥉",
    ring: "border-orange-700/50 bg-gradient-to-b from-orange-700/15 to-transparent",
    height: "sm:mt-10",
    label: "3e place",
  },
};

function PodiumCard({ entry }: { entry: LeaderboardEntry }) {
  const style = PODIUM_STYLE[entry.rank] ?? PODIUM_STYLE[3];
  return (
    <Link
      href={`/profile/${entry.userId}`}
      className={`rounded-2xl border p-6 text-center transition hover:scale-[1.02] ${style.ring} ${style.height}`}
    >
      <div className="text-4xl">{style.medal}</div>
      <div className="mt-3 text-[10px] font-bold uppercase tracking-widest text-neutral-500">
        {style.label}
      </div>
      <div className="mt-2 truncate text-lg font-black text-white">
        {entry.fullName}
      </div>
      <div className="text-xs text-neutral-500">
        {entry.country ?? "Afrique"}
      </div>
      <div className="mt-3 text-2xl font-black text-amber-400">
        ⚡ {entry.xp}
      </div>
      <div className="mt-2 flex items-center justify-center gap-3 text-[11px] text-neutral-400">
        <span>🔥 {entry.streak} j</span>
        <span>🏅 {entry.badgesCount}</span>
        <span>🎓 {entry.coursesCompleted}</span>
      </div>
    </Link>
  );
}

// ------------------------------------------------------------
// Ligne du classement (rang 4+)
// ------------------------------------------------------------

function LeaderboardRow({
  entry,
  isMe,
}: {
  entry: LeaderboardEntry;
  isMe: boolean;
}) {
  return (
    <Link
      href={`/profile/${entry.userId}`}
      className={`grid grid-cols-[3rem_1fr_auto] items-center gap-2 border-b border-neutral-900 px-4 py-3 transition hover:bg-neutral-900 sm:grid-cols-[3rem_1fr_repeat(4,auto)] sm:gap-4 ${
        isMe ? "bg-orange-500/5" : "bg-neutral-950"
      }`}
    >
      <span
        className={`text-sm font-black ${isMe ? "text-orange-400" : "text-neutral-500"}`}
      >
        #{entry.rank}
      </span>
      <span className="flex min-w-0 items-center gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-amber-500 text-xs">
          👤
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-bold text-white">
            {entry.fullName}
            {isMe && (
              <span className="ml-2 rounded-full bg-orange-500/20 px-2 py-0.5 text-[9px] font-bold text-orange-300">
                TOI
              </span>
            )}
          </span>
          <span className="block text-[11px] text-neutral-500">
            {entry.country ?? "Afrique"}
          </span>
        </span>
      </span>
      <span className="text-right text-sm font-black text-amber-400">
        ⚡ {entry.xp}
      </span>
      <span className="hidden text-right text-xs text-neutral-400 sm:block">
        🔥 {entry.streak} j
      </span>
      <span className="hidden text-right text-xs text-neutral-400 sm:block">
        🏅 {entry.badgesCount}
      </span>
      <span className="hidden text-right text-xs text-neutral-400 sm:block">
        🎓 {entry.coursesCompleted}
      </span>
    </Link>
  );
}
