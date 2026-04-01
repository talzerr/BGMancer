import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { env } from "@/lib/env";

// OAuth is optional — only needed for the "Sync to YouTube" feature.
// The curator (search + AI) works with just YOUTUBE_API_KEY + GOOGLE_AI_API_KEY.
export const AUTH_CONFIGURED = env.authConfigured;

const providers = AUTH_CONFIGURED
  ? [
      Google({
        clientId: env.googleClientId ?? "",
        clientSecret: env.googleClientSecret ?? "",
        authorization: {
          params: {
            scope: ["openid", "email", "profile", "https://www.googleapis.com/auth/youtube"].join(
              " ",
            ),
            access_type: "offline",
            prompt: "consent",
          },
        },
      }),
    ]
  : [];

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        token.access_token = account.access_token;
        token.refresh_token = account.refresh_token;
        token.expires_at = account.expires_at;
      }
      return token;
    },
    async session({ session, token }) {
      session.access_token = token.access_token as string | undefined;
      return session;
    },
  },
});

declare module "next-auth" {
  interface Session {
    access_token?: string;
  }
}
