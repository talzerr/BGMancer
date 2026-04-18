/**
 * Cloudflare Access helpers.
 *
 * In production, backstage routes require a valid CF_Authorization cookie
 * set by Cloudflare Access after identity verification.
 */

const CF_AUTH_COOKIE = "CF_Authorization";

/**
 * Returns true if the request carries a structurally valid, non-expired
 * CF Access JWT. This is defense-in-depth behind Cloudflare Access --
 * it verifies JWT structure and expiry but does not check the signature
 * (Cloudflare Access handles that at the edge).
 */
export function hasCloudflareAccessToken(request: Request): boolean {
  const cookie = request.headers.get("cookie") ?? "";
  const token = cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${CF_AUTH_COOKIE}=`))
    ?.slice(CF_AUTH_COOKIE.length + 1);

  if (!token) return false;

  const parts = token.split(".");
  if (parts.length !== 3) return false;

  try {
    const payload = JSON.parse(atob(parts[1]));
    if (typeof payload.exp !== "number") return false;
    return payload.exp > Date.now() / 1000;
  } catch {
    return false;
  }
}
