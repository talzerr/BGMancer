/**
 * Centralized, typed environment configuration.
 *
 * Every server-side env var access goes through this module.
 * Validates required vars at startup and exports a typed `env` object.
 *
 * Usage:
 *   import { env } from "@/lib/env";
 *   env.youtubeApiKey   // string (validated present)
 *   env.discogsToken    // string | undefined (optional)
 */

import path from "path";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

interface Env {
  /** NextAuth session signing key (required). */
  nextAuthSecret: string;
  /** NextAuth callback URL. */
  nextAuthUrl: string | undefined;

  /** Google OAuth — enables "Sign in with Google". */
  googleClientId: string | undefined;
  googleClientSecret: string | undefined;

  /** YouTube Data API v3 key (required for playlist generation). */
  youtubeApiKey: string | undefined;
  /** Steam Web API key (required for Steam import). */
  steamApiKey: string | undefined;
  /** Discogs personal access token (optional — higher rate limit). */
  discogsToken: string | undefined;

  /** Anthropic API key (required for LLM calls). */
  anthropicApiKey: string | undefined;
  /** Override model for the tagging LLM. Falls back to anthropicModel. */
  anthropicTaggingModel: string | undefined;
  /** Override model for the Vibe Profiler LLM. Falls back to anthropicModel. */
  anthropicVibeModel: string | undefined;
  /** Default Anthropic model (fallback for tagging + vibe). */
  anthropicModel: string | undefined;

  /** SQLite database path. */
  sqlitePath: string;

  /** Backstage admin secret (protects /backstage in local dev). */
  adminSecret: string | undefined;

  /** True when Google OAuth credentials are fully configured. */
  authConfigured: boolean;

  /** Current NODE_ENV. */
  nodeEnv: string;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const KNOWN_INSECURE_SECRETS = new Set([
  "dev-fallback-secret-change-me",
  "your-secret-here-run-openssl-rand-base64-32",
]);

function loadEnv(): Env {
  const nodeEnv = process.env.NODE_ENV ?? "development";
  const nextAuthSecret = process.env.NEXTAUTH_SECRET ?? "";

  // Validate NEXTAUTH_SECRET (skip in test — tests use placeholder values)
  if (nodeEnv !== "test") {
    if (!nextAuthSecret) {
      throw new Error("NEXTAUTH_SECRET is not set. Generate one with: openssl rand -base64 32");
    }
    if (KNOWN_INSECURE_SECRETS.has(nextAuthSecret)) {
      throw new Error(
        `NEXTAUTH_SECRET is set to a known insecure value ("${nextAuthSecret}"). ` +
          "Generate a real secret with: openssl rand -base64 32",
      );
    }
  }

  const googleClientId = process.env.GOOGLE_CLIENT_ID || undefined;
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET || undefined;

  return {
    nextAuthSecret,
    nextAuthUrl: process.env.NEXTAUTH_URL || undefined,

    googleClientId,
    googleClientSecret,

    youtubeApiKey: process.env.YOUTUBE_API_KEY || undefined,
    steamApiKey: process.env.STEAM_API_KEY || undefined,
    discogsToken: process.env.DISCOGS_TOKEN || undefined,

    anthropicApiKey: process.env.ANTHROPIC_API_KEY || undefined,
    anthropicTaggingModel: process.env.ANTHROPIC_TAGGING_MODEL || undefined,
    anthropicVibeModel: process.env.ANTHROPIC_VIBE_MODEL || undefined,
    anthropicModel: process.env.ANTHROPIC_MODEL || undefined,

    sqlitePath: process.env.SQLITE_PATH ?? path.join(process.cwd(), "bgmancer.db"),

    adminSecret: process.env.ADMIN_SECRET || undefined,

    authConfigured: !!(googleClientId && googleClientSecret),

    nodeEnv,
  };
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

export let env: Env = loadEnv();

/** Re-read process.env and rebuild the env object. Test-only. */
export function _reloadEnvForTest(): void {
  env = loadEnv();
}
