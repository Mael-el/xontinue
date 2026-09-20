# 🌍 AfricaSkills

> **La première plateforme panafricaine de formation, certification et emploi.**
> Forme. Certifie. Emploie.

![AfricaSkills](https://img.shields.io/badge/AfricaSkills-Form._Cert._Emploie.-F97316?style=for-the-badge)
![Next.js](https://img.shields.io/badge/Next.js-15-black)
![React](https://img.shields.io/badge/React-19-61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1)
![Drizzle](https://img.shields.io/badge/Drizzle-ORM-C5F74F)

---

## 📋 Vue d'ensemble

AfricaSkills est une plateforme qui :

1. **Forme** les jeunes africains dans 12 domaines d'excellence
2. **Certifie** leurs compétences par un système de badges (XP, raretés)
3. **Connecte** les meilleurs talents aux entreprises partenaires
4. **Accompagne** la création de startups via un incubateur
5. **Impose** l'anglais professionnel en 3 mois (B2 garanti)

### 🎯 Domaines de formation

| Domaine | Icône | Description |
|---------|-------|-------------|
| Anglais | 🇬🇧 | Programme intensif — 3 mois pour le B2 |
| Développement | 💻 | React, Next.js, NestJS, mobile |
| Data & Analyse | 📊 | Python, SQL, Power BI, ML |
| Cybersécurité | 🛡️ | Ethical hacking, pentesting, SOC |
| Intelligence Artificielle | 🤖 | LLMs, RAG, Computer Vision |
| Design UI/UX | 🎨 | Figma, design systems |
| Mathématiques | 🔢 | Algèbre, stats, optimisation |
| Physique | ⚛️ | Mécanique, élec, thermo |
| Lecture rapide | 📚 | Lire 3x plus vite |
| Ingénierie | 🏗️ | Civil, mécanique, électrique |
| Robotique | 🦾 | Arduino, ROS, drones, IoT |
| Entrepreneuriat | 🚀 | Business plan, levée de fonds |

---

## 🏗️ Architecture (cible monorepo)

```
africaskills/
├── frontend/              → Next.js 15 (ce projet)
├── backend/               → NestJS 10 + Prisma (vision)
├── docker-compose.yml     → PostgreSQL 16 + Redis 7 + Meilisearch
└── README.md
```

### Stack technique

| Couche | Technologie |
|--------|-------------|
| **Frontend** | Next.js 15 · React 19 · TypeScript · Tailwind · shadcn/ui · Zustand · React Query |
| **Backend** (actuel) | Next.js Route Handlers + Drizzle ORM + PostgreSQL |
| **Backend** (cible) | NestJS 10 · Prisma · PostgreSQL 16 · Redis 7 · Socket.io · BullMQ |
| **Recherche** | Meilisearch |
| **Stockage** | Cloudflare R2 |
| **Paiements** | FedaPay · KkiaPay · MTN MoMo · Orange Money · Wave · Moov |
| **Email** | Resend |
| **SMS** | AfricasTalking |
| **Hébergement** | Vercel (front) + Railway (back) |

---

## 🚀 Démarrage rapide

### Prérequis

- Node.js 20+
- PostgreSQL 16 — **ou** la base embarquée PGlite (aucun install, voir ci-dessous)

### Option A — Sans PostgreSQL (base embarquée PGlite) ⚡

Pratique pour essayer le projet sans installer PostgreSQL : PGlite est un
vrai PostgreSQL compilé en WebAssembly, exposé sur `127.0.0.1:5432` par
[`scripts/embedded-db.mjs`](./scripts/embedded-db.mjs). L'application (driver
`pg` / Drizzle) fonctionne sans aucune modification.

```bash
# 1. Installer
npm install

# 2. Créer l'environnement pointant sur la base embarquée
cp .env.example .env
#   DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/postgres
#   DATABASE_POOL_MAX=1        ← obligatoire : PGlite n'accepte qu'1 connexion

# 3a. Terminal 1 — base de données embarquée (données persistées dans .pglite/)
npm run db:embedded

# 3b. Terminal 2 — schéma + application
npm run db:push
npm run dev

# 4. Initialiser les données (12 domaines, 8 cours, 80 leçons, 8 badges…)
curl -X POST http://localhost:3000/api/seed
```

> PGlite est un outil de **développement** — en production, utiliser un vrai
> PostgreSQL 16 (option B) et retirer `DATABASE_POOL_MAX`.

### Option B — Avec PostgreSQL 16

```bash
# 1. Cloner et installer
npm install

# 2. Configurer les variables d'environnement
cp .env.example .env
# Éditer .env avec DATABASE_URL

# 3. Pousser le schéma en base
npm run db:push

# 4. Lancer le serveur de dev
npm run dev

# 5. Initialiser les données (12 domaines, 8 cours, 8 badges, 6 entreprises, 6 jobs)
curl -X POST http://localhost:3000/api/seed
```

### Scripts

| Commande | Description |
|----------|-------------|
| `npm run dev` | Lance le serveur de développement |
| `npm run build` | Build de production |
| `npm run start` | Démarre en production |
| `npm run typecheck` | Vérification TypeScript |
| `npm run lint` | ESLint |
| `npm test` | Tests unitaires (Jest + Testing Library) |
| `npm run test:watch` | Tests en mode watch |
| `npm run db:embedded` | Base PostgreSQL embarquée (PGlite, dev sans install) |
| `npm run db:push` | Synchronise le schéma avec la DB |
| `npx drizzle-kit studio` | Interface visuelle Drizzle |

---

## 📁 Structure du projet

```
src/
├── app/
│   ├── (pages)
│   │   ├── page.tsx              # Accueil — hero, domaines, cours vedettes
│   │   ├── courses/
│   │   │   ├── page.tsx          # Catalogue filtrable
│   │   │   └── [slug]/
│   │   │       ├── page.tsx      # Détail d'une formation
│   │   │       ├── CourseCheckout.tsx  # Paiement Mobile Money
│   │   │       ├── CourseReviews.tsx   # Avis vérifiés (notes 1-5★)
│   │   │       └── learn/page.tsx      # Espace d'apprentissage (leçons, XP)
│   │   ├── badges/page.tsx       # Badges & certifications
│   │   ├── leaderboard/page.tsx  # Classement XP (podium + rangs)
│   │   ├── certificates/[id]/    # Certificat public, partageable, imprimable
│   │   ├── instructor/           # Espace formateur (créer/publier leçons & formations)
│   │   ├── settings/page.tsx     # Réglages des notifications (interrupteurs)
│   │   ├── jobs/
│   │   │   ├── page.tsx          # Offres d'emploi
│   │   │   └── [slug]/
│   │   │       ├── page.tsx      # Détail d'une offre
│   │   │       └── JobApplyPanel.tsx   # Candidature (lettre + CV)
│   │   ├── dashboard/page.tsx    # Espace étudiant
│   │   ├── recruiter/page.tsx    # Espace recruteur (offres + candidatures)
│   │   └── about/page.tsx        # À propos
│   ├── api/
│   │   ├── seed/route.ts         # Initialisation de la DB
│   │   ├── courses/              # CRUD cours
│   │   ├── domains/route.ts      # Liste des domaines
│   │   ├── badges/route.ts       # Liste des badges
│   │   ├── jobs/route.ts         # Offres d'emploi
│   │   ├── payments/route.ts     # Paiement Mobile Money (mock)
│   │   ├── health/route.ts       # Healthcheck
│   │   └── v1/
│   │       ├── auth/             # JWT, OTP, 2FA, sessions
│   │       ├── profiles/         # Profil, skills, projets, stats
│   │       ├── dashboard/route.ts# Agrégation tableau de bord
│   │       ├── enrollments/      # Inscriptions + progression leçons
│   │       ├── jobs/             # Candidatures (apply, suivi, retrait)
│   │       ├── notifications/    # Fil de notifications in-app
│   │       └── recruiter/        # Espace entreprise (offres, candidatures)
│   ├── layout.tsx                # Layout global + Navbar + Footer
│   ├── globals.css               # Thème africain (orange/or/émeraude)
│   └── not-found.tsx             # Page 404
├── components/
│   ├── Navbar.tsx                # Navigation sticky (+ cloche 🔔)
│   ├── NotificationBell.tsx      # Centre de notifications
│   ├── Footer.tsx                # Pied de page
│   ├── CourseCard.tsx            # Carte de formation
│   ├── DomainCard.tsx            # Carte de domaine
│   ├── BadgeCard.tsx             # Carte de badge avec rareté
│   └── JobCard.tsx               # Carte d'offre d'emploi
├── db/
│   ├── index.ts                  # Client Drizzle (pool pg, taille via DATABASE_POOL_MAX)
│   └── schema.ts                 # Schéma complet (10 tables)
├── lib/
│   ├── seed-data.ts              # Données de seed (+ 80 leçons)
│   ├── gamification.ts           # XP, séries quotidiennes, badges auto
│   ├── notifications.ts          # Création de notifications (best-effort)
│   ├── recruiter.ts              # Guard requireRecruiter (entreprise)
│   ├── courses-query.ts          # Filtres + tri du catalogue (partagés)
│   ├── payments/                 # Providers (mock/FedaPay/KkiaPay) + règlement
│   ├── auth/                     # JWT, guards, OTP/2FA, rate-limit
│   ├── format.ts                 # Utilitaires (XOF, rareté, etc.)
│   └── **/__tests__/             # Tests unitaires (Jest + Testing Library)
└── scripts/
    └── embedded-db.mjs           # PostgreSQL embarqué PGlite (dev sans install)
```

---

## 🗄️ Schéma de données

**10 tables principales :**

- `users` — étudiants, instructeurs, entreprises, admins
- `domains` — les 12 domaines de formation
- `courses` — formations avec prix en FCFA
- `lessons` — leçons d'un cours (vidéo + contenu)
- `enrollments` — inscriptions des étudiants
- `badges` — certifications (common / rare / epic / legendary)
- `user_badges` — badges obtenus par les étudiants
- `lesson_completions` — leçons validées (unique user+lesson, XP attribué)
- `course_reviews` — avis vérifiés (1-5★, unique user+cours, note recalculée)
- `users.notification_prefs` — préférences de notifications (JSON, catégories learning/applications/payments)
- `notifications` — fil de notifications in-app (badge, cours, candidature…)
- `payments` — paiements Mobile Money (FedaPay, KkiaPay, MTN, Orange, Moov, Wave)
- `companies` — entreprises partenaires
- `jobs` — offres d'emploi

Voir [`src/db/schema.ts`](./src/db/schema.ts) pour le détail.

---

## 💳 Paiements Mobile Money

Le module v1 (`/api/v1/payments`) implémente le flux réel des providers de
paiement, derrière une **abstraction interchangeable** (`src/lib/payments/`) :

1. `POST /api/v1/payments` → initiation → paiement **pending** + instructions
2. Le provider confirme plus tard via `POST /api/v1/payments/webhook`
   (en-tête `x-webhook-secret`, remplacé par une signature HMAC en prod)
3. Au succès → paiement **success** + **inscription auto** + notification

Le provider actif est choisi par `PAYMENTS_PROVIDER` (`mock` par défaut,
`fedapay` / `kkiapay` quand les clés sont configurées). En mode **mock**, la
confirmation est simulée par le bouton démo du checkout qui appelle
`POST /api/v1/payments/[reference]/confirm`.

- **MTN Mobile Money** 🟡 · **Orange Money** 🟠 · **Moov Money** 🔵
- **FedaPay** 💳 · **KkiaPay** ⚡

**En production**, il reste à :

1. Implémenter l'appel API dans `FedaPayProvider.initiate()` (squelette prêt)
2. Vérifier la signature HMAC du webhook au lieu du secret d'en-tête
3. Configurer l'URL du webhook dans le back-office provider
4. Implémenter la réconciliation comptable

Exemple d'appel (authentifié) :

```bash
curl -X POST http://localhost:3000/api/v1/payments \
  -H "Content-Type: application/json" \
  -H "Cookie: as_access=…" \
  -d '{
    "courseSlug": "react-nextjs-fullstack",
    "phoneNumber": "+229 01 00 00 00",
    "method": "mtn_mobile_money"
  }'
```

---

## 🔌 API Routes

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/api/health` | GET | Healthcheck |
| `/api/seed` | POST | Initialise la DB (+ leçons, idempotent) |
| `/api/seed` | GET | Compte les entités |
| `/api/domains` | GET | Liste des 12 domaines |
| `/api/courses` | GET | Catalogue (filtres : `?domain=`, `?q=` titre+sous-titre+description, `?level=`, `?price=free\|paid`, `?sort=popular\|rating\|newest\|price_asc\|price_desc`, `?limit=`) |
| `/api/courses/[slug]` | GET | Détail d'un cours |
| `/api/badges` | GET | Tous les badges |
| `/api/jobs` | GET | Offres d'emploi actives |
| `/api/payments` | POST | Paiement Mobile Money (mock, rattache à l'utilisateur connecté) |
| `/api/v1/enrollments` | GET | 🔐 Mes inscriptions (cours + domaine + progression) |
| `/api/v1/enrollments` | POST | 🔐 S'inscrire à un cours (gratuit ou 402 si paiement requis) |
| `/api/v1/enrollments/[courseSlug]` | GET | 🔐 Détail : leçons + état de complétion + XP |
| `/api/v1/enrollments/[courseSlug]` | DELETE | 🔐 Se désinscrire (progression conservée) |
| `/api/v1/enrollments/[courseSlug]/lessons/[lessonId]/complete` | POST | 🔐 Valide une leçon → XP, progression, bonus, badges |
| `/api/v1/jobs/applications` | GET | 🔐 Mes candidatures (offre + entreprise) |
| `/api/v1/jobs/applications/[id]` | GET / DELETE | 🔐 Détail / retirer ma candidature |
| `/api/v1/jobs/[jobId]/apply` | GET / POST | 🔐 Statut de ma candidature / postuler (409 si doublon, 410 si expirée) |
| `/api/v1/notifications` | GET / PATCH | 🔐 Mes notifications + compteur / marquer lues (`{id}`, `{ids}`, `{all:true}`) |
| `/api/v1/recruiter/company` | GET / POST | 🔐 Mon entreprise + stats / créer (409 si doublon) |
| `/api/v1/recruiter/jobs` | GET / POST | 🔐 Mes offres / publier une offre |
| `/api/v1/recruiter/applications` | GET | 🔐 Candidatures reçues (`?jobId=` optionnel) |
| `/api/v1/recruiter/applications/[id]` | PATCH | 🔐 Changer le statut d'une candidature → notifie le candidat |
| `/api/v1/payments` | GET / POST | 🔐 Historique / initier un paiement (→ pending, anti-doublon) |
| `/api/v1/payments/[reference]` | GET | 🔐 Statut d'un paiement (polling checkout) |
| `/api/v1/payments/[reference]/confirm` | POST | 🔐 🧪 Démo mock : simule la confirmation Mobile Money |
| `/api/v1/payments/webhook` | POST | 🔑 Callback provider (`x-webhook-secret`) → règlement idempotent |
| `/api/v1/courses/[slug]/reviews` | GET | Avis d'un cours + moyenne + distribution (public) |
| `/api/v1/courses/[slug]/reviews` | POST / DELETE | 🔐 Déposer/modifier (upsert) / supprimer mon avis — **étudiants inscrits uniquement**, note du cours recalculée |
| `/api/v1/leaderboard` | GET | Classement public XP (`?limit=`) + `currentUser` si connecté |
| `/api/v1/certificates/[id]` | GET | Vérification publique d'un certificat (formation terminée uniquement) |
| `/api/v1/profiles/[id]` | GET | Profil public enrichi : rang classement, certificats vérifiables, avis laissés |
| `/api/v1/admin/overview` | GET | 🛡️ Stats plateforme temps réel (utilisateurs, revenus, avis, inscriptions 14j) |
| `/api/v1/admin/reviews` / `[id]` | GET / DELETE | 🛡️ Derniers avis / modération (suppression + note recalculée) |
| `/api/v1/admin/users` / `[id]` | GET / PATCH | 🛡️ Recherche utilisateurs (`?q=`, `?role=`) / suspendre-réactiver (pas soi ni admin) |
| `/api/v1/instructor/courses` | GET / POST | 🧑‍🏫 Mes formations + stats / créer un brouillon |
| `/api/v1/instructor/courses/[id]` | PATCH / DELETE | 🧑‍🏫 Modifier, `publish` (≥1 leçon) / `unpublish` / supprimer (409 si inscrits) |
| `/api/v1/instructor/courses/[id]/lessons` | GET / POST | 🧑‍🏫 Leçons ordonnées / ajouter (durée du cours recalculée) |
| `/api/v1/instructor/courses/[id]/lessons/[lessonId]` | DELETE | 🧑‍🏫 Supprimer une leçon |
| `/api/v1/me/notification-prefs` | GET / PATCH | 🔐 Mes préférences de notifications (mutuellement exclusives par catégorie) |

🔐 = authentification requise (cookie JWT `as_access`).
🔑 = secret partagé (`PAYMENTS_WEBHOOK_SECRET`).

Chaque leçon validée rapporte **+10 XP** ; terminer un cours à 100 % rapporte
**+100 XP de bonus** et déclenche l'attribution automatique des badges dont le
seuil d'XP est atteint (voir `src/lib/gamification.ts`).

---

## 🎨 Design system

**Palette africaine :**

- **Orange** `#F97316` — énergie, action
- **Or** `#F59E0B` — richesse, réussite
- **Émeraude** `#059669` — nature, croissance
- **Fond noir** `#0A0A0A` — élégance moderne

**Raretés de badges :**

- 🥉 **Common** — gris
- 💎 **Rare** — bleu ciel
- ⚡ **Epic** — violet
- 🌟 **Legendary** — or → rouge

---

## 🧭 Vision monorepo complète (NestJS backend)

La version actuelle utilise Next.js Route Handlers. Pour la mise en production, l'architecture cible est :

```
backend/  (NestJS 10)
├── src/
│   ├── modules/
│   │   ├── auth/         # JWT, refresh, OAuth (Google/GitHub)
│   │   ├── users/        # CRUD users + profils
│   │   ├── domains/      # Gestion des 12 domaines
│   │   ├── courses/      # CRUD cours + leçons + progression
│   │   ├── enrollments/  # Inscriptions + progression
│   │   ├── badges/       # Attribution de badges (events)
│   │   ├── payments/     # FedaPay, KkiaPay, webhooks
│   │   ├── companies/    # Entreprises partenaires
│   │   ├── jobs/         # Offres d'emploi
│   │   ├── search/       # Meilisearch (cours, jobs, users)
│   │   ├── notifications/# Email (Resend) + SMS (AfricasTalking)
│   │   └── realtime/     # Socket.io (chat, notifs live)
│   ├── common/           # Guards, decorators, filters, interceptors
│   ├── config/           # ConfigModule + validation
│   └── main.ts
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
└── docker-compose.yml
```

### Modules NestJS à implémenter (prompt par prompt)

1. **Auth** — JWT + refresh + guards
2. **Users** — CRUD + profils + upload avatar (R2)
3. **Domains & Courses** — catalogue complet
4. **Enrollments** — progression + leçons
5. **Badges** — système XP + attribution event-driven
6. **Payments** — FedaPay + KkiaPay + webhooks
7. **Companies & Jobs** — marché de l'emploi
8. **Search** — Meilisearch (cours, jobs)
9. **Notifications** — Resend + AfricasTalking + BullMQ
10. **Realtime** — Socket.io (chat, live)

---

## ✅ Règles de développement

- ✅ **TypeScript strict** partout
- ✅ **Commentaires en français**
- ✅ **Principes SOLID**
- ✅ **Tests unitaires** (Jest + Testing Library)
- ✅ **Gestion d'erreurs** centralisée
- ✅ **Variables d'environnement** (jamais de secrets en dur)
- ✅ **Documentation Swagger** sur toutes les routes API

---

## 🌐 Variables d'environnement

```env
# Base de données
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/africaskills
# Pool de connexions — mettre 1 UNIQUEMENT avec la base embarquée PGlite
# DATABASE_POOL_MAX=1

# Paiements
FEDAPAY_PUBLIC_KEY=
FEDAPAY_SECRET_KEY=
FEDAPAY_MODE=sandbox
KKIAPAY_PUBLIC_KEY=
KKIAPAY_PRIVATE_KEY=

# Stockage
CLOUDFLARE_R2_ACCOUNT_ID=
CLOUDFLARE_R2_ACCESS_KEY=
CLOUDFLARE_R2_SECRET_KEY=
CLOUDFLARE_R2_BUCKET=africaskills

# Email & SMS
RESEND_API_KEY=
AFRICASTALKING_API_KEY=
AFRICASTALKING_USERNAME=

# Recherche
MEILISEARCH_URL=http://localhost:7700
MEILISEARCH_MASTER_KEY=

# Redis (queues BullMQ)
REDIS_URL=redis://localhost:6379

# Auth
JWT_SECRET=
JWT_REFRESH_SECRET=
```

---

## 📊 Roadmap

### Phase 1 — MVP (actuel)
- [x] Landing page
- [x] Catalogue formations
- [x] Détail cours + checkout Mobile Money (mock)
- [x] Système de badges
- [x] Offres d'emploi
- [x] Dashboard étudiant

### Phase 2 — Backend NestJS
- [ ] Migration vers NestJS + Prisma
- [ ] Authentification JWT
- [ ] Paiements réels FedaPay/KkiaPay
- [ ] Upload vidéo sur Cloudflare R2
- [x] Progression réelle + leçons (XP, badges auto — vidéos à brancher sur R2)

### Phase 3 — Engagement
- [ ] Programme anglais intensif 3 mois
- [ ] Chat Socket.io (étudiants + mentors)
- [ ] Recherche Meilisearch
- [ ] Notifications email + SMS

### Phase 4 — Échelle
- [ ] Incubateur de startups
- [ ] Gamification avancée (clans, défis, tournois)
- [ ] Application mobile (React Native)
- [ ] Expansion 15 pays africains

---

## 🤝 Contribution

AfricaSkills est un projet open pour l'Afrique. Pour contribuer :

1. Fork le projet
2. Crée une branche (`feat/nom-feature`)
3. Commit avec messages conventionnels
4. Ouvre une PR

---

## 📄 Licence

MIT © 2026 AfricaSkills — **Made with 🧡 in Africa.**

---

<div align="center">

**🌍 L'Afrique forme. L'Afrique embauche. 🌍**

</div>
