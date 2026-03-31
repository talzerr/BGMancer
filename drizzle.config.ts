import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/lib/db/drizzle-schema.ts",
  out: "./drizzle/migrations",
  dialect: "sqlite",
});
