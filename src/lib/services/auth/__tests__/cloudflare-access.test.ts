import { describe, it, expect } from "vitest";
import { hasCloudflareAccessToken } from "../cloudflare-access";

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
