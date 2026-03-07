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

          {/* Integration connect buttons — placeholders for future Steam & YouTube account linking */}
          <div className="hidden sm:flex items-center gap-2">
            <button
              disabled
              title="Coming soon — import your Steam library"
              className="flex items-center gap-1.5 rounded-full bg-zinc-900/80 border border-white/[0.06] px-3 py-1.5 text-xs font-medium text-zinc-500 cursor-not-allowed opacity-60 select-none"
            >
              {/* Steam logo mark */}
              <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.605 0 11.979 0zM7.54 18.21l-1.473-.61c.262.543.714.999 1.314 1.25 1.297.539 2.793-.076 3.332-1.375.263-.63.264-1.319.005-1.949s-.75-1.121-1.377-1.383c-.624-.26-1.29-.249-1.878-.03l1.523.63c.956.4 1.409 1.492 1.009 2.447-.397.957-1.494 1.411-2.455 1.02zm11.415-9.303c0-1.662-1.353-3.015-3.015-3.015-1.665 0-3.015 1.353-3.015 3.015 0 1.665 1.35 3.015 3.015 3.015 1.663 0 3.015-1.35 3.015-3.015zm-5.273-.005c0-1.252 1.013-2.266 2.265-2.266 1.249 0 2.266 1.014 2.266 2.266 0 1.251-1.017 2.265-2.266 2.265-1.252 0-2.265-1.014-2.265-2.265z"/>
              </svg>
              Connect Steam
            </button>

            <button
              disabled
              title="Coming soon — sync to your YouTube account"
              className="flex items-center gap-1.5 rounded-full bg-zinc-900/80 border border-white/[0.06] px-3 py-1.5 text-xs font-medium text-zinc-500 cursor-not-allowed opacity-60 select-none"
            >
              <svg className="w-3.5 h-3.5 shrink-0 text-[#FF0000]/60" fill="currentColor" viewBox="0 0 24 24">
                <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
              </svg>
              Connect YouTube
            </button>
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
            ) : (
              <span className="text-[11px] text-zinc-600 hidden sm:flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-600 inline-block" />
                Search-only mode
              </span>
            )}
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
