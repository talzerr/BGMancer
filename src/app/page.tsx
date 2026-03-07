import Image from "next/image";
import { auth, signIn, signOut, AUTH_CONFIGURED } from "@/lib/auth";
import { FeedClient } from "./feed-client";

export default async function HomePage() {
  const session = AUTH_CONFIGURED ? await auth() : null;

  return (
    <div className="relative min-h-screen bg-zinc-950">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-zinc-950/80 backdrop-blur-xl">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 h-14 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl overflow-hidden shrink-0 shadow-lg shadow-violet-900/50">
              <Image
                src="/icon-512.png"
                alt="BGMancer"
                width={32}
                height={32}
                className="w-full h-full object-cover"
                priority
              />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white leading-none tracking-tight">BGMancer</h1>
              <p className="text-[10px] text-zinc-500 leading-none mt-0.5 tracking-wide uppercase">AI OST Curator</p>
            </div>
          </div>

          {/* Auth — only shown when Google OAuth is configured */}
          <div className="flex items-center gap-3">
            {AUTH_CONFIGURED ? (
              session?.user ? (
                <>
                  {session.user.image && (
                    <img
                      src={session.user.image}
                      alt={session.user.name ?? "User"}
                      className="w-7 h-7 rounded-full ring-1 ring-white/10"
                    />
                  )}
                  <span className="hidden sm:block text-sm text-zinc-400">
                    {session.user.name}
                  </span>
                  <form
                    action={async () => {
                      "use server";
                      await signOut();
                    }}
                  >
                    <button
                      type="submit"
                      className="text-xs text-zinc-500 hover:text-zinc-200 cursor-pointer"
                    >
                      Sign out
                    </button>
                  </form>
                </>
              ) : (
                <form
                  action={async () => {
                    "use server";
                    await signIn("google");
                  }}
                >
                  <button
                    type="submit"
                    className="flex items-center gap-2 rounded-lg bg-white hover:bg-zinc-100 px-3.5 py-1.5 text-sm font-medium text-zinc-900 cursor-pointer"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                    Sign in with Google
                  </button>
                </form>
              )
            ) : null}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6 py-6">
        <FeedClient isSignedIn={!!session?.user} authConfigured={AUTH_CONFIGURED} />
      </main>
    </div>
  );
}
