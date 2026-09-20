// ============================================================
// SMS — Abstraction d'envoi
//
// Provider actif selon la configuration :
//   - AFRICASTALKING_API_KEY + USERNAME présents → Africa's Talking
//   - sinon → ConsoleSmsProvider (dev : log, rien n'est envoyé)
//
// En production, configurer AFRICASTALKING_API_KEY,
// AFRICASTALKING_USERNAME (compte live) et optionnellement
// AFRICASTALKING_SENDER_ID.
// ============================================================

export interface SendSmsInput {
  /** Numéro au format international, ex: +22901000000 */
  to: string;
  message: string;
}

export interface SendSmsResult {
  delivered: boolean;
  provider: "africastalking" | "console";
  error?: string;
}

const PROVIDER_TIMEOUT_MS = 8_000;

/** Provider Africa's Talking — API HTTPS, aucun SDK requis. */
async function sendViaAfricasTalking(
  input: SendSmsInput
): Promise<SendSmsResult> {
  const apiKey = process.env.AFRICASTALKING_API_KEY;
  const username = process.env.AFRICASTALKING_USERNAME;

  if (!apiKey || !username) {
    return {
      delivered: false,
      provider: "africastalking",
      error: "AFRICASTALKING_API_KEY / AFRICASTALKING_USERNAME absents",
    };
  }

  // Sandbox et production ont des hôtes différents
  const isSandbox = username === "sandbox";
  const baseUrl = isSandbox
    ? "https://api.sandbox.africastalking.com"
    : "https://api.africastalking.com";

  const body = new URLSearchParams({
    username,
    to: input.to,
    message: input.message,
  });
  if (process.env.AFRICASTALKING_SENDER_ID) {
    body.set("from", process.env.AFRICASTALKING_SENDER_ID);
  }

  try {
    const res = await fetch(`${baseUrl}/version1/messaging`, {
      method: "POST",
      headers: {
        apiKey,
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
    });

    const text = await res.text().catch(() => "");
    if (!res.ok) {
      return {
        delivered: false,
        provider: "africastalking",
        error: `Africa's Talking ${res.status} : ${text.slice(0, 200)}`,
      };
    }

    // L'API renvoie 201 même avec des destinataires en échec :
    // vérifier le statut par destinataire quand c'est du JSON.
    try {
      const json = JSON.parse(text) as {
        SMSMessageData?: { Recipients?: { status: string }[] };
      };
      const recipients = json.SMSMessageData?.Recipients ?? [];
      if (recipients.length > 0 && recipients.every((r) => r.status !== "Success")) {
        return {
          delivered: false,
          provider: "africastalking",
          error: `Tous les destinataires en échec : ${text.slice(0, 200)}`,
        };
      }
    } catch {
      // réponse non-JSON → on fait confiance au statut HTTP
    }

    return { delivered: true, provider: "africastalking" };
  } catch (error) {
    return {
      delivered: false,
      provider: "africastalking",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Provider console — développement : logue, prétend livrer. */
async function sendViaConsole(input: SendSmsInput): Promise<SendSmsResult> {
  console.log(`[DEV] 📱 SMS → ${input.to} | ${input.message}`);
  return { delivered: true, provider: "console" };
}

/** Indique si l'envoi réel de SMS est configuré. */
export function isSmsConfigured(): boolean {
  return Boolean(
    process.env.AFRICASTALKING_API_KEY && process.env.AFRICASTALKING_USERNAME
  );
}

/**
 * Envoie un SMS transactionnel.
 * N'échoue JAMAIS en exception : le résultat est dans `delivered`.
 */
export async function sendSms(input: SendSmsInput): Promise<SendSmsResult> {
  const result = isSmsConfigured()
    ? await sendViaAfricasTalking(input)
    : await sendViaConsole(input);

  if (!result.delivered) {
    console.error(`[sms] échec d'envoi à ${input.to} : ${result.error}`);
  }
  return result;
}

/** Gabarit du SMS OTP (160 caractères max idéalement). */
export function otpSmsTemplate(code: string): string {
  return `AfricaSkills : ton code de vérification est ${code}. Il expire dans 5 min. Ne le partage avec personne.`;
}
