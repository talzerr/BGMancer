"use client";

import { signIn, signOut } from "next-auth/react";
import { clearPlaybackState } from "@/hooks/player/playback-state";
import { clearGuestLibrary } from "@/lib/guest-library";
import { useLoginPromptDismissed } from "@/hooks/shared/useLoginPromptDismissed";
import { GoogleLogo } from "@/components/Icons";

export function performSignOut(callbackUrl = "/") {
  clearPlaybackState();
  clearGuestLibrary();
  signOut({ callbackUrl }).then(() => window.location.reload());
}

interface AuthButtonsProps {
  user: { name?: string | null; email?: string | null; image?: string | null } | null;
  isDev: boolean;
}

function LoginPrompt({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="animate-in fade-in slide-in-from-top-2 absolute top-full right-0 z-50 mt-3 duration-300">
      {/* Arrow */}
      <div className="border-border bg-secondary absolute -top-1.5 right-6 size-3 rotate-45 rounded-sm border-t border-l" />
      {/* Bubble */}
      <div className="border-border bg-secondary relative w-56 rounded-xl border p-3.5">
        <button
          onClick={onDismiss}
          className="hover:text-foreground absolute top-2 right-2 cursor-pointer rounded-full p-0.5 text-[var(--text-tertiary)] transition-colors hover:bg-[var(--surface-hover)]"
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
        <p className="text-foreground text-[13px] leading-snug font-medium">Welcome to BGMancer!</p>
        <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
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
    performSignOut();
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
      <div className="flex items-center gap-2">
        <span className="hidden text-[12px] text-[var(--text-tertiary)] sm:block">
          {user.email?.split("@")[0] ?? "User"}
        </span>
        <button
          onClick={handleSignOut}
          className="cursor-pointer text-[12px] text-[var(--text-disabled)] hover:text-[var(--text-tertiary)]"
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
          className="flex cursor-pointer items-center gap-2 rounded-lg border border-[rgba(255,255,255,0.08)] bg-white/[0.04] px-3.5 py-1.5 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-white/[0.08] hover:text-[var(--text-primary)]"
        >
          <GoogleLogo className="h-4 w-4" />
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
          className="border-border bg-secondary text-foreground focus:border-primary w-28 rounded-lg border px-2.5 py-1.5 text-sm placeholder-[var(--text-tertiary)] focus:outline-none"
        />
        <button
          type="submit"
          className="bg-primary text-primary-foreground flex cursor-pointer items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm font-medium hover:bg-[var(--primary-hover)]"
        >
          Dev Sign In
        </button>
      </form>
      {showPrompt && <LoginPrompt onDismiss={dismiss} />}
    </div>
  );
}
