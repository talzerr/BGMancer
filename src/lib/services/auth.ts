import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { env } from "@/lib/env";
import { Users } from "@/lib/db/repos/users";

// Google OAuth is optional — if creds aren't set, a dev-only Credentials provider is used instead.
export const AUTH_CONFIGURED = env.authConfigured;

const googleProvider = Google({
  clientId: env.googleClientId ?? "",
  clientSecret: env.googleClientSecret ?? "",
  authorization: {
    params: {
      scope: ["openid", "email", "profile", "https://www.googleapis.com/auth/youtube"].join(" "),
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
        // First sign-in: create or fetch the DB user.
        // Google OAuth provides profile.email; Credentials provides user.email.
        const email = profile?.email ?? user?.email;
        const name = profile?.name ?? user?.name;
        if (email) {
          const dbUser = await Users.createFromOAuth(email, name);
          token.userId = dbUser.id;
        }
        token.access_token = account.access_token;
        token.refresh_token = account.refresh_token;
        token.expires_at = account.expires_at;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.userId) {
        session.user.id = token.userId as string;
      }
      session.access_token = token.access_token as string | undefined;
      return session;
    },
  },
});

// ─── Type augmentation ──────────────────────────────────────────────────────

declare module "next-auth" {
  interface Session {
    access_token?: string;
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
  }
}
