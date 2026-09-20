// ============================================================
// SCHÉMA PRINCIPAL D'AFRICASKILLS
// Plateforme africaine de formation, certification et emploi
// ============================================================

import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
  boolean,
  jsonb,
  pgEnum,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ============================================================
// ENUMS — Rôles, statuts, niveaux
// ============================================================

export const userRoleEnum = pgEnum("user_role", [
  "student",
  "instructor",
  "mentor",
  "company",
  "admin",
]);

export const userStatusEnum = pgEnum("user_status", [
  "pending",
  "active",
  "suspended",
  "banned",
]);

export const courseStatusEnum = pgEnum("course_status", [
  "draft",
  "published",
  "archived",
]);

export const courseLevelEnum = pgEnum("course_level", [
  "beginner",
  "intermediate",
  "advanced",
  "expert",
]);

export const enrollmentStatusEnum = pgEnum("enrollment_status", [
  "active",
  "completed",
  "cancelled",
]);

export const paymentMethodEnum = pgEnum("payment_method", [
  "mtn_mobile_money",
  "orange_money",
  "moov_money",
  "fingerprint_bank",
  "credit_card",
  "fedapay",
  "kkiapay",
]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "success",
  "failed",
  "refunded",
]);

export const badgeRarityEnum = pgEnum("badge_rarity", [
  "common",
  "rare",
  "epic",
  "legendary",
]);

export const jobTypeEnum = pgEnum("job_type", [
  "full_time",
  "part_time",
  "freelance",
  "internship",
  "contract",
]);

export const jobApplicationStatusEnum = pgEnum("job_application_status", [
  "pending", // envoyée, en attente de lecture
  "reviewed", // examinée par le recruteur
  "shortlisted", // présélectionnée
  "interview", // entretien planifié
  "accepted", // offre acceptée
  "rejected", // refusée
  "withdrawn", // retirée par le candidat
]);

export const otpTypeEnum = pgEnum("otp_type", [
  "email_verification",
  "phone_verification",
  "password_reset",
  "login_2fa",
  "sensitive_action",
]);

export const verificationStatusEnum = pgEnum("verification_status", [
  "pending",
  "approved",
  "rejected",
]);

export const skillLevelEnum = pgEnum("skill_level", [
  "novice",
  "beginner",
  "intermediate",
  "advanced",
  "expert",
]);

export const notificationTypeEnum = pgEnum("notification_type", [
  "badge_earned", // nouveau badge débloqué
  "course_completed", // formation terminée à 100 %
  "application_status", // statut de candidature modifié
  "enrollment", // inscription à un cours confirmée
  "payment_success", // paiement confirmé
  "system", // message générique
]);

// ============================================================
// NOTIFICATIONS — Fil de notifications in-app
// ============================================================

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    type: notificationTypeEnum("type").default("system").notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    body: text("body"),
    /** Lien interne vers la ressource concernée (/badges, /dashboard…) */
    href: varchar("href", { length: 500 }),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    userReadIdx: index("notifications_user_read_idx").on(
      table.userId,
      table.readAt
    ),
    userCreatedIdx: index("notifications_user_created_idx").on(
      table.userId,
      table.createdAt
    ),
  })
);

// ============================================================
// TABLES UTILISATEURS (avec authentification)
// ============================================================

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 255 }).unique(),
    phone: varchar("phone", { length: 20 }).unique(),
    passwordHash: varchar("password_hash", { length: 255 }),
    fullName: varchar("full_name", { length: 255 }).notNull(),
    role: userRoleEnum("role").notNull().default("student"),
    status: userStatusEnum("status").notNull().default("pending"),
    country: varchar("country", { length: 100 }).default("Bénin"),
    city: varchar("city", { length: 100 }),
    emailVerified: boolean("email_verified").default(false),
    phoneVerified: boolean("phone_verified").default(false),
    twoFactorEnabled: boolean("two_factor_enabled").default(false),
    twoFactorSecret: varchar("two_factor_secret", { length: 100 }),
    failedAttempts: integer("failed_attempts").default(0).notNull(),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    lastLoginIp: varchar("last_login_ip", { length: 50 }),
    lastLoginDevice: varchar("last_login_device", { length: 255 }),
    // Profil intégré
    avatarUrl: varchar("avatar_url", { length: 500 }),
    coverUrl: varchar("cover_url", { length: 500 }),
    bio: text("bio"),
    birthDate: timestamp("birth_date", { withTimezone: true }),
    website: varchar("website", { length: 255 }),
    twitter: varchar("twitter", { length: 100 }),
    linkedin: varchar("linkedin", { length: 255 }),
    github: varchar("github", { length: 100 }),
    isVerifiedIdentity: boolean("is_verified_identity").default(false),
    // Gamification
    englishLevel: integer("english_level").default(0),
    xp: integer("xp").default(0).notNull(),
    streak: integer("streak").default(0).notNull(),
    lastActivityAt: timestamp("last_activity_at", { withTimezone: true }),
    // Préférences de notifications in-app (null = tout activé)
    notificationPrefs: jsonb("notification_prefs").$type<{
      learning?: boolean;
      applications?: boolean;
      payments?: boolean;
    }>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    emailIdx: index("users_email_idx").on(table.email),
    phoneIdx: index("users_phone_idx").on(table.phone),
    roleIdx: index("users_role_idx").on(table.role),
    statusIdx: index("users_status_idx").on(table.status),
  })
);

// ============================================================
// SESSIONS — Gestion multi-appareils
// ============================================================

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    refreshTokenHash: varchar("refresh_token_hash", { length: 255 }).notNull(),
    device: varchar("device", { length: 255 }),
    os: varchar("os", { length: 100 }),
    browser: varchar("browser", { length: 100 }),
    ip: varchar("ip", { length: 50 }),
    country: varchar("country", { length: 100 }),
    city: varchar("city", { length: 100 }),
    userAgent: text("user_agent"),
    isCurrent: boolean("is_current").default(false),
    isSuspicious: boolean("is_suspicious").default(false),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    userIdIdx: index("sessions_user_id_idx").on(table.userId),
    expiresIdx: index("sessions_expires_idx").on(table.expiresAt),
  })
);

// ============================================================
// OTP — Codes à usage unique
// ============================================================

export const otpCodes = pgTable(
  "otp_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    code: varchar("code", { length: 10 }).notNull(),
    type: otpTypeEnum("type").notNull(),
    target: varchar("target", { length: 255 }), // email ou phone cible
    attempts: integer("attempts").default(0).notNull(),
    verified: boolean("verified").default(false),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    userIdTypeIdx: index("otp_user_type_idx").on(table.userId, table.type),
    expiresIdx: index("otp_expires_idx").on(table.expiresAt),
  })
);

// ============================================================
// RESET PASSWORD — Tokens de réinitialisation
// ============================================================

export const passwordResets = pgTable(
  "password_resets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    tokenHash: varchar("token_hash", { length: 255 }).notNull().unique(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    tokenIdx: index("password_reset_token_idx").on(table.tokenHash),
  })
);

// ============================================================
// USER DOMAINS — Domaines suivis par l'utilisateur
// ============================================================

export const userDomains = pgTable(
  "user_domains",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    domainId: uuid("domain_id")
      .references(() => domains.id, { onDelete: "cascade" })
      .notNull(),
    level: skillLevelEnum("level").default("novice").notNull(),
    interestScore: integer("interest_score").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    userDomainIdx: index("user_domains_unique_idx").on(
      table.userId,
      table.domainId
    ),
  })
);

// ============================================================
// USER SKILLS — Compétences déclarées
// ============================================================

export const userSkills = pgTable("user_skills", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  level: skillLevelEnum("level").default("beginner").notNull(),
  endorsedCount: integer("endorsed_count").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ============================================================
// USER PROJECTS — Portfolio
// ============================================================

export const userProjects = pgTable("user_projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  url: varchar("url", { length: 500 }),
  repoUrl: varchar("repo_url", { length: 500 }),
  thumbnailUrl: varchar("thumbnail_url", { length: 500 }),
  technologies: jsonb("technologies").$type<string[]>().default([]),
  isFeatured: boolean("is_featured").default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ============================================================
// IDENTITY VERIFICATION — Vérification d'identité
// ============================================================

export const identityVerifications = pgTable("identity_verifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  documentType: varchar("document_type", { length: 50 }), // CNI, passport, permis
  documentNumber: varchar("document_number", { length: 100 }),
  documentUrl: varchar("document_url", { length: 500 }),
  selfieUrl: varchar("selfie_url", { length: 500 }),
  status: verificationStatusEnum("status").default("pending").notNull(),
  reviewerNotes: text("reviewer_notes"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ============================================================
// DOMAINES DE FORMATION
// ============================================================

export const domains = pgTable("domains", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  name: varchar("name", { length: 150 }).notNull(),
  description: text("description"),
  icon: varchar("icon", { length: 50 }),
  color: varchar("color", { length: 20 }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ============================================================
// COURS
// ============================================================

export const courses = pgTable(
  "courses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: varchar("slug", { length: 200 }).notNull().unique(),
    title: varchar("title", { length: 255 }).notNull(),
    subtitle: varchar("subtitle", { length: 500 }),
    description: text("description"),
    domainId: uuid("domain_id")
      .references(() => domains.id, { onDelete: "cascade" })
      .notNull(),
    instructorId: uuid("instructor_id")
      .references(() => users.id, { onDelete: "set null" }),
    level: courseLevelEnum("level").default("beginner").notNull(),
    durationHours: integer("duration_hours").default(0),
    priceXof: integer("price_xof").default(0).notNull(),
    language: varchar("language", { length: 20 }).default("fr"),
    thumbnailUrl: varchar("thumbnail_url", { length: 500 }),
    requirements: jsonb("requirements").$type<string[]>().default([]),
    whatYouLearn: jsonb("what_you_learn").$type<string[]>().default([]),
    status: courseStatusEnum("status").default("published").notNull(),
    rating: integer("rating").default(0),
    studentsCount: integer("students_count").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    slugIdx: index("courses_slug_idx").on(table.slug),
    domainIdx: index("courses_domain_idx").on(table.domainId),
    statusIdx: index("courses_status_idx").on(table.status),
  })
);

// ============================================================
// LEÇONS
// ============================================================

export const lessons = pgTable("lessons", {
  id: uuid("id").primaryKey().defaultRandom(),
  courseId: uuid("course_id")
    .references(() => courses.id, { onDelete: "cascade" })
    .notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content"),
  videoUrl: varchar("video_url", { length: 500 }),
  order: integer("order").default(0).notNull(),
  durationMinutes: integer("duration_minutes").default(0),
  xpReward: integer("xp_reward").default(10).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ============================================================
// INSCRIPTIONS AUX COURS
// ============================================================

export const enrollments = pgTable(
  "enrollments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    courseId: uuid("course_id")
      .references(() => courses.id, { onDelete: "cascade" })
      .notNull(),
    progress: integer("progress").default(0).notNull(),
    status: enrollmentStatusEnum("status").default("active").notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    enrolledAt: timestamp("enrolled_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    userCourseIdx: index("enrollments_user_course_idx").on(
      table.userId,
      table.courseId
    ),
  })
);

// ============================================================
// AVIS SUR LES COURS — Notes (1-5) + commentaires vérifiés
// Seuls les étudiants inscrits peuvent noter une formation.
// ============================================================

export const courseReviews = pgTable(
  "course_reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    courseId: uuid("course_id")
      .references(() => courses.id, { onDelete: "cascade" })
      .notNull(),
    /** Note de 1 à 5 étoiles */
    rating: integer("rating").notNull(),
    comment: text("comment"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    // Un seul avis par étudiant et par cours
    userCourseIdx: uniqueIndex("course_reviews_user_course_unique").on(
      table.userId,
      table.courseId
    ),
    courseIdx: index("course_reviews_course_idx").on(table.courseId),
  })
);

// ============================================================
// PROGRESSION DES LEÇONS — Complétion par utilisateur
// ============================================================

export const lessonCompletions = pgTable(
  "lesson_completions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    lessonId: uuid("lesson_id")
      .references(() => lessons.id, { onDelete: "cascade" })
      .notNull(),
    enrollmentId: uuid("enrollment_id")
      .references(() => enrollments.id, { onDelete: "cascade" })
      .notNull(),
    xpAwarded: integer("xp_awarded").default(10).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    userLessonIdx: uniqueIndex("lesson_completions_user_lesson_unique").on(
      table.userId,
      table.lessonId
    ),
    enrollmentIdx: index("lesson_completions_enrollment_idx").on(
      table.enrollmentId
    ),
  })
);

// ============================================================
// BADGES
// ============================================================

export const badges = pgTable("badges", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  name: varchar("name", { length: 150 }).notNull(),
  description: text("description"),
  icon: varchar("icon", { length: 50 }),
  rarity: badgeRarityEnum("rarity").default("common").notNull(),
  domainId: uuid("domain_id").references(() => domains.id, {
    onDelete: "set null",
  }),
  requiredXp: integer("required_xp").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const userBadges = pgTable("user_badges", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  badgeId: uuid("badge_id")
    .references(() => badges.id, { onDelete: "cascade" })
    .notNull(),
  awardedAt: timestamp("awarded_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ============================================================
// PAIEMENTS
// ============================================================

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    courseId: uuid("course_id").references(() => courses.id, {
      onDelete: "set null",
    }),
    amountXof: integer("amount_xof").notNull(),
    method: paymentMethodEnum("method").notNull(),
    status: paymentStatusEnum("status").default("pending").notNull(),
    providerReference: varchar("provider_reference", { length: 255 }),
    phoneNumber: varchar("phone_number", { length: 30 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    userStatusIdx: index("payments_user_status_idx").on(
      table.userId,
      table.status
    ),
  })
);

// ============================================================
// ENTREPRISES + EMPLOIS
// ============================================================

export const companies = pgTable("companies", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 200 }).notNull().unique(),
  country: varchar("country", { length: 100 }),
  city: varchar("city", { length: 100 }),
  industry: varchar("industry", { length: 100 }),
  logoUrl: varchar("logo_url", { length: 500 }),
  description: text("description"),
  website: varchar("website", { length: 500 }),
  isVerified: boolean("is_verified").default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .references(() => companies.id, { onDelete: "cascade" })
      .notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 255 }).notNull().unique(),
    description: text("description"),
    type: jobTypeEnum("type").default("full_time").notNull(),
    location: varchar("location", { length: 200 }),
    isRemote: boolean("is_remote").default(false),
    salaryMinXof: integer("salary_min_xof"),
    salaryMaxXof: integer("salary_max_xof"),
    requiredBadges: jsonb("required_badges").$type<string[]>().default([]),
    applicationsCount: integer("applications_count").default(0).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    companyIdx: index("jobs_company_idx").on(table.companyId),
    typeIdx: index("jobs_type_idx").on(table.type),
  })
);

// Candidatures aux offres d'emploi
export const jobApplications = pgTable(
  "job_applications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    jobId: uuid("job_id")
      .references(() => jobs.id, { onDelete: "cascade" })
      .notNull(),
    coverLetter: text("cover_letter"),
    cvUrl: varchar("cv_url", { length: 500 }),
    status: jobApplicationStatusEnum("status").default("pending").notNull(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    // Un utilisateur ne peut postuler qu'une fois par offre
    userJobIdx: uniqueIndex("job_applications_user_job_unique").on(
      table.userId,
      table.jobId
    ),
    userIdx: index("job_applications_user_idx").on(table.userId),
  })
);

// ============================================================
// RELATIONS DRIZZLE
// ============================================================

export const domainsRelations = relations(domains, ({ many }) => ({
  courses: many(courses),
  badges: many(badges),
  userDomains: many(userDomains),
}));

export const coursesRelations = relations(courses, ({ one, many }) => ({
  domain: one(domains, {
    fields: [courses.domainId],
    references: [domains.id],
  }),
  instructor: one(users, {
    fields: [courses.instructorId],
    references: [users.id],
  }),
  lessons: many(lessons),
  enrollments: many(enrollments),
  reviews: many(courseReviews),
}));

export const courseReviewsRelations = relations(courseReviews, ({ one }) => ({
  user: one(users, {
    fields: [courseReviews.userId],
    references: [users.id],
  }),
  course: one(courses, {
    fields: [courseReviews.courseId],
    references: [courses.id],
  }),
}));

export const lessonsRelations = relations(lessons, ({ one, many }) => ({
  course: one(courses, {
    fields: [lessons.courseId],
    references: [courses.id],
  }),
  completions: many(lessonCompletions),
}));

export const enrollmentsRelations = relations(enrollments, ({ one, many }) => ({
  user: one(users, {
    fields: [enrollments.userId],
    references: [users.id],
  }),
  course: one(courses, {
    fields: [enrollments.courseId],
    references: [courses.id],
  }),
  lessonCompletions: many(lessonCompletions),
}));

export const lessonCompletionsRelations = relations(
  lessonCompletions,
  ({ one }) => ({
    user: one(users, {
      fields: [lessonCompletions.userId],
      references: [users.id],
    }),
    lesson: one(lessons, {
      fields: [lessonCompletions.lessonId],
      references: [lessons.id],
    }),
    enrollment: one(enrollments, {
      fields: [lessonCompletions.enrollmentId],
      references: [enrollments.id],
    }),
  })
);

export const usersRelations = relations(users, ({ many }) => ({
  enrollments: many(enrollments),
  payments: many(payments),
  userBadges: many(userBadges),
  sessions: many(sessions),
  otpCodes: many(otpCodes),
  userDomains: many(userDomains),
  userSkills: many(userSkills),
  userProjects: many(userProjects),
  jobApplications: many(jobApplications),
  lessonCompletions: many(lessonCompletions),
  notifications: many(notifications),
  courseReviews: many(courseReviews),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const badgesRelations = relations(badges, ({ one }) => ({
  domain: one(domains, {
    fields: [badges.domainId],
    references: [domains.id],
  }),
}));

export const companiesRelations = relations(companies, ({ one, many }) => ({
  user: one(users, {
    fields: [companies.userId],
    references: [users.id],
  }),
  jobs: many(jobs),
}));

export const jobsRelations = relations(jobs, ({ one, many }) => ({
  company: one(companies, {
    fields: [jobs.companyId],
    references: [companies.id],
  }),
  applications: many(jobApplications),
}));

export const jobApplicationsRelations = relations(
  jobApplications,
  ({ one }) => ({
    user: one(users, {
      fields: [jobApplications.userId],
      references: [users.id],
    }),
    job: one(jobs, {
      fields: [jobApplications.jobId],
      references: [jobs.id],
    }),
  })
);

// ============================================================
// MODULES TEMPS RÉEL — ré-exportés (déclarés dans leurs fichiers)
// ============================================================

export * from "./schema-workspace";
export * from "./schema-chat";
