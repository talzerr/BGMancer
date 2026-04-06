import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAuth = vi.fn();

vi.mock("@/lib/services/auth/auth", () => ({
  auth: () => mockAuth(),
}));

const { getAuthSession, getAuthUserId, AuthRequiredError } =
  await import("../../auth/auth-helpers");

beforeEach(() => {
  mockAuth.mockReset();
});

describe("getAuthSession", () => {
  describe("when user is authenticated", () => {
    it("should return authenticated with userId", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-123", email: "a@b.com" } });
      const result = await getAuthSession();
      expect(result).toEqual({ authenticated: true, userId: "user-123" });
    });
  });

  describe("when session is null", () => {
    it("should return unauthenticated", async () => {
      mockAuth.mockResolvedValue(null);
      expect(await getAuthSession()).toEqual({ authenticated: false });
    });
  });

  describe("when session has no user", () => {
    it("should return unauthenticated", async () => {
      mockAuth.mockResolvedValue({ user: null });
      expect(await getAuthSession()).toEqual({ authenticated: false });
    });
  });

  describe("when session user has no id", () => {
    it("should return unauthenticated", async () => {
      mockAuth.mockResolvedValue({ user: { email: "a@b.com" } });
      expect(await getAuthSession()).toEqual({ authenticated: false });
    });
  });
});

describe("getAuthUserId", () => {
  describe("when authenticated", () => {
    it("should return the userId", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-456" } });
      expect(await getAuthUserId()).toBe("user-456");
    });
  });

  describe("when unauthenticated", () => {
    it("should return null", async () => {
      mockAuth.mockResolvedValue(null);
      expect(await getAuthUserId()).toBeNull();
    });
  });
});

describe("AuthRequiredError", () => {
  it("should have correct name and message", () => {
    const err = new AuthRequiredError();
    expect(err.name).toBe("AuthRequiredError");
    expect(err.message).toBe("Authentication required");
    expect(err).toBeInstanceOf(Error);
  });
});
