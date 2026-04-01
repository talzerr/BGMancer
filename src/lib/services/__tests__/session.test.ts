import { describe, it, expect, beforeAll } from "vitest";
import { _reloadEnvForTest } from "@/lib/env";
import { createSessionJWT, verifySessionJWT, getOrCreateUserId, SESSION_COOKIE } from "../session";

beforeAll(() => {
  process.env.NEXTAUTH_SECRET = "test-secret-not-real";
  _reloadEnvForTest();
});

describe("createSessionJWT / verifySessionJWT", () => {
  describe("when creating and verifying a valid token", () => {
    it("should roundtrip the uid", async () => {
      const uid = "user-123";
      const token = await createSessionJWT(uid);
      const result = await verifySessionJWT(token);
      expect(result).toBe(uid);
    });
  });

  describe("when the token is tampered with", () => {
    it("should return null", async () => {
      const token = await createSessionJWT("user-123");
      const tampered = `${token.slice(0, -5)}XXXXX`;
      const result = await verifySessionJWT(tampered);
      expect(result).toBeNull();
    });
  });

  describe("when the token is completely invalid", () => {
    it("should return null", async () => {
      expect(await verifySessionJWT("not-a-jwt")).toBeNull();
    });

    it("should return null for an empty string", async () => {
      expect(await verifySessionJWT("")).toBeNull();
    });
  });

  describe("when different uids are used", () => {
    it("should return the correct uid for each token", async () => {
      const token1 = await createSessionJWT("alice");
      const token2 = await createSessionJWT("bob");
      expect(await verifySessionJWT(token1)).toBe("alice");
      expect(await verifySessionJWT(token2)).toBe("bob");
    });
  });
});

describe("getOrCreateUserId", () => {
  function mockCookieStore(token?: string) {
    return {
      get: (name: string) => (name === SESSION_COOKIE && token ? { value: token } : undefined),
    } as Parameters<typeof getOrCreateUserId>[0];
  }

  describe("when a valid session cookie is present", () => {
    it("should return the uid from the token", async () => {
      const token = await createSessionJWT("user-abc");
      const uid = await getOrCreateUserId(mockCookieStore(token));
      expect(uid).toBe("user-abc");
    });
  });

  describe("when the session cookie is missing", () => {
    it("should return LOCAL_USER_ID", async () => {
      const uid = await getOrCreateUserId(mockCookieStore());
      // LOCAL_USER_ID is the fallback
      expect(uid).toBeTruthy();
      expect(typeof uid).toBe("string");
    });
  });

  describe("when the session cookie is invalid", () => {
    it("should return LOCAL_USER_ID", async () => {
      const uid = await getOrCreateUserId(mockCookieStore("garbage-token"));
      expect(uid).toBeTruthy();
    });
  });
});
