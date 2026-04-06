import { auth } from "./auth";

export type AuthResult = { authenticated: true; userId: string } | { authenticated: false };

/** Returns the authenticated user's session info, or { authenticated: false } for guests. */
export async function getAuthSession(): Promise<AuthResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { authenticated: false };
  }
  return { authenticated: true, userId: session.user.id };
}

/** Returns the authenticated userId or null. Convenience for routes that branch on auth. */
export async function getAuthUserId(): Promise<string | null> {
  const result = await getAuthSession();
  return result.authenticated ? result.userId : null;
}

/** Thrown when an unauthenticated user hits an auth-required route. */
export class AuthRequiredError extends Error {
  constructor() {
    super("Authentication required");
    this.name = "AuthRequiredError";
  }
}
