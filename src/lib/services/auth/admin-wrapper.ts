import { NextResponse } from "next/server";
import { hasCloudflareAccessToken } from "./cloudflare-access";
import { env } from "@/lib/env";
import { createLogger } from "@/lib/logger";

type RouteArgs = [Request, ...unknown[]];

/**
 * Wraps a backstage route with a CF Access check. Open in dev.
 *
 * The inner try/catch is a safety net only — individual handlers catch their
 * own errors and return typed 500s. This wrapper's catch handles anything the
 * handler forgets to catch (e.g. unhandled promise rejections, null-derefs).
 */
export function withAdminAuth<A extends RouteArgs>(
  handler: (...args: A) => Promise<Response>,
  errorLabel: string,
): (...args: A) => Promise<Response> {
  const log = createLogger(errorLabel);
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
      log.error("handler failed", {}, err);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  };
}
