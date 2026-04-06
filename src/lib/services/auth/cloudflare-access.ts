/**
 * Cloudflare Access helpers.
 *
 * In production, backstage routes require a valid CF_Authorization cookie
 * set by Cloudflare Access after identity verification.
 */

const CF_AUTH_COOKIE = "CF_Authorization";

/** Returns true if the request has been authenticated by Cloudflare Access. */
export function hasCloudflareAccessToken(request: Request): boolean {
  const cookie = request.headers.get("cookie") ?? "";
  // Split on `;` and match exact cookie name to avoid substring false positives
  return cookie.split(";").some((c) => c.trim().startsWith(`${CF_AUTH_COOKIE}=`));
}
