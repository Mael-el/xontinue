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
    priceXof: 0,
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
    priceXof: 0,
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
    priceXof: 0,
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
    priceXof: 0,
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
    priceXof: 0,
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
    priceXof: 0,
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
    priceXof: 0,
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
    priceXof: 0,
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

  // ─── Extension catalogue (recherche en ligne 2026 ────────
  // inspirée d'Andela/Decagon/AltSchool, ALX Data & AI,
  // parcours SOC/Security+, TEFConnect Entrepreneurship) ────

  // Anglais — 2ᵉ cours
  {
    slug: "business-english-ielts-prep",
    title: "English for Business & préparation IELTS",
    subtitle: "Le ton juste en entretien, en réunion et à l'écrit",
    description:
      "Formation bilingue orientée communication professionnelle : emails percutants, réunions Zoom, négociations. Préparation complète IELTS Academic & General avec 4 tests blancs corrigés.",
    domainSlug: "anglais",
    level: "intermediate",
    durationHours: 65,
    priceXof: 0,
    rating: 48,
    studentsCount: 964,
    whatYouLearn: [
      "Vocabulaire business (finance, tech, RH)",
      "Rédaction d'emails et rapports professionnels",
      "Animation de réunions en anglais",
      "4 tests blancs IELTS corrigés",
      "Entretien d'embauche en anglais",
    ],
    requirements: ["Niveau A2 minimum", "30 min de pratique quotidienne"],
    instructorName: "Mrs. Grace Adeyemi",
  },

  // Développement — 2ᵉ cours
  {
    slug: "flutter-apps-mobiles",
    title: "Flutter & Dart — Apps mobiles Android & iOS",
    subtitle: "Une seule base de code, deux stores",
    description:
      "Développe des applications mobiles performantes et belles avec Flutter : widgets, état avec Riverpod, connexions API, hors-ligne avec Hive, publication sur le Play Store. Capstone : clone d'une app fintech africaine (mobile money).",
    domainSlug: "dev",
    level: "intermediate",
    durationHours: 75,
    priceXof: 0,
    rating: 48,
    studentsCount: 537,
    whatYouLearn: [
      "Langage Dart & widgets Flutter",
      "Gestion d'état avec Riverpod",
      "Consommation d'API REST",
      "Persistance hors-ligne (Hive/SQLite)",
      "Publication sur Play Store",
      "Capstone : app mobile money",
    ],
    requirements: ["Bases d'un langage (JS ou Python)", "Mac non requis (Android suffit)"],
    instructorName: "Kofi Boateng",
  },

  // Data & Analyse — 2ᵉ cours
  {
    slug: "power-bi-dashboards",
    title: "Power BI & Tableaux de bord décisionnels",
    subtitle: "De la donnée brute au dashboard qui parle au CEO",
    description:
      "Inspiré des programmes Data Analytics reconnus : nettoyage et modélisation de données (DAX), storytelling visuel, dashboards de ventes et de logistique pour PME africaines. Tu livreras 4 dashboards professionnels.",
    domainSlug: "data",
    level: "beginner",
    durationHours: 35,
    priceXof: 0,
    rating: 47,
    studentsCount: 1108,
    whatYouLearn: [
      "Nettoyage de données avec Power Query",
      "Modélisation en étoile et mesures DAX",
      "Storytelling : choisir le bon visuel",
      "4 dashboards métier complets",
      "Publication et partage au format web",
    ],
    requirements: ["Aisance avec Excel", "Aucune base de code requise"],
    instructorName: "Éliane Kiptoo",
  },

  // Cybersécurité — 2ᵉ cours
  {
    slug: "soc-analyst-siem",
    title: "SOC Analyst & SIEM — Détecter et répondre aux attaques",
    subtitle: "Le premier emploi cyber le plus demandé en Afrique",
    description:
      "Formation opérationnelle pour postes SOC Tier 1 : surveillance, triangulation d'incidents, SIEM Splunk & Sentinel, playbooks de réponse, préparation CompTIA Security+ et CySA+. Labs sur des logs réels d'entreprises africaines (anonymisés).",
    domainSlug: "cyber",
    level: "intermediate",
    durationHours: 80,
    priceXof: 0,
    rating: 49,
    studentsCount: 302,
    whatYouLearn: [
      "Rôle du SOC et cycle de vie d'un incident",
      "SIEM Splunk et Microsoft Sentinel en pratique",
      "Écriture de règles de détection (Sigma)",
      "Playbooks de réponse à incident",
      "Préparation CompTIA Security+ / CySA+",
    ],
    requirements: ["Bases réseaux (TCP/IP)", "Connaissance Linux recommandée"],
    instructorName: "Mamadou Sy",
  },

  // Intelligence Artificielle — 2ᵉ cours
  {
    slug: "machine-learning-fondamentaux",
    title: "Machine Learning — Fondamentaux solides",
    subtitle: "Régression, classification et arbres avant le deep learning",
    description:
      "Les fondations préalables à l'IA moderne : scikit-learn, feature engineering, validation croisée, métriques, puis projets concrets — scoring de solvabilité micro-finance, prédiction de rendement agricole, détection de fraude mobile money.",
    domainSlug: "ia",
    level: "intermediate",
    durationHours: 60,
    priceXof: 0,
    rating: 48,
    studentsCount: 611,
    whatYouLearn: [
      "Scikit-learn : classification et régression",
      "Feature engineering sur données africaines",
      "Validation croisée et métriques utiles (F1, AUC)",
      "Scoring de crédit micro-finance",
      "Fraude mobile money & rendement agricole",
    ],
    requirements: ["Python niveau débutant+", "Notions de statistiques (moyennes, probas)"],
    instructorName: "Kwasi Appiah",
  },

  // Design UI/UX — 2ᵉ cours
  {
    slug: "motion-design-branding",
    title: "Motion Design & Identité de marque",
    subtitle: "L'animation qui donne vie aux marques africaines",
    description:
      "Crée des identités visuelles et des animations percutantes pour les réseaux sociaux : After Effects, principes du motion, logo animé, kits social media. Projet final : kit complet d'une startup panafricaine.",
    domainSlug: "design",
    level: "beginner",
    durationHours: 40,
    priceXof: 0,
    rating: 46,
    studentsCount: 356,
    whatYouLearn: [
      "Fondamentaux du branding et de la typographie",
      "After Effects : keyframes et easings",
      "Logo animé et intros YouTube",
      "Kit social media animé",
      "Portfolio Ready-to-client",
    ],
    requirements: ["Bases Figma (ou cours UI/UX AfricaSkills)", "PC avec 8 Go de RAM"],
    instructorName: "Coralie Bibassa",
  },

  // Mathématiques — 2 cours (domaine sans cours)
  {
    slug: "stats-pour-la-data",
    title: "Statistiques pour la Data — les vraies bases",
    subtitle: "Comprendre avant de modéliser",
    description:
      "La statistique appliquée qu'attendent les data teams : probabilités, distributions, tests d'hypothèse, p-value sans magie, intervalles de confiance — expliqués avec des datasets africains (santé, marchés, mobile money).",
    domainSlug: "maths",
    level: "beginner",
    durationHours: 50,
    priceXof: 0,
    rating: 47,
    studentsCount: 845,
    whatYouLearn: [
      "Statistique descriptive qui parle",
      "Probabilités et théorème de Bayes",
      "Distributions utiles (normale, binomiale, Poisson)",
      "Tests d'hypothèse et p-value démystifiée",
      "Analyse de datasets africains réels",
    ],
    requirements: ["Bases de calcul collège/lycée"],
    instructorName: "Dr. Halima Yusuf",
  },
  {
    slug: "maths-appliquees-ingenieurs",
    title: "Mathématiques appliquées pour ingénieurs",
    subtitle: "Algèbre linéaire, calcul différentiel, optimisation",
    description:
      "Le socle mathématique de l'ingénieur et du ML : matrices, systèmes, dérivées et intégrales, optimisation avec gradient. Chaque concept est branché sur un problème concret : structures, électricité, machine learning.",
    domainSlug: "maths",
    level: "advanced",
    durationHours: 70,
    priceXof: 0,
    rating: 46,
    studentsCount: 219,
    whatYouLearn: [
      "Algèbre linéaire : matrices et changements de base",
      "Calcul différentiel et intégral appliqué",
      "Optimisation : gradient et méthodes numériques",
      "Lien direct avec le machine learning",
      "Résolution de problèmes d'ingénierie",
    ],
    requirements: ["Bonnes bases au lycée", "Cahier d'exercices inclus"],
    instructorName: "Prof. Serge Mékou",
  },

  // Physique — 2 cours (domaine sans cours)
  {
    slug: "electricite-electronique-debutants",
    title: "Électricité & électronique pratiques — débutants",
    subtitle: "Comprendre le courant avant de coder l'Arduino",
    description:
      "Loi d'Ohm, circuits en série/parallèle, mesures au multimètre, sécurité électrique domestique. Le préalable idéal à la robotique et à l'autoconsommation solaire pour la maison.",
    domainSlug: "physique",
    level: "beginner",
    durationHours: 30,
    priceXof: 0,
    rating: 45,
    studentsCount: 683,
    whatYouLearn: [
      "Tension, courant, résistance et loi d'Ohm",
      "Lecture de schémas et circuits pratiques",
      "Mesure au multimètre en sécurité",
      "Bases de l'électricité domestique",
      "Liens avec les panneaux solaires",
    ],
    requirements: ["Aucun prérequis"],
    instructorName: "Didier Kaboré",
  },
  {
    slug: "energie-solaire-installations",
    title: "Énergie solaire — Dimensionner et installer",
    subtitle: "De la demande du foyer au kit complet prêt à poser",
    description:
      "Dimensionnement de panneaux, batteries et régulateurs pour une habitation africaine, bilan d'énergie solaire, règles antichute et normalisation. Étude de cas : maison rurale + pompe solaire de forage.",
    domainSlug: "physique",
    level: "intermediate",
    durationHours: 45,
    priceXof: 0,
    rating: 48,
    studentsCount: 934,
    whatYouLearn: [
      "Bilan énergétique d'une habitation",
      "Dimensionner panneaux et batteries",
      "Regulateurs PWM vs MPPT",
      "Installation type et sécurité chantier",
      "Cas réel : pompe solaire de forage",
    ],
    requirements: ["Cours électricité débutants (ou équivalent)"],
    instructorName: "Engr. Olayemi Adekunle",
  },

  // Lecture rapide — 2 cours (domaine sans cours)
  {
    slug: "lecture-rapide-3x",
    title: "Lecture rapide niveau 1 — lis 3× plus vite",
    subtitle: "Techniques mesurables de fixation et de balayage",
    description:
      "Méthode progressive : élargissement du champ visuel, lecture en groupes de mots, exercices quotidiens chronométrés sur tes propres textes professionnels. De 250 à 750 mots/min sans perdre la compréhension.",
    domainSlug: "lecture",
    level: "beginner",
    durationHours: 12,
    priceXof: 0,
    rating: 46,
    studentsCount: 1547,
    whatYouLearn: [
      "Élargissement du champ visuel",
      "Lecture en chunks plutôt qu'en mots",
      "Exercices chronométrés quotidiens",
      "Garder la compréhension à grande vitesse",
      "Routine de 15 min par jour",
    ],
    requirements: ["Aucun prérequis"],
    instructorName: "Nadège Ahouansou",
  },
  {
    slug: "memoire-mind-mapping",
    title: "Mémoire & Mind Mapping — retenir l'essentiel",
    subtitle: "Palais de la mémoire et notes visuelles pour examens",
    description:
      "Techniques des champions de mémoire : méthode des lieux, associations visuelles, répétition espacée. Avec le mind mapping d'étude : synthetrise un livre entier sur une page.",
    domainSlug: "lecture",
    level: "beginner",
    durationHours: 15,
    priceXof: 0,
    rating: 47,
    studentsCount: 1204,
    whatYouLearn: [
      "Palais de la mémoire pas à pas",
      "Associations visuelles et histoires",
      "Répétition espacée (courbe d'Ebbinghaus)",
      "Mind mapping de synthèse d'un livre",
      "Application aux examens et concours",
    ],
    requirements: ["Aucun prérequis"],
    instructorName: "Nadège Ahouansou",
  },

  // Ingénierie — 2 cours (domaine sans cours)
  {
    slug: "autocad-cao-debutants",
    title: "AutoCAD & CAO — Dessiner comme un ingénieur",
    subtitle: "2D, cotations et plans pour le bâtiment",
    description:
      "AutoCAD de zéro : interface, commandes essentielles, calques, cotation, mise en page des plans pour chantier. Projet : plan complet d'une maison 4 pièces prêt à l'impression.",
    domainSlug: "ingenierie",
    level: "beginner",
    durationHours: 40,
    priceXof: 0,
    rating: 46,
    studentsCount: 467,
    whatYouLearn: [
      "Interface et commandes AutoCAD essentielles",
      "Calques, bloques et symboles",
      "Cotation et mise en échelle",
      "Mise en page pour impression chantier",
      "Plan complet d'une maison 4 pièces",
    ],
    requirements: ["PC sous Windows (ou exporter le plan via AnyCAD)"],
    instructorName: "Engr. Babatunde Folami",
  },
  {
    slug: "structures-genie-civil",
    title: "Structures & matériaux du génie civil",
    subtitle: "Comprendre avant de bâtir — la logique des ouvrages durables",
    description:
      "Introduction aux lois de la RDM : moments, traction-compression, béton armé, choix des matériaux selon le contexte africain. Étude de cas : ce qui fait tomber un bâtiment et comment l'éviter.",
    domainSlug: "ingenierie",
    level: "intermediate",
    durationHours: 60,
    priceXof: 0,
    rating: 47,
    studentsCount: 288,
    whatYouLearn: [
      "Équilibres, forces et moments",
      "RDM : traction, compression, flexion",
      "Logique du béton armé",
      "Choix de matériaux en contexte africain",
      "Étude de pannes réelles et prévention",
    ],
    requirements: ["Bases de mathématiques appliquées"],
    instructorName: "Tsiri Rasoavelo",
  },

  // Robotique — 2ᵉ cours
  {
    slug: "drones-iot-embarque",
    title: "Drones & IoT embarqué — capteurs qui parlent",
    subtitle: "Du capteur d'humidité de champ au mini-drone téléguidé",
    description:
      "Assemble des objets connectés en Python (MicroPython) : ESP32, capteurs environnementaux, communication LoRa/WiFi, enregistrement sur serveur. Deux projets : station météo de ferme et drone agricole de démarrage.",
    domainSlug: "robotique",
    level: "intermediate",
    durationHours: 65,
    priceXof: 0,
    rating: 48,
    studentsCount: 176,
    whatYouLearn: [
      "MicroPython sur ESP32",
      "Capteurs : température, humidité, sol, lumière",
      "Communication WiFi, Bluetooth, LoRa",
      "Stockage et alertes vers un serveur",
      "Projets : station météo + drone agricole",
    ],
    requirements: ["Bases d'Arduino ou de Python"],
    instructorName: "Chinedu Okafor",
  },

  // Entrepreneuriat — 2ᵉ cours
  {
    slug: "agripreneuriat-agriculture-entreprise",
    title: "Agripreneuriat — De la terre à l'entreprise agricole",
    subtitle: "Business plan, finance verte et accès aux marchés",
    description:
      "Inspiré des grands programmes panafricains d'entrepreneuriat (12 semaines, mentorat, pitching final) : validation de l'idée, études de marché locales, business plan agricole bancable, financements (fonds vert, TEF-style $5k mai 2026).",
    domainSlug: "entrepreneuriat",
    level: "beginner",
    durationHours: 50,
    priceXof: 0,
    rating: 49,
    studentsCount: 1293,
    whatYouLearn: [
      "Valider son idée agricole au précoût",
      "Business plan bancable d'une exploitation",
      "Accès aux marchés et à la transformation",
      "Financements agricoles et pitch de levée",
      "Mentorat business en 12 semaines",
    ],
    requirements: ["Aucun prérequis — idée ou exploitation 0-3 ans"],
    instructorName: "Yacine Belmekki",
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
// PUBLICATIONS DU FIL SOCIAL (démo) — voix de la communauté.
// Insérées UNIQUEMENT si la table posts est vide (démo accueillante,
// pas d'écrasement des publications réelles).
// authorName doit correspondre à un instructeur du seed.
// ============================================================
export const SEED_POSTS: Array<{
  authorName: string;
  content: string;
  imageUrl?: string;
}> = [
  {
    authorName: "Mrs. Grace Adeyemi",
    content:
      "🎯 Session IELTS blanche ce samedi ! Les inscrits à « Anglais des affaires & préparation IELTS » : révisez la leçon sur le Writing Task 2 — structure intro/thèse/exemples/conclusion. Objectif : 7.0+ pour décrocher vos visas d'études ! ✍️",
  },
  {
    authorName: "Kwasi Appiah",
    content:
      "Le capstone Flutter du clone app mobile money arrive à la semaine 5 🚀 N'oubliez pas : l'AFRIQUE de l'app, c'est HORS-LIGNE d'abord. Un utilisateur de Cotonou ou Kano doit pouvoir consulter son historique sans forfait data. Codez pour le 2G, pas pour le 5G.",
  },
  {
    authorName: "Mamadou Sy",
    content:
      "🔴 Alerte SOC : nous avons simulé une campagne de phishing ciblant des PME béninoises en cours d'exercice. Résultat des élèves : 92 % de détection réussie via Splunk en moins de 8 minutes. Les indicateurs étaient cachés dans les logs DNS — les règles Sigma sauvent des vies (numériques).",
  },
  {
    authorName: "Dr. Halima Yusuf",
    content:
      "Question de la semaine posée en ML fondamentaux : « Pourquoi mon modèle de scoring de crédit micro-finance a 99 % de précision mais est inutilisable ? » Réponse en 3 mots : fuite d'étiquette (data leakage). La feature « montant remboursé » n'existe pas AVANT la décision de prêt 😅",
  },
  {
    authorName: "Didier Kaboré",
    content:
      "☀️ Installation d'un kit solaire 1,2 kWc à Ouagadougou cette semaine ! Courbes de charge des batteries lithium vs AGM en commentaire — le lithium gagne sur 8 ans d'usage malgré le prix initial. L'électrification rurale passe par VOUS, futurs installateurs.",
    imageUrl:
      "https://images.unsplash.com/photo-1509391366360-2e959784a276?w=800",
  },
  {
    authorName: "Éliane Kiptoo",
    content:
      "Power BI vs Excel : arrêtez le débat, prenez les DEUX 🙌 Power Query transforme vos exports SAP/paie en données propres, Excel reste votre bloc-notes de calcul. Dashboard logistique du corridor Cotonou–Parakou publié en exemple dans le module 5.",
  },
  {
    authorName: "Coralie Bibassa",
    content:
      "Vos kit social media animés sont… impressionnants 🔥 Motion design module 5 : une startup sénégalaise en vrai brief a été bluffée par 3 de vos portfolios. La VENTE de votre savoir faire compte autant que la technique. Félicitations à toute la promo motion !",
  },
  {
    authorName: "Prof. Serge Mékou",
    content:
      "🧹 Les mathématiques ne sont pas l'ennemi de l'ingénieur — la p-value, si ! (blague de stats). Le dataset vaccination est en ligne pour le module 6 : population réelle anonymisée de 3 pays de la CEDEAO. Interprétez les intervalles de confiance, pas seulement les moyennes.",
  },
  {
    authorName: "Nadège Ahouansou",
    content:
      "PASS n°2 de lecture rapide pour la promo : la médiane est passée de 190 à 420 mots/minute. Et surtout, la compréhension est restée à 85 % 📖 Le mind mapping module 6 va transformer vos révisions — une page A4 = un livre entier.",
  },
  {
    authorName: "Engr. Babatunde Folami",
    content:
      "⚠️ AutoCAD : les 3 erreurs qui font pleurer les chantiers — cotations illisibles à l'échelle 1/50, calques en freestyle, blocs modifiés « côté client ». Plan maison 4 pièces à déposer vendredi minuit. Propreté de dessin = professionnalisme.",
  },
  {
    authorName: "Chinedu Okafor",
    content:
      "Premiers vols de drones agricoles réussis 🚁 sur la parcelle d'essai : cartographie NDVI par imagerie multispectrale simplifiée. 12 ha surveillés en 22 minutes contre 3 jours de scouting à pied. La station météo LoRa remonte ses données sur le dashboard temps réel — regardez le module 5.",
  },
  {
    authorName: "Yacine Belmekki",
    content:
      "💼 Pitch final agripreneuriat : 4 étudiants ont obtenu un financement simulé. Ce qui a fait la différence : pas le PowerPoint, la CLARTÉ du modèle économique. 1 hectare de maraîchage + transformation locale de tomates = marge ×3 par rapport à la vente brute. Le business plan bancable, c'est le module 3.",
  },
];

// Snippets de commentaires de démo (répartis en rond sur les posts)
export const SEED_POST_COMMENTS: string[] = [
  "Bravo, super formation 👏",
  "Je m'inscris de ce pas !",
  "Merci pour ce partage, très inspirant 🙏",
  "On se retrouve samedi pour la session live 🔥",
  "Cette approche a changé ma vision du sujet.",
  "Possible de partager les supports ? 😊",
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

  "business-english-ielts-prep": [
    "Emails professionnels : les 5 structures qui marchent",
    "Animer une réunion Zoom en anglais",
    "Vocabulaire business : finance, tech, RH",
    "IELTS Reading : stratégies de skimming & scanning",
    "IELTS Writing Task 1 & 2 : méthode complète",
    "Test blanc IELTS n°1 corrigé en direct",
  ],
  "flutter-apps-mobiles": [
    "Dart : langage en vitesse pour devs confirmés",
    "Widgets, layouts et navigation entre écrans",
    "Riverpod : la gestion d'état moderne",
    "Appels API REST et gestion des erreurs",
    "Hors-ligne : Hive, SQLite et synchronisation",
    "Capstone : clone d'une app mobile money",
  ],
  "power-bi-dashboards": [
    "Power Query : nettoyer n'importe quel fichier Excel",
    "Modélisation en étoile pas à pas",
    "DAX : mesures, CALCULATE, filtrage",
    "Storytelling : les 8 visuels à maîtriser",
    "Dashboard ventes pour PME béninoise",
    "Dashboard logistique + publication web",
  ],
  "soc-analyst-siem": [
    "Le SOC : rôles, seuils et cycle de l'incident",
    "Splunk : recherches sur des logs réels",
    "Sentinel : connecteurs et workbook de triage",
    "Règles Sigma : écrire une règle de détection",
    "Playbook : réponse à un phishing en équipe",
    "Révision : CompTIA Security+ et CySA+",
  ],
  "machine-learning-fondamentaux": [
    "De la donnée au modèle : le pipeline complet",
    "Régression : prédire un prix ou un rendement",
    "Classification : arbres et forêts",
    "Feature engineering sur données africaines",
    "Projet : scoring de crédit micro-finance",
    "Projet : fraude mobile money",
  ],
  "motion-design-branding": [
    "Branding : le minimum qui fait la différence",
    "After Effects : keyframes et easings",
    "Animer un logo (masque, morphing, écriture)",
    "Intros YouTube et habillage de chaîne",
    "Kit social media animé pour une startup",
    "Livrer un portfolio « prêt client »",
  ],
  "stats-pour-la-data": [
    "Statistique descriptive : moyenne vs médiane",
    "Probabilités au quotidien et théorème de Bayes",
    "Les distributions qu'on croise vraiment",
    "Tests d'hypothèse et p-value démystifiée",
    "Intervalles de confiance en pratique",
    "Étude : campagne de vaccination (dataset réel)",
  ],
  "maths-appliquees-ingenieurs": [
    "Matrices et systèmes linéaires",
    "Changements de base et stabilité",
    "Dérivées et taux de variation appliqués",
    "Intégrales et calcul de surfaces",
    "Optimisation : gradient en 2D visualisé",
    "Le lien avec le machine learning",
  ],
  "electricite-electronique-debutants": [
    "Tension, courant, résistance : la loi d'Ohm",
    "Circuits série et parallèle en pratique",
    "Lire un schéma électrique simple",
    "Mesurer au multimètre sans casse",
    "Électricité de la maison : sécurité & économies",
    "Le chemin du courant solaire maison",
  ],
  "energie-solaire-installations": [
    "Bilan énergétique d'une habitation africaine",
    "Dimensionner panneaux et onduleurs",
    "Batteries : AGM, lithium, cycles et durée",
    "Régulateurs PWM vs MPPT en pratique",
    "Cas : kit solaire maison rurale complet",
    "Cas : pompe solaire de forage",
  ],
  "lecture-rapide-3x": [
    "Mesurer ta vitesse actuelle (PASS n°1)",
    "Élargir le champ visuel : exercices guidés",
    "Lire en groupes de mots, pas en mots",
    "Balayer un document : les 3 balayages",
    "Garder la compréhension à grande vitesse",
    "PASS n°2 : comparaison avant/après",
  ],
  "memoire-mind-mapping": [
    "Comment marche ta mémoire (modèle simple)",
    "Le palais de la mémoire en 5 cases",
    "Associations visuelles et personnages",
    "Répétition espacée : ton planning",
    "Mind Mapping d'étude pas à pas",
    "Synthétiser un livre entier sur une page A4",
  ],
  "autocad-cao-debutants": [
    "Interface AutoCAD : orientation en 20 minutes",
    "Les 10 commandes à connaître à tout prix",
    "Calques, blocs et symboles réutilisables",
    "Cotations et échelles propres",
    "Mise en page pour l'impression chantier",
    "Projet : plan d'une maison 4 pièces",
  ],
  "structures-genie-civil": [
    "Forces, équilibres et moments en 2D",
    "Traction, compression et flexion",
    "Béton et armatures : la logique",
    "Dimensionner une poutre simple",
    "Matériaux en contexte africain",
    "Panne réelle : pourquoi ce bâtiment s'est effondré",
  ],
  "drones-iot-embarque": [
    "MicroPython sur ESP32 : premier clignotement",
    "Lecture de capteurs environnementaux",
    "WiFi vs LoRa : le choix selon la distance",
    "Envoyer des mesures vers un serveur",
    "Station météo de ferme connectée",
    "Drone agricole : matériel, sécurité, législation",
  ],
  "agripreneuriat-agriculture-entreprise": [
    "Agri-inventaire : tes atouts et tes terres",
    "Valider l'idée sans tout miser d'emblée",
    "Business plan bancable d'exploitation",
    "Accès aux marchés et transformation locale",
    "Financements : fonds vert, TEF-style et pitch",
    "Capstone : pitch final et foyer de reprise",
  ],
};
