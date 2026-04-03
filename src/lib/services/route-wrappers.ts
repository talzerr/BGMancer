import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/services/auth-helpers";
import { createLogger } from "@/lib/logger";

type RouteArgs = [Request, ...unknown[]];

/**
 * Wraps a route handler that requires authentication.
 * Resolves userId before calling the handler. Returns 401 for guests, 500 for unexpected errors.
 */
export function withRequiredAuth<A extends RouteArgs>(
  handler: (userId: string, ...args: A) => Promise<Response>,
  errorLabel: string,
): (...args: A) => Promise<Response> {
  return async (...args: A) => {
    try {
      const userId = await getAuthUserId();
      if (!userId) {
        return NextResponse.json({ error: "Authentication required" }, { status: 401 });
      }
      return await handler(userId, ...args);
    } catch (err) {
      createLogger(errorLabel).error("handler failed", {}, err);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  };
}

/**
 * Wraps a route handler where auth is optional.
 * Passes userId (string | null) to the handler. Returns 500 for unexpected errors.
 */
export function withOptionalAuth<A extends RouteArgs>(
  handler: (userId: string | null, ...args: A) => Promise<Response>,
  errorLabel: string,
): (...args: A) => Promise<Response> {
  return async (...args: A) => {
    try {
      const userId = await getAuthUserId();
      return await handler(userId, ...args);
    } catch (err) {
      createLogger(errorLabel).error("handler failed", {}, err);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  };
}
