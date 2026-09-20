// Page 404 — AfricaSkills
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center px-4 text-center">
      <div className="text-8xl">🌍</div>
      <h1 className="mt-6 text-5xl font-black text-white">404</h1>
      <p className="mt-4 text-xl text-neutral-400">
        Cette page s'est perdue en route vers l'Afrique.
      </p>
      <Link
        href="/"
        className="mt-8 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-3.5 text-sm font-bold text-black transition hover:from-orange-400 hover:to-amber-400"
      >
        Retour à l'accueil →
      </Link>
    </div>
  );
}
