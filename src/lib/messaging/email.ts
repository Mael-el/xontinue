// ============================================================
// EMAIL — Abstraction d'envoi
//
// Provider actif selon la configuration :
//   - RESEND_API_KEY présent  → Resend (https://resend.com)
//   - sinon → ConsoleEmailProvider (dev : log, rien n'est envoyé)
//
// En production, configurer RESEND_API_KEY + EMAIL_FROM.
// ============================================================

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
}

export interface SendEmailResult {
  delivered: boolean;
  provider: "resend" | "console";
  /** Message d'erreur éventuel (provider) */
  error?: string;
}

const RESEND_API_URL = "https://api.resend.com/emails";
/** Timeout réseau pour l'appel au provider (évite de bloquer la requête) */
const PROVIDER_TIMEOUT_MS = 8_000;

/** Provider Resend — appel HTTPS direct, aucun SDK requis. */
async function sendViaResend(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from =
    process.env.EMAIL_FROM ?? "AfricaSkills <no-reply@africaskills.africa>";

  if (!apiKey) {
    return { delivered: false, provider: "resend", error: "RESEND_API_KEY absente" };
  }

  try {
    const res = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        html: input.html,
      }),
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return {
        delivered: false,
        provider: "resend",
        error: `Resend ${res.status} : ${detail.slice(0, 200)}`,
      };
    }
    return { delivered: true, provider: "resend" };
  } catch (error) {
    return {
      delivered: false,
      provider: "resend",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Provider console — développement : logue, prétend livrer. */
async function sendViaConsole(input: SendEmailInput): Promise<SendEmailResult> {
  console.log(
    `[DEV] ✉️  Email → ${input.to} | ${input.subject}\n` +
      input.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 300)
  );
  return { delivered: true, provider: "console" };
}

/** Indique si l'envoi réel d'emails est configuré (Resend). */
export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

/**
 * Envoie un email transactionnel.
 * N'échoue JAMAIS en exception : le résultat est dans `delivered`.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const result = isEmailConfigured()
    ? await sendViaResend(input)
    : await sendViaConsole(input);

  if (!result.delivered) {
    console.error(`[email] échec d'envoi à ${input.to} : ${result.error}`);
  }
  return result;
}

// ------------------------------------------------------------
// Gabarits transactionnels
// ------------------------------------------------------------

/** Gabarit HTML sobre, palette AfricaSkills. */
function emailShell(title: string, contentHtml: string): string {
  return `<!doctype html>
<html lang="fr">
  <body style="margin:0;padding:0;background:#0A0A0A;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0A0A0A;padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#141414;border-radius:16px;border:1px solid #262626;">
          <tr><td style="padding:28px 32px 8px;">
            <span style="color:#F97316;font-size:18px;font-weight:900;">🌍 AfricaSkills</span>
          </td></tr>
          <tr><td style="padding:8px 32px;color:#FAFAFA;font-size:22px;font-weight:800;">${title}</td></tr>
          <tr><td style="padding:8px 32px 28px;color:#A3A3A3;font-size:14px;line-height:1.6;">${contentHtml}</td></tr>
        </table>
        <p style="color:#525252;font-size:11px;">AfricaSkills — Forme. Certifie. Emploie.</p>
      </td></tr>
    </table>
  </body>
</html>`;
}

/** Email contenant un code OTP (vérification, reset…). */
export function otpEmailTemplate(code: string, purpose: string): {
  subject: string;
  html: string;
} {
  return {
    subject: `${code} — ton code AfricaSkills`,
    html: emailShell(
      purpose,
      `<p>Voici ton code de vérification :</p>
       <p style="text-align:center;margin:24px 0;">
         <span style="display:inline-block;background:#1F1F1F;border:1px solid #F97316;border-radius:12px;color:#F97316;font-size:32px;font-weight:900;letter-spacing:8px;padding:12px 24px;">${code}</span>
       </p>
       <p>Il expire dans <strong>5 minutes</strong>. Si tu n'es pas à l'origine de cette demande, ignore cet email.</p>`
    ),
  };
}

/** Email de réinitialisation de mot de passe (lien à usage unique). */
export function resetPasswordEmailTemplate(resetUrl: string): {
  subject: string;
  html: string;
} {
  return {
    subject: "Réinitialise ton mot de passe AfricaSkills",
    html: emailShell(
      "Mot de passe oublié ?",
      `<p>Clique sur le bouton ci-dessous pour choisir un nouveau mot de passe :</p>
       <p style="text-align:center;margin:24px 0;">
         <a href="${resetUrl}" style="display:inline-block;background:linear-gradient(90deg,#F97316,#F59E0B);color:#000;font-weight:800;text-decoration:none;border-radius:10px;padding:14px 28px;">Réinitialiser mon mot de passe</a>
       </p>
       <p style="word-break:break-all;color:#737373;font-size:12px;">${resetUrl}</p>
       <p>Le lien expire vite. Si tu n'as rien demandé, ignore cet email.</p>`
    ),
  };
}
