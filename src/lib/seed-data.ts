// ============================================================
// DONNÉES DE SEED D'AFRICASKILLS
// Contient les 12 domaines de formation, quelques cours, badges,
// entreprises et offres d'emploi pour peupler la plateforme.
// ============================================================

export const SEED_DOMAINS = [
  {
    slug: "anglais",
    name: "Anglais",
    description:
      "Maîtrise l'anglais professionnel en 3 mois avec la méthode intensive AfricaSkills.",
    icon: "🇬🇧",
    color: "bg-orange-500",
  },
  {
    slug: "dev",
    name: "Développement",
    description:
      "Dev web, mobile et backend. Du HTML au microservices en passant par React et NestJS.",
    icon: "💻",
    color: "bg-blue-500",
  },
  {
    slug: "data",
    name: "Data & Analyse",
    description:
      "SQL, Python, Power BI, Machine Learning. Deviens Data Analyst ou Data Scientist.",
    icon: "📊",
    color: "bg-emerald-500",
  },
  {
    slug: "cyber",
    name: "Cybersécurité",
    description:
      "Protège les entreprises africaines. Ethical hacking, pentesting, SOC analyst.",
    icon: "🛡️",
    color: "bg-red-500",
  },
  {
    slug: "ia",
    name: "Intelligence Artificielle",
    description:
      "LLMs, Computer Vision, NLP, IA générative. Construis l'IA africaine.",
    icon: "🤖",
    color: "bg-purple-500",
  },
  {
    slug: "design",
    name: "Design UI/UX",
    description:
      "Figma, design systems, UX research, branding. Crée des produits qui marquent.",
    icon: "🎨",
    color: "bg-pink-500",
  },
  {
    slug: "maths",
    name: "Mathématiques",
    description:
      "Algèbre, calcul, statistiques, optimisation. La base de toute tech.",
    icon: "🔢",
    color: "bg-amber-500",
  },
  {
    slug: "physique",
    name: "Physique",
    description:
      "Mécanique, électricité, thermodynamique pour ingénieurs africains.",
    icon: "⚛️",
    color: "bg-cyan-500",
  },
  {
    slug: "lecture",
    name: "Lecture rapide",
    description:
      "Lis 3x plus vite, comprends mieux. Compétence clé pour tout professionnel.",
    icon: "📚",
    color: "bg-yellow-500",
  },
  {
    slug: "ingenierie",
    name: "Ingénierie",
    description:
      "Génie civil, mécanique, électrique. Construis l'Afrique de demain.",
    icon: "🏗️",
    color: "bg-stone-500",
  },
  {
    slug: "robotique",
    name: "Robotique",
    description:
      "Arduino, ROS, drones, IoT. Fabrique le futur de l'industrie africaine.",
    icon: "🦾",
    color: "bg-indigo-500",
  },
  {
    slug: "entrepreneuriat",
    name: "Entrepreneuriat",
    description:
      "Business plan, levée de fonds, growth hacking. Lance ta startup africaine.",
    icon: "🚀",
    color: "bg-orange-600",
  },
] as const;

export const SEED_COURSES: Array<{
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  domainSlug: string;
  level: "beginner" | "intermediate" | "advanced" | "expert";
  durationHours: number;
  priceXof: number;
  rating: number;
  studentsCount: number;
  whatYouLearn: string[];
  requirements: string[];
  instructorName: string;
}> = [
  {
    slug: "anglais-intensif-3-mois",
    title: "Anglais Intensif — 3 mois pour le parler couramment",
    subtitle: "La méthode AfricaSkills : 12 semaines, 30 min/jour, résultats garantis",
    description:
      "Un programme intensif conçu pour les francophones africains. Conversation, grammaire appliquée, vocabulaire business. Coaching vocal hebdomadaire inclus.",
    domainSlug: "anglais",
    level: "beginner",
    durationHours: 60,
    priceXof: 25000,
    rating: 48,
    studentsCount: 1243,
    whatYouLearn: [
      "Tenir une conversation professionnelle en 5 minutes",
      "Maîtriser les 2000 mots essentiels du business English",
      "Passer un entretien en anglais avec confiance",
      "Rédiger emails et rapports clairs",
    ],
    requirements: ["Aucun prérequis", "30 minutes par jour", "Un smartphone"],
    instructorName: "Prof. Akissi Kouamé",
  },
  {
    slug: "react-nextjs-fullstack",
    title: "Fullstack React + Next.js 15 + PostgreSQL",
    subtitle: "Construis des apps modernes de A à Z",
    description:
      "Apprends React 19, Next.js App Router, Drizzle, TypeScript strict et déploie sur Vercel. 5 projets concrets inclus.",
    domainSlug: "dev",
    level: "intermediate",
    durationHours: 85,
    priceXof: 45000,
    rating: 49,
    studentsCount: 892,
    whatYouLearn: [
      "React 19 et les Server Components",
      "Next.js 15 App Router et Server Actions",
      "TypeScript strict et patterns avancés",
      "Drizzle ORM + PostgreSQL",
      "Déploiement Vercel + CI/CD",
    ],
    requirements: ["HTML/CSS/JS de base", "Un ordinateur", "Git installé"],
    instructorName: "Kwame Mensah",
  },
  {
    slug: "python-data-science",
    title: "Python pour la Data Science",
    subtitle: "De 0 à Data Analyst en 10 semaines",
    description:
      "Pandas, NumPy, Matplotlib, Scikit-learn, SQL. Analyses réelles sur données africaines (santé, agriculture, fintech).",
    domainSlug: "data",
    level: "beginner",
    durationHours: 70,
    priceXof: 35000,
    rating: 47,
    studentsCount: 654,
    whatYouLearn: [
      "Python 3 et programmation orientée données",
      "Pandas et manipulation de datasets",
      "Visualisation avec Matplotlib & Seaborn",
      "Introduction au Machine Learning",
      "Projets concrets sur données africaines",
    ],
    requirements: ["Logique mathématique de base", "Ordinateur avec 8 Go de RAM"],
    instructorName: "Dr. Amina Diallo",
  },
  {
    slug: "ethical-hacking-debutant",
    title: "Ethical Hacking — Devenir Pentester Junior",
    subtitle: "Protège l'Afrique numérique",
    description:
      "Reconnaissance, scanning, exploitation, post-exploitation. Labs pratiques avec Kali Linux et CTFs.",
    domainSlug: "cyber",
    level: "intermediate",
    durationHours: 95,
    priceXof: 55000,
    rating: 49,
    studentsCount: 421,
    whatYouLearn: [
      "Kali Linux et outils de pentesting",
      "Nmap, Metasploit, Burp Suite",
      "OWASP Top 10 et vulnérabilités web",
      "Rédaction de rapports de pentest",
      "Préparation CEH et OSCP",
    ],
    requirements: ["Connaissances réseaux de base", "Machine virtuelle possible"],
    instructorName: "Ibrahim Traoré",
  },
  {
    slug: "llm-et-ia-generative",
    title: "LLMs & IA Générative — Construire des apps IA",
    subtitle: "OpenAI, Claude, Llama, RAG, Agents",
    description:
      "Maîtrise les LLMs en production. Prompt engineering, RAG, fine-tuning, agents autonomes. Stack Python + LangChain.",
    domainSlug: "ia",
    level: "advanced",
    durationHours: 50,
    priceXof: 75000,
    rating: 50,
    studentsCount: 287,
    whatYouLearn: [
      "API OpenAI, Anthropic et open-source",
      "RAG avec vector DB (pgvector, Pinecone)",
      "Agents autonomes et LangGraph",
      "Fine-tuning de petits modèles",
      "Déploiement et coût optimisation",
    ],
    requirements: ["Python avancé", "Notions de ML"],
    instructorName: "Dr. Nnamdi Okafor",
  },
  {
    slug: "figma-ui-ux-pro",
    title: "Figma & Design UI/UX Professionnel",
    subtitle: "Du wireframe au design system complet",
    description:
      "Crée des produits qui convertissent. UX research, wireframes, prototypage avancé, design systems et handoff dev.",
    domainSlug: "design",
    level: "beginner",
    durationHours: 45,
    priceXof: 30000,
    rating: 48,
    studentsCount: 512,
    whatYouLearn: [
      "Figma de A à Z",
      "UX research et personas",
      "Design systems scalables",
      "Prototypage interactif",
      "Handoff avec les développeurs",
    ],
    requirements: ["Aucun prérequis", "Compte Figma gratuit"],
    instructorName: "Fatoumata Bah",
  },
  {
    slug: "launch-startup-africa",
    title: "Lancer sa startup en Afrique",
    subtitle: "De l'idée à la première levée de fonds",
    description:
      "Validation d'idée, MVP, traction, pitch deck, levée de fonds. Témoignages de fondateurs africains qui ont réussi.",
    domainSlug: "entrepreneuriat",
    level: "intermediate",
    durationHours: 40,
    priceXof: 40000,
    rating: 49,
    studentsCount: 743,
    whatYouLearn: [
      "Validation Lean Startup adaptée à l'Afrique",
      "Construire un MVP en 30 jours",
      "Pitch deck qui convainc les investisseurs",
      "Mobile Money et paiements locaux",
      "Levée de fonds auprès des VCs africains",
    ],
    requirements: ["Une idée", "Engagement total"],
    instructorName: "Marie-Claire Senghor",
  },
  {
    slug: "robotique-arduino",
    title: "Robotique & Arduino — Premier robot",
    subtitle: "Électronique + code = objets intelligents",
    description:
      "Apprends Arduino, capteurs, moteurs, WiFi. Construis 6 robots dont un véhicule autonome et un drone basique.",
    domainSlug: "robotique",
    level: "beginner",
    durationHours: 55,
    priceXof: 45000,
    rating: 47,
    studentsCount: 198,
    whatYouLearn: [
      "Électronique de base",
      "Programmation Arduino C++",
      "Capteurs et actionneurs",
      "Communication WiFi et Bluetooth",
      "Construction de 6 projets",
    ],
    requirements: ["Kit Arduino (~25 000 FCFA)", "Ordinateur"],
    instructorName: "Prof. Jean-Baptiste Ndayisaba",
  },
];

export const SEED_BADGES = [
  {
    slug: "english-a1",
    name: "English Starter",
    description: "A complété le niveau A1 d'anglais",
    icon: "🥉",
    rarity: "common" as const,
    domainSlug: "anglais",
    requiredXp: 100,
  },
  {
    slug: "english-b2",
    name: "English Pro",
    description: "Niveau B2 validé — Anglais professionnel courant",
    icon: "🥇",
    rarity: "epic" as const,
    domainSlug: "anglais",
    requiredXp: 1500,
  },
  {
    slug: "fullstack-hero",
    name: "Fullstack Hero",
    description: "A construit 3 projets fullstack en production",
    icon: "⚔️",
    rarity: "legendary" as const,
    domainSlug: "dev",
    requiredXp: 3000,
  },
  {
    slug: "data-analyst",
    name: "Data Analyst Certifié",
    description: "Certification Data Analyst AfricaSkills",
    icon: "📈",
    rarity: "rare" as const,
    domainSlug: "data",
    requiredXp: 800,
  },
  {
    slug: "cyber-guardian",
    name: "Cyber Guardian",
    description: "A réussi 10 CTFs et 3 labs de pentest",
    icon: "🛡️",
    rarity: "epic" as const,
    domainSlug: "cyber",
    requiredXp: 2000,
  },
  {
    slug: "ai-builder",
    name: "AI Builder",
    description: "A déployé 2 apps IA en production",
    icon: "🤖",
    rarity: "legendary" as const,
    domainSlug: "ia",
    requiredXp: 2500,
  },
  {
    slug: "design-artist",
    name: "Design Artist",
    description: "A créé 5 designs complets validés",
    icon: "🎨",
    rarity: "rare" as const,
    domainSlug: "design",
    requiredXp: 600,
  },
  {
    slug: "startup-founder",
    name: "Startup Founder",
    description: "A lancé sa startup et obtenu ses 100 premiers clients",
    icon: "🚀",
    rarity: "legendary" as const,
    domainSlug: "entrepreneuriat",
    requiredXp: 5000,
  },
];

export const SEED_COMPANIES = [
  {
    name: "MTN Group",
    slug: "mtn-group",
    country: "Afrique du Sud",
    city: "Johannesburg",
    industry: "Télécommunications",
    logoEmoji: "📡",
    description:
      "Opérateur télécom panafricain. Recrutement massif de développeurs et data scientists.",
  },
  {
    name: "Wave",
    slug: "wave",
    country: "Sénégal",
    city: "Dakar",
    industry: "Fintech",
    logoEmoji: "💸",
    description:
      "Mobile Money nouvelle génération. L'une des licornes africaines les plus prometteuses.",
  },
  {
    name: "Flutterwave",
    slug: "flutterwave",
    country: "Nigeria",
    city: "Lagos",
    industry: "Fintech",
    logoEmoji: "💳",
    description:
      "Infrastructure de paiement pour l'Afrique. Leader continental.",
  },
  {
    name: "Jumia",
    slug: "jumia",
    country: "Nigeria",
    city: "Lagos",
    industry: "E-commerce",
    logoEmoji: "🛒",
    description: "Le Amazon africain. Équipes tech en forte croissance.",
  },
  {
    name: "Andela",
    slug: "andela",
    country: "Kenya",
    city: "Nairobi",
    industry: "Tech Talent",
    logoEmoji: "🌍",
    description:
      "Met en relation les talents tech africains avec des entreprises mondiales.",
  },
  {
    name: "Kudabank",
    slug: "kudabank",
    country: "Nigeria",
    city: "Lagos",
    industry: "Banque digitale",
    logoEmoji: "🏦",
    description: "Banque digitale pour la jeunesse africaine.",
  },
];

export const SEED_JOBS: Array<{
  title: string;
  companySlug: string;
  type: "full_time" | "part_time" | "freelance" | "internship" | "contract";
  location: string;
  isRemote: boolean;
  salaryMinXof: number;
  salaryMaxXof: number;
  description: string;
  requiredBadges: string[];
}> = [
  {
    title: "Senior Fullstack Developer (React + Node)",
    companySlug: "wave",
    type: "full_time",
    location: "Dakar, Sénégal",
    isRemote: true,
    salaryMinXof: 1500000,
    salaryMaxXof: 2500000,
    description:
      "Rejoins l'équipe produit de Wave pour construire la prochaine génération de mobile money. Stack : React, TypeScript, Node.js, PostgreSQL.",
    requiredBadges: ["fullstack-hero"],
  },
  {
    title: "Data Scientist Junior",
    companySlug: "mtn-group",
    type: "full_time",
    location: "Abidjan, Côte d'Ivoire",
    isRemote: false,
    salaryMinXof: 800000,
    salaryMaxXof: 1200000,
    description:
      "Analyse les données clients de MTN pour optimiser les offres commerciales. Python, SQL, Power BI.",
    requiredBadges: ["data-analyst"],
  },
  {
    title: "Pentester Freelance",
    companySlug: "flutterwave",
    type: "freelance",
    location: "Remote Afrique",
    isRemote: true,
    salaryMinXof: 2000000,
    salaryMaxXof: 4000000,
    description:
      "Mission de 3 mois : audit de sécurité des APIs de paiement. OSCP ou équivalent requis.",
    requiredBadges: ["cyber-guardian"],
  },
  {
    title: "UI/UX Designer",
    companySlug: "jumia",
    type: "full_time",
    location: "Lagos, Nigeria",
    isRemote: true,
    salaryMinXof: 900000,
    salaryMaxXof: 1400000,
    description:
      "Refonte de l'expérience mobile Jumia. Figma, recherche utilisateur, design system.",
    requiredBadges: ["design-artist"],
  },
  {
    title: "AI Engineer — LLMs",
    companySlug: "andela",
    type: "full_time",
    location: "Nairobi, Kenya",
    isRemote: true,
    salaryMinXof: 1800000,
    salaryMaxXof: 3000000,
    description:
      "Construis des assistants IA pour les développeurs africains. LangChain, RAG, agents autonomes.",
    requiredBadges: ["ai-builder"],
  },
  {
    title: "Stage Développeur Mobile (React Native)",
    companySlug: "kudabank",
    type: "internship",
    location: "Lagos, Nigeria",
    isRemote: false,
    salaryMinXof: 250000,
    salaryMaxXof: 400000,
    description:
      "Stage de 6 mois. Tu travailleras sur l'app mobile Kuda avec une équipe senior.",
    requiredBadges: [],
  },
];

// ============================================================
// LEÇONS DE DÉMONSTRATION — titres ordonnés par slug de cours
// Chaque titre devient une leçon (order = index + 1, XP = 10).
// ============================================================

export const SEED_LESSONS: Record<string, string[]> = {
  "anglais-intensif-3-mois": [
    "Présentations & small talk professionnel",
    "Les 100 verbes essentiels du business English",
    "Construire des phrases au présent simple",
    "Compréhension orale : suivre une réunion Zoom",
    "Raconter son parcours au passé",
    "Rédiger un email professionnel parfait",
    "Vocabulaire des entretiens d'embauche",
    "Parler du futur : projets et ambitions",
    "Simulation d'entretien complet en anglais",
    "Ton pitch personnel en 60 secondes",
  ],
  "react-nextjs-fullstack": [
    "Mental model : React 19 & Server Components",
    "App Router : layouts, pages et navigation",
    "Data fetching côté serveur et cache",
    "Server Actions et mutations de données",
    "TypeScript strict appliqué à React",
    "Drizzle ORM : schéma, requêtes et relations",
    "Authentification par cookies & JWT",
    "Projet guidé : API REST complète",
    "Déploiement Vercel et pipeline CI/CD",
    "Projet final : application fullstack de A à Z",
  ],
  "python-data-science": [
    "Python 3 : les fondamentaux en pratique",
    "Structures de données et compréhensions de listes",
    "Pandas : charger et nettoyer un dataset",
    "Jointures, groupby et agrégations",
    "Visualisation avec Matplotlib & Seaborn",
    "SQL pour les analystes de données",
    "Étude de cas : données agricoles africaines",
    "Introduction au Machine Learning (scikit-learn)",
    "Étude de cas : fintech et mobile money",
    "Projet final : tableau de bord d'analyse complet",
  ],
  "ethical-hacking-debutant": [
    "Éthique, cadre légal et méthodologie du pentest",
    "Kali Linux : installation et prise en main",
    "Reconnaissance passive et OSINT",
    "Scanning réseau avec Nmap",
    "Vulnérabilités web : le OWASP Top 10",
    "Exploitation avec Metasploit",
    "Tests d'intrusion avec Burp Suite",
    "Post-exploitation et escalade de privilèges",
    "Rédiger un rapport de pentest professionnel",
    "CTF final : compromets ta première machine",
  ],
  "llm-et-ia-generative": [
    "Comment fonctionne un LLM : tokens et transformers",
    "Prompt engineering : techniques qui marchent",
    "APIs OpenAI, Anthropic et modèles open-source",
    "Embeddings et recherche sémantique",
    "RAG : brancher un LLM sur tes données",
    "Vector databases : pgvector en pratique",
    "Agents autonomes avec LangGraph",
    "Fine-tuning de petits modèles",
    "Coûts, latence et mise en production",
    "Projet final : assistant IA métier complet",
  ],
  "figma-ui-ux-pro": [
    "Penser UX avant les pixels",
    "Figma : interface, frames et auto-layout",
    "Recherche utilisateur et personas",
    "Wireframes : de l'idée à l'écran",
    "Couleurs, typographie et grille 8pt",
    "Composants et variants Figma",
    "Construire un design system scalable",
    "Prototypage interactif et animations",
    "Handoff développeurs sans friction",
    "Projet final : refonte d'une app fintech africaine",
  ],
  "launch-startup-africa": [
    "Trouver un problème qui vaut la peine",
    "Validation Lean Startup adaptée à l'Afrique",
    "Interview clients : les bonnes questions",
    "Construire un MVP en 30 jours",
    "Traction : acquérir tes 100 premiers clients",
    "Mobile Money et paiements locaux",
    "Modèle économique et unit economics",
    "Pitch deck qui convainc les investisseurs",
    "Levée de fonds auprès des VCs africains",
    "Simulation de pitch devant un jury",
  ],
  "robotique-arduino": [
    "Électronique de base : tension, courant, résistance",
    "Arduino : premier programme et LED clignotante",
    "Lire des capteurs (distance, lumière, température)",
    "Piloter des moteurs et servomoteurs",
    "Communication série et débogage",
    "WiFi et Bluetooth avec l'ESP32",
    "Projet : station météo connectée",
    "Projet : véhicule éviteur d'obstacles",
    "Projet : bras robotisé commandé",
    "Projet final : ton robot autonome",
  ],
};
