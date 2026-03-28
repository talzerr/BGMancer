import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: [
        "src/lib/services/youtube.ts",
        "src/lib/db/mappers.ts",
        "src/lib/pipeline/director.ts",
        "src/lib/pipeline/tagger.ts",
      ],
    },
  },
});
