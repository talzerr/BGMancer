import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { matchRoute } from "@/lib/route-matcher";
import { AuthLevel } from "@/lib/route-config";
import { env } from "./lib/env";

const ADMIN_COOKIE = "bgmancer-admin";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method;

  const route = matchRoute(method, pathname);

  // Unregistered route → 404
  if (!route) {
    return new NextResponse(null, { status: 404 });
  }

  // Admin routes: ADMIN_SECRET must be configured and cookie must match.
  // Dev: skip admin auth so Backstage is accessible without ADMIN_SECRET locally.
  if (!env.isDev && route.auth === AuthLevel.Admin) {
    const adminToken = request.cookies.get(ADMIN_COOKIE)?.value;
    if (!env.adminSecret || adminToken !== env.adminSecret) {
      return new NextResponse(null, { status: 404 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Run on all routes except static assets and Next.js internals
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
