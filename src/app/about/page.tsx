// ============================================================
// PAGE — À PROPOS
// ============================================================

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
      {/* Hero */}
      <div className="text-center">
        <div className="text-xs font-bold uppercase tracking-[0.2em] text-orange-500">
          Notre mission
        </div>
        <h1 className="mt-3 text-4xl font-black text-white sm:text-5xl lg:text-6xl">
          Former 1 million de <br />
          <span className="bg-gradient-to-r from-orange-500 via-amber-400 to-emerald-500 bg-clip-text text-transparent">
            talents africains
          </span>{" "}
          d'ici 2030.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-neutral-400">
          AfricaSkills est né d'un constat : l'Afrique a le talent, mais pas
          toujours l'accès. Nous construisons la plateforme qui forme, certifie
          et connecte les meilleurs talents du continent aux opportunités du
          monde entier.
        </p>
      </div>

      {/* Piliers */}
      <div className="mt-20 grid gap-6 md:grid-cols-3">
        <Pillar
          num="01"
          title="Former"
          description="12 domaines d'excellence. Des cours créés par des experts africains, pour des Africains. Avec la réalité du terrain."
          icon="📚"
        />
        <Pillar
          num="02"
          title="Certifier"
          description="Un système de badges et d'XP reconnu par +80 entreprises partenaires. Tes compétences sont vérifiables et monnayables."
          icon="🏆"
        />
        <Pillar
          num="03"
          title="Employer"
          description="Job board exclusif. Les meilleurs talents sont directement mis en avant auprès des recruteurs panafricains et internationaux."
          icon="💼"
        />
      </div>

      {/* Nos convictions */}
      <section className="mt-24 rounded-3xl border border-neutral-800 bg-neutral-950 p-8 sm:p-12">
        <h2 className="text-3xl font-black text-white">Nos convictions</h2>
        <div className="mt-8 space-y-6">
          <Conviction
            title="L'anglais est obligatoire."
            body="Tous nos étudiants suivent un programme intensif de 3 mois. B2 garanti. Le continent parle français, portugais et arabe — mais le monde parle anglais. On change la donne."
          />
          <Conviction
            title="Mobile Money avant carte bancaire."
            body="80% des jeunes africains n'ont pas de compte bancaire mais ont un téléphone. Paiement MTN, Orange, Moov, Wave. En 3 fois sans frais."
          />
          <Conviction
            title="Les projets > les diplômes."
            body="On ne te vend pas un parchemin. On te fait construire 5 à 10 projets réels qui prouvent tes compétences mieux que n'importe quel CV."
          />
          <Conviction
            title="L'Afrique par l'Afrique."
            body="Nos instructeurs sont africains. Nos cas d'étude sont africains (Wave, MTN, Jumia). Nos entreprises partenaires sont africaines."
          />
        </div>
      </section>

      {/* Chiffres */}
      <section className="mt-16 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <BigNumber value="12K+" label="Étudiants actifs" />
        <BigNumber value="120+" label="Formations" />
        <BigNumber value="80+" label="Entreprises partenaires" />
        <BigNumber value="15" label="Pays africains" />
      </section>

      {/* Équipe fondatrice */}
      <section className="mt-24">
        <h2 className="text-3xl font-black text-white">L'équipe</h2>
        <p className="mt-3 max-w-2xl text-neutral-400">
          Une équipe panafricaine de builders, ingénieurs et éducateurs qui
          croient au potentiel du continent.
        </p>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          <TeamMember
            name="Aya Konan"
            role="CEO & Co-fondatrice"
            emoji="👩🏾‍💼"
            country="🇨🇮 Côte d'Ivoire"
            bio="Ex-Google, 10 ans dans l'edtech africaine."
          />
          <TeamMember
            name="Kwame Mensah"
            role="CTO"
            emoji="👨🏾‍💻"
            country="🇬🇭 Ghana"
            bio="Architecte logiciel. Ex-Andela, ex-Flutterwave."
          />
          <TeamMember
            name="Fatoumata Bah"
            role="Head of Education"
            emoji="👩🏾‍🏫"
            country="🇸🇳 Sénégal"
            bio="PhD Éducation. A formé +5 000 jeunes."
          />
        </div>
      </section>

      {/* CTA */}
      <section className="mt-20 rounded-3xl bg-gradient-to-br from-orange-500 to-amber-500 p-10 text-center text-black sm:p-16">
        <h2 className="text-3xl font-black sm:text-4xl">
          Rejoins la révolution AfricaSkills
        </h2>
        <p className="mx-auto mt-3 max-w-xl">
          Que tu sois étudiant, instructeur, recruteur ou investisseur, il y a
          une place pour toi dans notre aventure.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <a
            href="/courses"
            className="rounded-xl bg-black px-6 py-3.5 text-sm font-bold text-white transition hover:bg-neutral-800"
          >
            Commencer à apprendre
          </a>
          <a
            href="/jobs"
            className="rounded-xl bg-white px-6 py-3.5 text-sm font-bold text-black transition hover:bg-neutral-100"
          >
            Recruter un talent
          </a>
        </div>
      </section>
    </div>
  );
}

function Pillar({
  num,
  title,
  description,
  icon,
}: {
  num: string;
  title: string;
  description: string;
  icon: string;
}) {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-orange-500">{num}</span>
        <span className="text-3xl">{icon}</span>
      </div>
      <h3 className="mt-4 text-2xl font-black text-white">{title}</h3>
      <p className="mt-3 text-sm leading-relaxed text-neutral-400">
        {description}
      </p>
    </div>
  );
}

function Conviction({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex gap-4 border-b border-neutral-900 pb-6 last:border-0 last:pb-0">
      <span className="mt-1 text-2xl">▸</span>
      <div>
        <h4 className="text-lg font-bold text-white">{title}</h4>
        <p className="mt-2 leading-relaxed text-neutral-400">{body}</p>
      </div>
    </div>
  );
}

function BigNumber({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6 text-center">
      <div className="bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-4xl font-black text-transparent">
        {value}
      </div>
      <div className="mt-2 text-xs text-neutral-500">{label}</div>
    </div>
  );
}

function TeamMember({
  name,
  role,
  emoji,
  country,
  bio,
}: {
  name: string;
  role: string;
  emoji: string;
  country: string;
  bio: string;
}) {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6 text-center">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-amber-500 text-4xl">
        {emoji}
      </div>
      <h4 className="mt-4 text-lg font-bold text-white">{name}</h4>
      <div className="text-sm font-semibold text-orange-400">{role}</div>
      <div className="mt-1 text-xs text-neutral-500">{country}</div>
      <p className="mt-3 text-sm text-neutral-400">{bio}</p>
    </div>
  );
}
