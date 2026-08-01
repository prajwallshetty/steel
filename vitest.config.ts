import { defineConfig } from "vitest/config";

export default defineConfig({
  // Resolves the "@/*" alias straight from tsconfig.json.
  resolve: { tsconfigPaths: true },
  // tsconfig.json is owned by Next, which pins jsx to "preserve" for its own
  // transform. Tests import .tsx directly, so Oxc needs its own instruction.
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
