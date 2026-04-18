import { describe, it, expect } from "vitest";
import { hasCloudflareAccessToken } from "../cloudflare-access";

function makeRequest(cookie?: string): Request {
  const headers: Record<string, string> = {};
  if (cookie) headers.cookie = cookie;
  return new Request("http://localhost/test", { headers });
}

function makeValidToken(): string {
  const header = btoa(JSON.stringify({ alg: "RS256" }));
  const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }));
  return `${header}.${payload}.fakesig`;
}

describe("hasCloudflareAccessToken", () => {
  it("returns true when CF_Authorization cookie is present with valid JWT", () => {
    expect(hasCloudflareAccessToken(makeRequest(`CF_Authorization=${makeValidToken()}`))).toBe(
      true,
    );
  });

  it("returns true when CF_Authorization is among multiple cookies", () => {
    expect(
      hasCloudflareAccessToken(
        makeRequest(`other=1; CF_Authorization=${makeValidToken()}; session=abc`),
      ),
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

  it("returns false for non-JWT token value (no dots)", () => {
    expect(hasCloudflareAccessToken(makeRequest("CF_Authorization=not-a-jwt"))).toBe(false);
  });

  it("returns false for JWT with wrong segment count", () => {
    expect(hasCloudflareAccessToken(makeRequest("CF_Authorization=a.b"))).toBe(false);
  });

  it("returns false for expired JWT", () => {
    const header = btoa(JSON.stringify({ alg: "RS256" }));
    const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) - 3600 }));
    const token = `${header}.${payload}.fakesig`;
    expect(hasCloudflareAccessToken(makeRequest(`CF_Authorization=${token}`))).toBe(false);
  });

  it("returns false when payload is not valid JSON", () => {
    expect(
      hasCloudflareAccessToken(
        makeRequest("CF_Authorization=eyJhbGci.bm90LXZhbGlkLWpzb24.fakesig"),
      ),
    ).toBe(false);
  });

  it("returns false when payload has no exp field", () => {
    const header = btoa(JSON.stringify({ alg: "RS256" }));
    const payload = btoa(JSON.stringify({ sub: "test" }));
    const token = `${header}.${payload}.fakesig`;
    expect(hasCloudflareAccessToken(makeRequest(`CF_Authorization=${token}`))).toBe(false);
  });
});
