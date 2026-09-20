// ============================================================
// BASE DE DONNÉES EMBARQUÉE (développement local sans PostgreSQL)
//
// Lance le serveur PGlite officiel (pglite-server) : PostgreSQL
// compilé en WebAssembly, exposé via le protocole wire sur
// 127.0.0.1:5432. L'application (driver `pg` / Drizzle) fonctionne
// sans aucune modification.
//
// Le multiplexeur (-m) autorise plusieurs connexions concurrentes
// (les requêtes parallèles des pages Next.js, plusieurs process…).
//
// Usage :
//   npm run db:embedded
//
// Variables d'environnement :
//   EMBEDDED_DB_DIR  (défaut: .pglite)  — répertoire de persistance
//   EMBEDDED_DB_PORT (défaut: 5432)
//   EMBEDDED_DB_HOST (défaut: 127.0.0.1)
//   EMBEDDED_DB_MAX_CONNECTIONS (défaut: 10)
//
// En production, utiliser un vrai PostgreSQL 16 via DATABASE_URL.
// ============================================================

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CLI = join(
  ROOT,
  "node_modules",
  "@electric-sql",
  "pglite-socket",
  "dist",
  "scripts",
  "server.js"
);

const HOST = process.env.EMBEDDED_DB_HOST ?? "127.0.0.1";
const PORT = process.env.EMBEDDED_DB_PORT ?? "5432";
const DATA_DIR = process.env.EMBEDDED_DB_DIR ?? ".pglite";
const MAX_CONN = process.env.EMBEDDED_DB_MAX_CONNECTIONS ?? "10";

console.log(`🐘 PGlite — ${DATA_DIR} (max ${MAX_CONN} connexions simultanées)`);

const child = spawn(
  process.execPath,
  [CLI, "-d", DATA_DIR, "-p", PORT, "-h", HOST, "-m", MAX_CONN],
  { stdio: "inherit", cwd: ROOT }
);

child.on("error", (err) => {
  console.error("❌ Échec du démarrage de PGlite :", err.message);
  process.exit(1);
});

// Relayer l'arrêt propre au processus enfant
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    child.kill(signal);
  });
}

child.on("exit", (code) => process.exit(code ?? 0));
