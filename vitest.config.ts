import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    environmentMatchGlobs: [["src/**/*.test.tsx", "jsdom"]],
    coverage: {
      provider: "v8",
      include: ["src/lib/**/*.ts"],
      exclude: [
        "src/lib/**/*.test.ts",
        "src/lib/db/test-helpers.ts",

        // Barrel re-exports, type-only files, and config objects — no testable logic
        "src/lib/db/repo.ts",
        "src/lib/db/index.ts",
        "src/lib/db/seed.ts",
        "src/lib/llm/provider.ts",
        "src/lib/pipeline/types.ts",
        "src/lib/services/auth.ts",

        // LLM SDK wrapper + factory — requires real API key to instantiate
        "src/lib/llm/anthropic.ts",
        "src/lib/llm/index.ts",

        // Heavy orchestrators chaining 3+ external services (LLM + YouTube + DB).
        // Appropriate for E2E tests, not unit/integration tests.
        "src/lib/pipeline/index.ts",
        "src/lib/pipeline/onboarding.ts",
        "src/lib/pipeline/resolver.ts",
        "src/lib/pipeline/youtube-resolve.ts",
      ],
    },
  },
});
