"use client";

import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";

export const THEMES = [
  { id: "chrome", swatch: ["#0b0c0f", "#9aa5b2", "#f3f6f9"] },
  { id: "matrix", swatch: ["#030504", "#10b981", "#34d399"] },
  { id: "midnight", swatch: ["#06071a", "#818cf8", "#a5b4fc"] },
  { id: "sunset", swatch: ["#0e0606", "#fb923c", "#fdba74"] },
  { id: "ocean", swatch: ["#02090f", "#22d3ee", "#67e8f9"] },
  { id: "daylight", swatch: ["#eef3f1", "#047857", "#ffffff"] },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

const THEME_KEY = "office.theme";

/** Runs before React hydrates so the saved theme and language apply without a flash. */
export const PREPAINT_SCRIPT = `try{var d=document.documentElement,t=localStorage.getItem("${THEME_KEY}");if(t)d.dataset.theme=t;var l=localStorage.getItem("office.lang");if(l)d.lang=l;d.dataset.motion=localStorage.getItem("office.motion")||"full";}catch(e){}`;

type Ctx = { theme: ThemeId; setTheme: (t: ThemeId) => void };
const ThemeContext = createContext<Ctx>({ theme: "chrome", setTheme: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>("chrome");

  useEffect(() => {
    const current = document.documentElement.dataset.theme as ThemeId | undefined;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (current && THEMES.some((t) => t.id === current)) setThemeState(current);
  }, []);

  const setTheme = useCallback((next: ThemeId) => {
    const root = document.documentElement;
    // cross-fade colours briefly, then drop the transition so normal interactions stay snappy
    root.classList.add("theme-switching");
    root.dataset.theme = next;
    window.setTimeout(() => root.classList.remove("theme-switching"), 450);
    setThemeState(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // storage unavailable
    }
  }, []);

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
