import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SignJWT, jwtVerify } from "jose";

const COOKIE_NAME = "bgmancer-uid";
const ALG = "HS256";

function getSecret(): Uint8Array {
  const s = process.env.NEXTAUTH_SECRET ?? "dev-fallback-secret-change-me";
  return new TextEncoder().encode(s);
}

export async function proxy(request: NextRequest) {
  const existing = request.cookies.get(COOKIE_NAME)?.value;

  if (existing) {
    try {
      await jwtVerify(existing, getSecret());
      return NextResponse.next();
    } catch {
      // invalid — fall through to issue a new cookie
    }
  }

  const uid = crypto.randomUUID();
  const token = await new SignJWT({ uid }).setProtectedHeader({ alg: ALG }).sign(getSecret());

  // Forward the new cookie on the request so route handlers see it immediately.
  const requestHeaders = new Headers(request.headers);
  const existing_cookie = request.headers.get("cookie");
  requestHeaders.set(
    "cookie",
    existing_cookie ? `${existing_cookie}; ${COOKIE_NAME}=${token}` : `${COOKIE_NAME}=${token}`,
  );

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  // Set on response so the browser persists it.
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // 1 year
  });

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
