// ============================================================
// TESTS — Messagerie transactionnelle (email + SMS)
// (src/lib/messaging/email.ts · src/lib/messaging/sms.ts)
// ============================================================

import {
  sendEmail,
  isEmailConfigured,
  otpEmailTemplate,
  resetPasswordEmailTemplate,
} from "@/lib/messaging/email";
import {
  sendSms,
  isSmsConfigured,
  otpSmsTemplate,
} from "@/lib/messaging/sms";

const ENV_KEYS = [
  "RESEND_API_KEY",
  "EMAIL_FROM",
  "AFRICASTALKING_API_KEY",
  "AFRICASTALKING_USERNAME",
] as const;

let savedEnv: Record<string, string | undefined>;
const originalFetch = globalThis.fetch;

beforeEach(() => {
  savedEnv = {};
  for (const k of ENV_KEYS) savedEnv[k] = process.env[k];
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
  globalThis.fetch = originalFetch;
  jest.restoreAllMocks();
});

const INPUT_EMAIL = {
  to: "awa@example.com",
  subject: "Ton code AfricaSkills",
  html: "<p>123456</p>",
};

describe("sendEmail — sélection du provider", () => {
  it("utilise le provider console sans RESEND_API_KEY (dev)", async () => {
    delete process.env.RESEND_API_KEY;
    expect(isEmailConfigured()).toBe(false);

    const fetchMock = jest.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    // Silence le log console attendu
    jest.spyOn(console, "log").mockImplementation(() => {});

    const result = await sendEmail(INPUT_EMAIL);
    expect(result.provider).toBe("console");
    expect(result.delivered).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("envoie via Resend quand la clé est configurée", async () => {
    process.env.RESEND_API_KEY = "re_test_123";
    process.env.EMAIL_FROM = "AfricaSkills <no-reply@africaskills.africa>";
    expect(isEmailConfigured()).toBe(true);

    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => "{}",
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await sendEmail(INPUT_EMAIL);
    expect(result).toEqual({ delivered: true, provider: "resend" });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer re_test_123"
    );
    const body = JSON.parse(init.body as string);
    expect(body.to).toEqual(["awa@example.com"]);
    expect(body.subject).toBe(INPUT_EMAIL.subject);
    expect(body.from).toContain("africaskills.africa");
  });

  it("ne lève JAMAIS d'exception : erreur Resend → delivered:false", async () => {
    process.env.RESEND_API_KEY = "re_test_123";
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 422,
      text: async () => '{"message":"invalid to"}',
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    jest.spyOn(console, "error").mockImplementation(() => {});

    const result = await sendEmail(INPUT_EMAIL);
    expect(result.delivered).toBe(false);
    expect(result.provider).toBe("resend");
    expect(result.error).toContain("Resend 422");
  });

  it("ne lève JAMAIS d'exception : panne réseau → delivered:false", async () => {
    process.env.RESEND_API_KEY = "re_test_123";
    globalThis.fetch = jest.fn().mockRejectedValue(new Error("ECONNREFUSED")) as unknown as typeof fetch;
    jest.spyOn(console, "error").mockImplementation(() => {});

    const result = await sendEmail(INPUT_EMAIL);
    expect(result.delivered).toBe(false);
    expect(result.error).toContain("ECONNREFUSED");
  });
});

describe("sendSms — sélection du provider", () => {
  const INPUT_SMS = { to: "+22901000000", message: "Ton code : 123456" };

  it("utilise le provider console sans clés Africa's Talking (dev)", async () => {
    delete process.env.AFRICASTALKING_API_KEY;
    delete process.env.AFRICASTALKING_USERNAME;
    expect(isSmsConfigured()).toBe(false);

    const fetchMock = jest.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    jest.spyOn(console, "log").mockImplementation(() => {});

    const result = await sendSms(INPUT_SMS);
    expect(result.provider).toBe("console");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("envoie via Africa's Talking (compte live) quand configuré", async () => {
    process.env.AFRICASTALKING_API_KEY = "atsk_123";
    process.env.AFRICASTALKING_USERNAME = "africaskills"; // ≠ sandbox → hôte live
    expect(isSmsConfigured()).toBe(true);

    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 201,
      text: async () =>
        JSON.stringify({
          SMSMessageData: { Recipients: [{ status: "Success" }] },
        }),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await sendSms(INPUT_SMS);
    expect(result).toEqual({ delivered: true, provider: "africastalking" });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.africastalking.com/version1/messaging");
    expect((init.headers as Record<string, string>).apiKey).toBe("atsk_123");
    expect(init.body as string).toContain("to=%2B22901000000");
    expect(init.body as string).toContain("username=africaskills");
  });

  it("utilise l'hôte sandbox quand username=sandbox", async () => {
    process.env.AFRICASTALKING_API_KEY = "atsk_sandbox";
    process.env.AFRICASTALKING_USERNAME = "sandbox";

    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 201,
      text: async () => JSON.stringify({ SMSMessageData: { Recipients: [] } }),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await sendSms(INPUT_SMS);
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe("https://api.sandbox.africastalking.com/version1/messaging");
  });

  it("détecte un échec par destinataire (HTTP 201 mais statut ≠ Success)", async () => {
    process.env.AFRICASTALKING_API_KEY = "atsk_123";
    process.env.AFRICASTALKING_USERNAME = "africaskills";

    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 201,
      text: async () =>
        JSON.stringify({
          SMSMessageData: { Recipients: [{ status: "InvalidPhoneNumber" }] },
        }),
    }) as unknown as typeof fetch;
    jest.spyOn(console, "error").mockImplementation(() => {});

    const result = await sendSms(INPUT_SMS);
    expect(result.delivered).toBe(false);
  });
});

describe("gabarits transactionnels", () => {
  it("OTP email : contient le code et la durée d'expiration", () => {
    const tpl = otpEmailTemplate("482913", "Confirme ton email");
    expect(tpl.subject).toContain("482913");
    expect(tpl.html).toContain("482913");
    expect(tpl.html).toContain("5 minutes");
    expect(tpl.html).toContain("Confirme ton email");
  });

  it("Reset password email : contient le lien et un bouton", () => {
    const tpl = resetPasswordEmailTemplate("https://app.africaskills.africa/reset?token=abc");
    expect(tpl.html).toContain("https://app.africaskills.africa/reset?token=abc");
    expect(tpl.html).toContain("Réinitialiser");
  });

  it("OTP SMS : contient le code, tient dans un SMS simple", () => {
    const msg = otpSmsTemplate("482913");
    expect(msg).toContain("482913");
    expect(msg.length).toBeLessThanOrEqual(160);
  });
});
