/**
 * Cloudflare Access helpers.
 *
 * In production, backstage routes require a valid CF_Authorization cookie
 * set by Cloudflare Access after identity verification.
 *
 * **Security contract:** this check does NOT verify the JWT signature. It only
 * validates structure and expiry. The signature is verified by Cloudflare Access
 * at the edge *before* the request reaches the Worker.
 *
 * **Deploy-time dependency:** this is load-bearing only when CF Access covers
 * every path that resolves to an `AuthLevel.Admin` route. If the Worker can be
 * reached bypassing CF Access (e.g. via the `*.workers.dev` default URL or a
 * misconfigured route), attackers can forge a structurally valid JWT with a
 * future `exp` and pass the check. When deploying:
 *   1. Disable `workers.dev` on this Worker (`workers_dev: false` in wrangler).
 *   2. Confirm the CF Access Application covers `/backstage/*` AND
 *      `/api/backstage/*` on the production hostname.
 *   3. If either of the above cannot be guaranteed, swap this function for a
 *      proper JWKS-backed signature check against `/cdn-cgi/access/certs`.
 */

const CF_AUTH_COOKIE = "CF_Authorization";

function decodeBase64Url(input: string): string {
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  return atob(padded);
}

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
    const payload = JSON.parse(decodeBase64Url(parts[1]));
    if (typeof payload.exp !== "number") return false;
    return payload.exp > Date.now() / 1000;
  } catch {
    return false;
  }
}
