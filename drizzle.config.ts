import { defineConfig } from "drizzle-kit";

// drizzle-kit does not read .env.local on its own.
if (!process.env.DATABASE_URL) {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // .env.local is optional — CI and container runs supply DATABASE_URL directly.
  }
}

export default defineConfig({
  schema: "./src/lib/db/drizzle-schema.ts",
  out: "./drizzle/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
