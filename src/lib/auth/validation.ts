// ============================================================
// SCHEMAS DE VALIDATION — Zod
// Tous les DTOs d'authentification et de profil.
// ============================================================

import { z } from "zod";

// Règles de mot de passe : min 8, 1 majuscule, 1 chiffre
const passwordRule = z
  .string()
  .min(8, "Le mot de passe doit faire au moins 8 caractères")
  .regex(/[A-Z]/, "Le mot de passe doit contenir au moins 1 majuscule")
  .regex(/[0-9]/, "Le mot de passe doit contenir au moins 1 chiffre");

// Email ou téléphone valide
const emailSchema = z.string().email("Email invalide").trim().toLowerCase();
const phoneSchema = z
  .string()
  .regex(
    /^\+?[0-9\s-]{8,20}$/,
    "Numéro de téléphone invalide (ex: +229 01 00 00 00)"
  )
  .trim();

// ============================================================
// AUTH — Inscription
// ============================================================

export const registerEmailSchema = z.object({
  email: emailSchema,
  fullName: z
    .string()
    .min(2, "Nom trop court")
    .max(100, "Nom trop long")
    .trim(),
  password: passwordRule,
  role: z.enum(["student", "instructor", "mentor", "company"]).default("student"),
  country: z.string().max(100).optional(),
});
export type RegisterEmailDto = z.infer<typeof registerEmailSchema>;

export const registerPhoneSchema = z.object({
  phone: phoneSchema,
  fullName: z.string().min(2).max(100).trim(),
  password: passwordRule,
  role: z.enum(["student", "instructor", "mentor", "company"]).default("student"),
  country: z.string().max(100).optional(),
});
export type RegisterPhoneDto = z.infer<typeof registerPhoneSchema>;

// ============================================================
// AUTH — Login
// ============================================================

export const loginSchema = z.object({
  // Email OU téléphone
  identifier: z.string().min(3).trim(),
  password: z.string().min(1, "Mot de passe requis"),
  totpCode: z.string().length(6).optional(), // si 2FA activé
  device: z.string().max(255).optional(),
});
export type LoginDto = z.infer<typeof loginSchema>;

// ============================================================
// AUTH — Vérification OTP
// ============================================================

export const verifyOtpSchema = z.object({
  userId: z.string().uuid(),
  code: z.string().length(6, "Le code OTP doit faire 6 chiffres"),
  type: z.enum([
    "email_verification",
    "phone_verification",
    "password_reset",
    "login_2fa",
    "sensitive_action",
  ]),
});
export type VerifyOtpDto = z.infer<typeof verifyOtpSchema>;

// ============================================================
// AUTH — Mot de passe oublié / reset
// ============================================================

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});
export type ForgotPasswordDto = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(32, "Token invalide"),
  newPassword: passwordRule,
});
export type ResetPasswordDto = z.infer<typeof resetPasswordSchema>;

// ============================================================
// AUTH — 2FA TOTP
// ============================================================

export const verify2faSchema = z.object({
  code: z.string().length(6, "Le code TOTP doit faire 6 chiffres"),
});
export type Verify2faDto = z.infer<typeof verify2faSchema>;

// ============================================================
// PROFIL — Mise à jour
// ============================================================

export const updateProfileSchema = z.object({
  fullName: z.string().min(2).max(100).trim().optional(),
  bio: z.string().max(1000).optional(),
  country: z.string().max(100).optional(),
  city: z.string().max(100).optional(),
  birthDate: z.string().datetime().optional(),
  website: z.string().url().optional().or(z.literal("")),
  twitter: z.string().max(100).optional().or(z.literal("")),
  linkedin: z.string().url().optional().or(z.literal("")),
  github: z.string().max(100).optional().or(z.literal("")),
});
export type UpdateProfileDto = z.infer<typeof updateProfileSchema>;

// ============================================================
// PROFIL — Skills / Projets
// ============================================================

export const createSkillSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  level: z
    .enum(["novice", "beginner", "intermediate", "advanced", "expert"])
    .default("beginner"),
});
export type CreateSkillDto = z.infer<typeof createSkillSchema>;

export const createProjectSchema = z.object({
  title: z.string().min(1).max(255).trim(),
  description: z.string().max(2000).optional(),
  url: z.string().url().optional().or(z.literal("")),
  repoUrl: z.string().url().optional().or(z.literal("")),
  technologies: z.array(z.string().max(50)).max(20).default([]),
  isFeatured: z.boolean().default(false),
});
export type CreateProjectDto = z.infer<typeof createProjectSchema>;

// ============================================================
// DOMAINES — Intérêts
// ============================================================

export const addUserDomainSchema = z.object({
  domainSlug: z.string().min(1).max(100),
  level: z
    .enum(["novice", "beginner", "intermediate", "advanced", "expert"])
    .default("novice"),
});
export type AddUserDomainDto = z.infer<typeof addUserDomainSchema>;
