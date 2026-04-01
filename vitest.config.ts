import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          include: ["src/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        extends: true,
        test: {
          name: "jsdom",
          include: ["src/**/*.test.tsx"],
          environment: "jsdom",
        },
      },
    ],
    coverage: {
      provider: "v8",
      thresholds: {
        functions: 100,
        lines: 100,
      },
      include: ["src/lib/**/*.ts"],
      exclude: [
        "src/lib/**/*.test.ts",
        "src/lib/db/test-helpers.ts",

        // Barrel re-exports, type-only files, schema definitions, and config objects — no testable logic
        "src/lib/db/repo.ts",
        "src/lib/db/index.ts",
        "src/lib/db/seed.ts",
        "src/lib/db/drizzle-schema.ts",
        "src/lib/llm/provider.ts",
        "src/lib/pipeline/types.ts",
        "src/lib/services/auth.ts",

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
