"use client";

import { signIn, signOut } from "next-auth/react";
import { useLoginPromptDismissed } from "@/hooks/useLoginPromptDismissed";

interface AuthButtonsProps {
  user: { name?: string | null; email?: string | null; image?: string | null } | null;
  isDev: boolean;
}

function LoginPrompt({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="animate-in fade-in slide-in-from-top-2 absolute top-full right-0 z-50 mt-3 duration-300">
      {/* Arrow */}
      <div className="absolute -top-1.5 right-6 size-3 rotate-45 rounded-sm border-t border-l border-zinc-700 bg-zinc-800" />
      {/* Bubble */}
      <div className="relative w-56 rounded-xl border border-zinc-700 bg-zinc-800 p-3.5 shadow-xl shadow-black/40">
        <button
          onClick={onDismiss}
          className="absolute top-2 right-2 cursor-pointer rounded-full p-0.5 text-zinc-500 transition-colors hover:bg-zinc-700 hover:text-zinc-300"
          aria-label="Dismiss"
        >
          <svg
            className="h-3.5 w-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
        <p className="text-[13px] leading-snug font-medium text-zinc-100">Welcome to BGMancer!</p>
        <p className="mt-1 text-xs leading-relaxed text-zinc-400">
          Sign in to unlock the full experience.
        </p>
      </div>
    </div>
  );
}

export function AuthButtons({ user, isDev }: AuthButtonsProps) {
  const [isDismissed, dismissPrompt] = useLoginPromptDismissed();
  const showPrompt = !user && !isDismissed;

  function dismiss() {
    dismissPrompt();
  }

  function handleSignOut() {
    signOut({ callbackUrl: "/" }).then(() => window.location.reload());
  }

  function handleGoogleSignIn() {
    dismiss();
    signIn("google", { callbackUrl: "/" });
  }

  function handleDevSignIn(formData: FormData) {
    dismiss();
    const name = (formData.get("name") as string) || "Dev User";
    const email = `${name.toLowerCase().replace(/\s+/g, ".")}@bgmancer.app`;
    signIn("credentials", { email, name, callbackUrl: "/" }).then(() => window.location.reload());
  }

  if (user) {
    return (
      <div className="flex items-center gap-3">
        <svg
          className="h-5 w-5 text-zinc-500"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.5 20.118a7.5 7.5 0 0 1 15 0"
          />
        </svg>
        <span className="hidden text-sm text-zinc-400 sm:block">
          {user.email?.split("@")[0] ?? "User"}
        </span>
        <button
          onClick={handleSignOut}
          className="cursor-pointer text-xs text-zinc-500 hover:text-zinc-200"
        >
          Sign out
        </button>
      </div>
    );
  }

  if (!isDev) {
    return (
      <div className="relative">
        <button
          onClick={handleGoogleSignIn}
          className="flex cursor-pointer items-center gap-2 rounded-lg bg-white px-3.5 py-1.5 text-sm font-medium text-zinc-900 hover:bg-zinc-100"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          Sign in with Google
        </button>
        {showPrompt && <LoginPrompt onDismiss={dismiss} />}
      </div>
    );
  }

  return (
    <div className="relative">
      <form action={handleDevSignIn} className="flex items-center gap-2">
        <input
          name="name"
          type="text"
          placeholder="Dev User"
          className="w-28 rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-sm text-zinc-200 placeholder-zinc-500 focus:border-violet-500 focus:outline-none"
        />
        <button
          type="submit"
          className="flex cursor-pointer items-center gap-2 rounded-lg bg-violet-600 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-violet-500"
        >
          Dev Sign In
        </button>
      </form>
      {showPrompt && <LoginPrompt onDismiss={dismiss} />}
    </div>
  );
}
