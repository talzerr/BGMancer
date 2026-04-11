import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { env } from "@/lib/env";
import { Users } from "@/lib/db/repos/users";
import { createLogger } from "@/lib/logger";

const log = createLogger("auth");

/** Refresh window — refresh the Google access token when it is within this
 *  many ms of expiry. 60 seconds leaves headroom for a subsequent YouTube API
 *  call without racing the expiry. */
const REFRESH_LEEWAY_MS = 60_000;

interface GoogleRefreshResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
}

/** Exchange a refresh token for a new access token. Throws on any non-OK
 *  response. The caller (JWT callback) maps failures to token.error. */
async function refreshGoogleAccessToken(refreshToken: string): Promise<GoogleRefreshResponse> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.googleClientId ?? "",
      client_secret: env.googleClientSecret ?? "",
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) {
    throw new Error(`google token refresh failed: ${res.status}`);
  }
  return (await res.json()) as GoogleRefreshResponse;
}

// Production uses Google OAuth; dev uses a Credentials provider for convenience.

const googleProvider = Google({
  clientId: env.googleClientId ?? "",
  clientSecret: env.googleClientSecret ?? "",
  authorization: {
    params: {
      scope: "openid email",
      access_type: "offline",
      prompt: "consent",
    },
  },
});

// Dev-only: sign in with any email, no real OAuth needed.
const devCredentialsProvider = Credentials({
  name: "Dev Login",
  credentials: {
    email: { label: "Email", type: "email", placeholder: "dev@bgmancer.app" },
    name: { label: "Name", type: "text", placeholder: "Dev User" },
  },
  async authorize(credentials) {
    const email = typeof credentials?.email === "string" ? credentials.email : "dev@bgmancer.app";
    const name = typeof credentials?.name === "string" ? credentials.name : "Dev User";
    return { id: email, email, name };
  },
});

const providers = env.isDev ? [devCredentialsProvider] : [googleProvider];

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, account, profile, user }) {
      if (account) {
        // First sign-in (or incremental scope grant): create or fetch the DB
        // user, persist the new token bundle, clear any prior refresh error.
        const email = profile?.email ?? user?.email;
        if (email) {
          const dbUser = await Users.createFromOAuth(email);
          token.userId = dbUser.id;
        }
        token.access_token = account.access_token;
        token.refresh_token = account.refresh_token;
        token.expires_at = account.expires_at;
        token.scope = account.scope;
        delete token.error;
        return token;
      }

      // Refresh flow: only attempt when we actually have a refresh token and
      // the access token is close to expiring. Google issues refresh tokens
      // on the first consent (access_type=offline + prompt=consent).
      const expiresAt = token.expires_at as number | undefined;
      const refreshToken = token.refresh_token as string | undefined;
      if (!expiresAt || !refreshToken) return token;
      if (Date.now() < expiresAt * 1000 - REFRESH_LEEWAY_MS) return token;

      try {
        const refreshed = await refreshGoogleAccessToken(refreshToken);
        token.access_token = refreshed.access_token;
        token.expires_at = Math.floor(Date.now() / 1000) + refreshed.expires_in;
        if (refreshed.refresh_token) token.refresh_token = refreshed.refresh_token;
        if (refreshed.scope) token.scope = refreshed.scope;
        delete token.error;
      } catch (err) {
        log.error("google token refresh failed", {}, err);
        delete token.access_token;
        token.error = "RefreshAccessTokenError";
      }
      return token;
    },
    async session({ session, token }) {
      if (token.userId) {
        session.user.id = token.userId as string;
      }
      session.access_token = token.access_token as string | undefined;
      session.scope = token.scope as string | undefined;
      session.error = token.error as string | undefined;
      return session;
    },
  },
});

// ─── Type augmentation ──────────────────────────────────────────────────────

declare module "next-auth" {
  interface Session {
    access_token?: string;
    scope?: string;
    /** Set to "RefreshAccessTokenError" when Google rejected a refresh. The
     *  route layer treats this the same as a missing access_token and returns
     *  401 so the client can trigger an incremental-auth re-consent. */
    error?: string;
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
    };
  }

  interface JWT {
    userId?: string;
    access_token?: string;
    refresh_token?: string;
    expires_at?: number;
    scope?: string;
    error?: string;
  }
}
