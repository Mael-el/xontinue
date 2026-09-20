import type { Config } from "jest";
import nextJest from "next/jest.js";

// next/jest charge automatiquement les alias `@/*` du tsconfig
// et transforme TS/JSX via SWC (comme le build Next.js).
const createJestConfig = nextJest({ dir: "./" });

const config: Config = {
  coverageProvider: "v8",
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  testMatch: ["**/__tests__/**/*.test.[jt]s?(x)"],
};

export default createJestConfig(config);
