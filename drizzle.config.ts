import { defineConfig } from "drizzle-kit";

// La config lit DATABASE_URL depuis l'environnement (ou .env).
// Aucun identifiant n'est codé en dur ici.
if (!process.env.DATABASE_URL) {
  // Charge .env si présent (drizzle-kit ne le fait pas toujours)
  try {
    process.loadEnvFile?.(".env");
  } catch {
    // pas de fichier .env — tant pis
  }
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      "postgresql://postgres:postgres@127.0.0.1:5432/postgres",
  },
});
