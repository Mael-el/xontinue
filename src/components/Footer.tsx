// ============================================================
// FOOTER — AfricaSkills
// ============================================================

import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-24 border-t border-orange-900/20 bg-[#0A0A0A]">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          <div className="col-span-2">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 via-amber-500 to-emerald-500 text-xl">
                🌍
              </div>
              <div className="text-xl font-black text-white">
                Africa<span className="text-orange-500">Skills</span>
              </div>
            </div>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-neutral-400">
              La première plateforme panafricaine de formation, certification et
              emploi. Nous formons la prochaine génération de talents tech du
              continent et les connectons aux meilleures entreprises.
            </p>
            <div className="mt-6 flex gap-3">
              <SocialIcon>𝕏</SocialIcon>
              <SocialIcon>in</SocialIcon>
              <SocialIcon>▶</SocialIcon>
              <SocialIcon>📷</SocialIcon>
            </div>
          </div>

          <FooterCol title="Plateforme">
            <FooterLink href="/courses">Toutes les formations</FooterLink>
            <FooterLink href="/badges">Certifications</FooterLink>
            <FooterLink href="/jobs">Offres d&apos;emploi</FooterLink>
            <FooterLink href="/dashboard">Mon espace</FooterLink>
          </FooterCol>

          <FooterCol title="Domaines">
            <FooterLink href="/courses?domain=dev">Développement</FooterLink>
            <FooterLink href="/courses?domain=data">Data & IA</FooterLink>
            <FooterLink href="/courses?domain=cyber">Cybersécurité</FooterLink>
            <FooterLink href="/courses?domain=anglais">Anglais 3 mois</FooterLink>
          </FooterCol>

          <FooterCol title="Entreprise">
            <FooterLink href="/about">À propos</FooterLink>
            <FooterLink href="/about">Partenaires</FooterLink>
            <FooterLink href="/about">Carrières</FooterLink>
            <FooterLink href="/about">Contact</FooterLink>
          </FooterCol>
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-4 border-t border-neutral-900 pt-8 text-sm text-neutral-500 sm:flex-row sm:items-center">
          <p>
            © {new Date().getFullYear()} AfricaSkills — Made with 🧡 in Africa.
            Tous droits réservés.
          </p>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            <span>Paiements Mobile Money : MTN · Orange · Moov · Wave</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

function SocialIcon({ children }: { children: React.ReactNode }) {
  return (
    <button className="flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-800 text-neutral-400 transition hover:border-orange-500/50 hover:text-white">
      <span className="text-sm font-bold">{children}</span>
    </button>
  );
}

function FooterCol({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white">
        {title}
      </h3>
      <ul className="space-y-2">{children}</ul>
    </div>
  );
}

function FooterLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <li>
      <Link
        href={href}
        className="text-sm text-neutral-400 transition hover:text-orange-500"
      >
        {children}
      </Link>
    </li>
  );
}
