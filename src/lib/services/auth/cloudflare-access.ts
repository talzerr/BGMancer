// Structure+expiry only — signature is verified by CF Access at the edge.
// Load-bearing only when CF Access covers every Admin path. If the Worker can
// be reached directly (e.g. workers.dev, misconfigured route), a forged JWT
// with a future exp passes. Deploy: disable workers.dev, confirm CF Access
// covers /backstage/* AND /api/backstage/*. If neither can be guaranteed,
// swap for a JWKS check against /cdn-cgi/access/certs.

const CF_AUTH_COOKIE = "CF_Authorization";

function decodeBase64Url(input: string): string {
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  return atob(padded);
}

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
