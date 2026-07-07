import { defineConfig } from "vitest/config";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const frontendRoot = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: frontendRoot,
  esbuild: {
    jsx: "automatic",
  },
  test: {
    environment: "jsdom",
    setupFiles: [resolve(frontendRoot, "tests/setup.ts")],
    include: ["tests/**/*.test.tsx"],
  },
});
