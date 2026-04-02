import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { matchRoute } from "@/lib/route-matcher";
import { AuthLevel } from "@/lib/route-config";
import { hasCloudflareAccessToken } from "@/lib/services/cloudflare-access";
import { env } from "./lib/env";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method;

  const route = matchRoute(method, pathname);

  if (!route) {
    return new NextResponse(null, { status: 404 });
  }

  // Backstage: open in dev, requires Cloudflare Access in production.
  if (!env.isDev && route.auth === AuthLevel.Admin) {
    if (!hasCloudflareAccessToken(request)) {
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
