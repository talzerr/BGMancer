import { SignJWT, jwtVerify } from "jose";
import type { ReadonlyRequestCookies } from "next/dist/server/web/spec-extension/adapters/request-cookies";
import { env } from "@/lib/env";
import { LOCAL_USER_ID } from "@/lib/db";

export const SESSION_COOKIE = "bgmancer-uid";
const ALG = "HS256";

function getSecret(): Uint8Array {
  return new TextEncoder().encode(env.nextAuthSecret);
}

export async function createSessionJWT(uid: string): Promise<string> {
  return new SignJWT({ uid }).setProtectedHeader({ alg: ALG }).sign(getSecret());
}

export async function verifySessionJWT(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return typeof payload.uid === "string" ? payload.uid : null;
  } catch {
    return null;
  }
}

/**
 * Reads and verifies the bgmancer-uid cookie.
 * Returns LOCAL_USER_ID as fallback when cookie is absent or invalid
 * (e.g. on first request before the middleware-set cookie is echoed back).
 */
export async function getOrCreateUserId(cookieStore: ReadonlyRequestCookies): Promise<string> {
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    const uid = await verifySessionJWT(token);
    if (uid) return uid;
  }
  return LOCAL_USER_ID;
}
