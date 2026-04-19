import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { _reloadEnvForTest, getEnv } from "@/lib/env";

/**
 * Regression coverage for the NEXTAUTH_SECRET hardening added in commit 988dc9c:
 * rejects missing secret, known-insecure placeholder, and too-short values when
 * NODE_ENV is not "test".
 */
describe("loadEnv — NEXTAUTH_SECRET validation", () => {
  const original = { ...process.env };

  beforeEach(() => {
    process.env = { ...original };
  });

  afterEach(() => {
    process.env = { ...original };
    _reloadEnvForTest();
  });

  it("throws when NEXTAUTH_SECRET is missing outside test env", () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    delete (process.env as Record<string, string | undefined>).NEXTAUTH_SECRET;
    expect(() => _reloadEnvForTest()).toThrow(/NEXTAUTH_SECRET is not set/);
  });

  it("throws when NEXTAUTH_SECRET is a known insecure placeholder", () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    process.env.NEXTAUTH_SECRET = "dev-fallback-secret-change-me";
    expect(() => _reloadEnvForTest()).toThrow(/known insecure value/);
  });

  it("throws when NEXTAUTH_SECRET is shorter than 32 chars", () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    process.env.NEXTAUTH_SECRET = "short";
    expect(() => _reloadEnvForTest()).toThrow(/too short/);
  });

  it("accepts a valid 32-char secret", () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    process.env.NEXTAUTH_SECRET = "a".repeat(32);
    expect(() => _reloadEnvForTest()).not.toThrow();
    expect(getEnv().nextAuthSecret).toBe("a".repeat(32));
  });

  it("skips validation in the test env even with a short secret", () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "test";
    process.env.NEXTAUTH_SECRET = "x";
    expect(() => _reloadEnvForTest()).not.toThrow();
  });
});
