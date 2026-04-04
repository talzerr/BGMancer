import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  hasCloudflareAccessToken,
  assertBackstageAuth,
  BackstageAuthError,
} from "../cloudflare-access";
import { env } from "@/lib/env";

vi.mock("@/lib/env", () => ({ env: { isDev: false } }));

const mockEnv = env as { isDev: boolean };

function makeRequest(cookie?: string): Request {
  const headers: Record<string, string> = {};
  if (cookie) headers.cookie = cookie;
  return new Request("http://localhost/test", { headers });
}

describe("hasCloudflareAccessToken", () => {
  it("returns true when CF_Authorization cookie is present", () => {
    expect(hasCloudflareAccessToken(makeRequest("CF_Authorization=eyJhbGci..."))).toBe(true);
  });

  it("returns true when CF_Authorization is among multiple cookies", () => {
    expect(
      hasCloudflareAccessToken(makeRequest("other=1; CF_Authorization=eyJhbGci...; session=abc")),
    ).toBe(true);
  });

  it("returns false when cookie header is absent", () => {
    expect(hasCloudflareAccessToken(makeRequest())).toBe(false);
  });

  it("returns false when cookie header has no CF_Authorization", () => {
    expect(hasCloudflareAccessToken(makeRequest("session=abc; theme=dark"))).toBe(false);
  });

  it("returns false for substring matches like notCF_Authorization", () => {
    expect(hasCloudflareAccessToken(makeRequest("notCF_Authorization=fake"))).toBe(false);
  });
});

describe("assertBackstageAuth", () => {
  beforeEach(() => {
    mockEnv.isDev = false;
  });

  it("does not throw in dev mode", () => {
    mockEnv.isDev = true;
    expect(() => assertBackstageAuth(makeRequest())).not.toThrow();
  });

  it("does not throw when CF_Authorization cookie is present in prod", () => {
    expect(() => assertBackstageAuth(makeRequest("CF_Authorization=eyJhbGci..."))).not.toThrow();
  });

  it("throws BackstageAuthError when cookie is missing in prod", () => {
    expect(() => assertBackstageAuth(makeRequest())).toThrow(BackstageAuthError);
  });
});
