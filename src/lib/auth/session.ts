// ============================================================
// SESSION — Helpers pour détecter device / IP / navigateur
// ============================================================

/**
 * Extrait l'IP du client depuis les headers Next.js.
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return req.headers.get("x-real-ip") ?? "unknown";
}

/**
 * Parse le User-Agent pour en extraire device, OS, navigateur.
 */
export function parseUserAgent(ua: string | null): {
  device: string;
  os: string;
  browser: string;
} {
  if (!ua) {
    return { device: "Unknown", os: "Unknown", browser: "Unknown" };
  }

  // Device
  let device = "Desktop";
  if (/Mobile|Android|iPhone|iPod/i.test(ua)) device = "Mobile";
  else if (/iPad|Tablet/i.test(ua)) device = "Tablet";

  // OS
  let os = "Unknown";
  if (/Windows/i.test(ua)) os = "Windows";
  else if (/Macintosh|Mac OS/i.test(ua)) os = "macOS";
  else if (/Linux/i.test(ua)) os = "Linux";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/iPhone|iPad|iPod/i.test(ua)) os = "iOS";

  // Browser
  let browser = "Unknown";
  if (/Edg\//i.test(ua)) browser = "Edge";
  else if (/Chrome\//i.test(ua)) browser = "Chrome";
  else if (/Firefox\//i.test(ua)) browser = "Firefox";
  else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) browser = "Safari";
  else if (/OPR\//i.test(ua)) browser = "Opera";

  return { device, os, browser };
}

/**
 * Détecte une connexion suspecte : changement d'IP ou de pays.
 */
export function isSuspiciousLogin(params: {
  previousIp: string | null;
  currentIp: string;
  previousCountry: string | null;
  currentCountry: string | null;
}): boolean {
  if (!params.previousIp) return false;
  // Si l'IP change radicalement ET que le pays change aussi
  if (
    params.previousCountry &&
    params.currentCountry &&
    params.previousCountry !== params.currentCountry &&
    params.previousIp !== params.currentIp
  ) {
    return true;
  }
  return false;
}
