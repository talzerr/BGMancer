import { describe, it, expect, vi, beforeEach } from "vitest";

let mockIsDev = false;

vi.mock("@/lib/env", () => ({
  env: new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === "isDev") return mockIsDev;
        return undefined;
      },
    },
  ),
}));

const { withAdminAuth } = await import("../admin-wrapper");

beforeEach(() => {
  mockIsDev = false;
});

function validToken(): string {
  const b64 = (input: string) =>
    btoa(input).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  const header = b64(JSON.stringify({ alg: "RS256" }));
  const payload = b64(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }));
  return `${header}.${payload}.sig`;
}

function makeRequest(cookie?: string): Request {
  const headers: Record<string, string> = {};
  if (cookie) headers.cookie = cookie;
  return new Request("http://test/api/backstage/x", { headers });
}

describe("withAdminAuth", () => {
  describe("in production without a CF Access cookie", () => {
    it("returns 404 and does not call the handler", async () => {
      const handler = vi.fn().mockResolvedValue(new Response("ok"));
      const wrapped = withAdminAuth(handler, "test");
      const res = await wrapped(makeRequest());
      expect(res.status).toBe(404);
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe("in production with a valid CF Access cookie", () => {
    it("calls the handler and returns its response", async () => {
      const handler = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));
      const wrapped = withAdminAuth(handler, "test");
      const res = await wrapped(makeRequest(`CF_Authorization=${validToken()}`));
      expect(res.status).toBe(200);
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe("in dev", () => {
    it("bypasses the cookie check and calls the handler", async () => {
      mockIsDev = true;
      const handler = vi.fn().mockResolvedValue(new Response("ok"));
      const wrapped = withAdminAuth(handler, "test");
      const res = await wrapped(makeRequest());
      expect(res.status).toBe(200);
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe("when the handler throws", () => {
    it("returns 500 JSON and logs", async () => {
      mockIsDev = true;
      const handler = vi.fn().mockRejectedValue(new Error("boom"));
      const wrapped = withAdminAuth(handler, "test");
      const res = await wrapped(makeRequest());
      expect(res.status).toBe(500);
      const body = (await res.json()) as { error: string };
      expect(body.error).toBe("Internal server error");
    });
  });

  describe("passes through additional route args unchanged", () => {
    it("forwards {params} context to the handler", async () => {
      mockIsDev = true;
      const handler = vi.fn().mockResolvedValue(new Response("ok"));
      const wrapped = withAdminAuth(handler, "test");
      const ctx = { params: Promise.resolve({ id: "xyz" }) };
      await wrapped(makeRequest(), ctx);
      expect(handler).toHaveBeenCalledWith(expect.any(Request), ctx);
    });
  });
});
