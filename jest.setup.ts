import "@testing-library/jest-dom";
import { TextEncoder, TextDecoder } from "node:util";
import { webcrypto } from "node:crypto";

// jsdom ne fournit pas TextEncoder / crypto.subtle : on branche
// les implémentations de Node pour tester le code crypto.
Object.assign(globalThis, { TextEncoder, TextDecoder });
if (typeof globalThis.crypto?.subtle === "undefined") {
  Object.defineProperty(globalThis, "crypto", { value: webcrypto });
}
