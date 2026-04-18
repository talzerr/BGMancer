import { env } from "@/lib/env";
import { createLogger } from "@/lib/logger";

const log = createLogger("turnstile");

interface VerifyResult {
  success: boolean;
  error?: string;
}

/**
 * Verify a Turnstile token against Cloudflare's siteverify API.
 * In dev mode, verification is skipped. In production without a secret, verification fails closed.
 */
export async function verifyTurnstileToken(
  token: string,
  remoteIp?: string,
): Promise<VerifyResult> {
  if (env.isDev) return { success: true };

  const secret = env.turnstileSecretKey;
  if (!secret) {
    log.error("TURNSTILE_SECRET_KEY not configured in production");
    return { success: false, error: "Verification unavailable. Please try again." };
  }

  if (!token) {
    return { success: false, error: "Bot verification required. Please try again." };
  }

  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret,
        response: token,
        ...(remoteIp ? { remoteip: remoteIp } : {}),
      }),
    });

    const data = (await res.json()) as { success: boolean; "error-codes"?: string[] };
    if (!data.success) {
      log.warn("verification failed", { errors: data["error-codes"] });
      return { success: false, error: "Bot verification failed. Please try again." };
    }

    return { success: true };
  } catch (err) {
    log.error("siteverify request failed", {}, err);
    return { success: false, error: "Verification unavailable. Please try again." };
  }
}
