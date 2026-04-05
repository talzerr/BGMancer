"use client";

import { useEffect, useState } from "react";

const DISMISSED_KEY = "bgm_login_prompt_dismissed";

/**
 * Tracks whether the guest login prompt has been dismissed.
 * Returns [isDismissed, dismiss] after hydration.
 */
export function useLoginPromptDismissed(): [isDismissed: boolean, dismiss: () => void] {
  const [dismissed, setDismissed] = useState(true); // default true to avoid flash

  // Read localStorage after mount to avoid hydration mismatch
  useEffect(() => {
    Promise.resolve().then(() => {
      setDismissed(!!localStorage.getItem(DISMISSED_KEY));
    });
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, "1");
    setDismissed(true);
  }

  return [dismissed, dismiss];
}
