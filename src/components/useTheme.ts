"use client";

import { useEffect, useState } from "react";

const KEY = "skill-atlas-theme";

/** Light/dark toggle. First visit follows the system preference (applied by the
 *  pre-paint script in layout.tsx); the user's explicit choice persists. */
export function useTheme() {
  const [dark, setDark] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
    setReady(true);
  }, []);

  function toggle() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem(KEY, next ? "dark" : "light");
    } catch {
      /* private mode — the toggle still works for this visit */
    }
    setDark(next);
  }

  return { dark, toggle, ready };
}
