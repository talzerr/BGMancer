/**
 * Cloudflare Access helpers.
 *
 * In production, backstage routes require a valid CF_Authorization cookie
 * set by Cloudflare Access after identity verification.
 */

import { env } from "@/lib/env";

const CF_AUTH_COOKIE = "CF_Authorization";

/** Returns true if the request has been authenticated by Cloudflare Access. */
export function hasCloudflareAccessToken(request: Request): boolean {
  const cookie = request.headers.get("cookie") ?? "";
  // Split on `;` and match exact cookie name to avoid substring false positives
  return cookie.split(";").some((c) => c.trim().startsWith(`${CF_AUTH_COOKIE}=`));
}

export class BackstageAuthError extends Error {
  constructor() {
    super("Backstage auth required");
    this.name = "BackstageAuthError";
  }
}

/** Defense-in-depth: rejects requests missing Cloudflare Access token in production. */
export function assertBackstageAuth(request: Request): void {
  if (env.isDev) return;
  if (!hasCloudflareAccessToken(request)) {
    throw new BackstageAuthError();
  }
}
