import type { NextConfig } from "next";

// ============================================================
// CONFIGURATION NEXT.JS — production
// - output "standalone" : build auto-suffisant pour Docker
// - en-têtes de sécurité appliqués à toutes les réponses
// ============================================================

const securityHeaders = [
  // Interdit le sniffing de type MIME
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Protection clickjacking
  { key: "X-Frame-Options", value: "DENY" },
  // Fuite d'URL limitée
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // XSS filter des vieux navigateurs (inoffensif ailleurs)
  { key: "X-XSS-Protection", value: "1; mode=block" },
  // Surface d'attaque : pas de caméra/micro/géoloc pour l'app
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(self)",
  },
] as const;

const nextConfig: NextConfig = {
  output: "standalone",

  // Dev : autoriser l'aperçu hébergé (proxy sandbox *.e2b.app) à charger
  // les ressources HMR de Next.js. Aucun effet en production.
  allowedDevOrigins: ["*.e2b.app"],

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [...securityHeaders],
      },
      {
        // Certificats publics : autoriser l'intégration en iframe (LinkedIn…)
        source: "/certificates/:path*",
        headers: [{ key: "X-Frame-Options", value: "SAMEORIGIN" }],
      },
    ];
  },
};

export default nextConfig;
