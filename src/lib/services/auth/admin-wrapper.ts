import { NextResponse } from "next/server";
import { hasCloudflareAccessToken } from "./cloudflare-access";
import { env } from "@/lib/env";
import { createLogger } from "@/lib/logger";

type RouteArgs = [Request, ...unknown[]];

/**
 * Wraps a backstage / admin route handler. Defense-in-depth behind the
 * CF Access middleware check: every admin route also verifies at the handler
 * layer. In local dev, backstage is open (no CF Access cookie available).
 * Returns 404 when unauthorized to avoid leaking route existence.
 *
 * Lives in its own file to avoid pulling the NextAuth chain into backstage
 * route tests (route-wrappers.ts imports auth-helpers which imports next-auth).
 */
export function withAdminAuth<A extends RouteArgs>(
  handler: (...args: A) => Promise<Response>,
  errorLabel: string,
): (...args: A) => Promise<Response> {
  return async (...args: A) => {
    try {
      if (!env.isDev) {
        const req = args[0];
        if (!hasCloudflareAccessToken(req)) {
          return new Response(null, { status: 404 });
        }
      }
      return await handler(...args);
    } catch (err) {
      createLogger(errorLabel).error("handler failed", {}, err);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  };
}
