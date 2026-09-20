// ============================================================
// BASE DE DONNÉES EMBARQUÉE (développement local sans PostgreSQL)
// Démarre PGlite (PostgreSQL compilé en WebAssembly) et l'expose
// via le protocole wire PostgreSQL sur 127.0.0.1:5432, pour que
// l'application (driver `pg` / Drizzle) fonctionne sans rien changer.
//
// Usage :
//   node scripts/embedded-db.mjs
//
// Les données sont persistées dans ./.pglite (ignoré par git).
// En production, utiliser un vrai PostgreSQL 16 via DATABASE_URL.
// ============================================================

import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";

const HOST = process.env.EMBEDDED_DB_HOST ?? "127.0.0.1";
const PORT = Number(process.env.EMBEDDED_DB_PORT ?? 5432);
const DATA_DIR = process.env.EMBEDDED_DB_DIR ?? ".pglite";

console.log(`🐘 PGlite — démarrage (données : ${DATA_DIR})…`);

const db = new PGlite(DATA_DIR);
await db.waitReady;

const server = new PGLiteSocketServer({
  db,
  host: HOST,
  port: PORT,
});

await server.start();
console.log(`✅ PostgreSQL (PGlite) à l'écoute sur ${HOST}:${PORT}`);
console.log(`   DATABASE_URL=postgresql://postgres:postgres@${HOST}:${PORT}/postgres`);

// Arrêt propre
let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  console.log("\n⏹  Arrêt de la base embarquée…");
  try {
    await server.stop();
    await db.close();
  } catch {
    // ignore
  }
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
