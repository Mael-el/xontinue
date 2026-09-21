// ============================================================
// URL PUBLIQUE DU SERVEUR TEMPS RÉEL
// Déduite côté serveur (route /api/v1/realtime/token) pour que le
// navigateur du visiteur atteigne toujours le port 3001, quel que
// soit l'environnement :
// 1) Preview E2B : le Host « 3000-<id>.e2b.app » devient
//    « https://3001-<id>.e2b.app » — le navigateur n'est PAS dans
//    le sandbox, jamais de localhost face à lui (prioritaire même
//    si .env pointe sur localhost : .env sert alors au dev local)
// 2) NEXT_PUBLIC_REALTIME_URL — override explicite (prod dédiée)
// 3) http://localhost:3001    — développement local classique
// ============================================================

export function publicRealtimeUrl(req: Request): string {
  try {
    const host = req.headers.get("host") ?? new URL(req.url).host;
    const m = host.match(/^3000-([a-z0-9-]+)\.(.+)$/i);
    if (m) return `https://3001-${m[1]}.${m[2]}`;
  } catch {
    // host illisible → fallback env/local
  }

  const fromEnv = process.env.NEXT_PUBLIC_REALTIME_URL;
  if (fromEnv) return fromEnv.replace(/\/+$/, "");
  return "http://localhost:3001";
}
