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

        // Barrel re-exports, type-only files, schema definitions, bootstrap, and config objects — no testable logic
        "src/lib/env.ts",
        "src/lib/db/repo.ts",
        "src/lib/db/index.ts",
        "src/lib/db/drizzle-schema.ts",
        "src/lib/llm/provider.ts",
        "src/lib/pipeline/generation/types.ts",
        "src/lib/services/auth.ts",

        // KV production paths require Cloudflare Workers runtime
        "src/lib/services/kv.ts",

        // Heavy orchestrators chaining 3+ external services (LLM + YouTube + DB).
        // Appropriate for E2E tests, not unit/integration tests.
        "src/lib/pipeline/generation/index.ts",
        "src/lib/pipeline/onboarding/index.ts",
        "src/lib/pipeline/onboarding/resolver.ts",
        "src/lib/pipeline/onboarding/youtube-resolve.ts",
      ],
    },
  },
});
