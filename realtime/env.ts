// ============================================================
// ENVOI D'ENV — charge .env AVANT tout autre module serveur.
// Ce fichier n'exporte rien : il ne fait que peupler
// process.env (le serveur temps réel tourne hors Next.js,
// il faut donc charger .env manuellement).
// ⚠️ Importer EN PREMIER dans realtime/server.ts.
// ============================================================

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const candidates = [
  path.resolve(process.cwd(), ".env"),
  path.resolve(process.cwd(), ".env.local"),
];

for (const file of candidates) {
  if (!existsSync(file)) continue;
  const content = readFileSync(file, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    // Retire les guillemets simples/doubles éventuels
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    // Ne jamais écraser une variable déjà définie par le shell
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

export {};
