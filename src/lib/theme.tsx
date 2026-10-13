"use client";

import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { flushSync } from "react-dom";
import { motionOff } from "./motion";

export const THEMES = [
  { id: "chrome", swatch: ["#0b0c0f", "#8d98a6", "#f3f6f9"] },
  { id: "matrix", swatch: ["#030504", "#3f9f7c", "#dcfcec"] },
  { id: "midnight", swatch: ["#06071a", "#7d82da", "#eceaff"] },
  { id: "sunset", swatch: ["#0e0606", "#c47b4f", "#ffeadb"] },
  { id: "ocean", swatch: ["#02090f", "#3a9db2", "#e2f8fc"] },
  { id: "daylight", swatch: ["#eef3f1", "#a3b6ae", "#ffffff"] },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

const THEME_KEY = "office.theme";

/** Runs before React hydrates so the saved theme and language apply without a flash. */
export const PREPAINT_SCRIPT = `try{var d=document.documentElement,t=localStorage.getItem("${THEME_KEY}");if(t)d.dataset.theme=t;var l=localStorage.getItem("office.lang");if(l)d.lang=l;d.dataset.motion=localStorage.getItem("office.motion")||"full";}catch(e){}`;

/** Where a theme change starts from (the click), for the reveal. */
export type Origin = { x: number; y: number };
type Ctx = { theme: ThemeId; setTheme: (t: ThemeId, from?: Origin) => void };
const ThemeContext = createContext<Ctx>({ theme: "chrome", setTheme: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>("chrome");

  useEffect(() => {
    const current = document.documentElement.dataset.theme as ThemeId | undefined;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (current && THEMES.some((t) => t.id === current)) setThemeState(current);
  }, []);

  const setTheme = useCallback((next: ThemeId, from?: Origin) => {
    const root = document.documentElement;
    const apply = () => {
      root.dataset.theme = next;
      setThemeState(next);
    };
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // storage unavailable
    }
    const doc = document as Document & { startViewTransition?: (cb: () => void) => { ready: Promise<void> } };
    if (!doc.startViewTransition || motionOff()) {
      // cross-fade colours briefly, then drop the transition so normal interactions stay snappy
      root.classList.add("theme-switching");
      apply();
      window.setTimeout(() => root.classList.remove("theme-switching"), 450);
      return;
    }
    // the new theme pours out in a circle from the click: the browser snapshots the old page and
    // the new one, and only the new snapshot's clip-path animates (on the compositor)
    const x = from?.x ?? window.innerWidth / 2;
    const y = from?.y ?? window.innerHeight / 2;
    const r = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    const vt = doc.startViewTransition(() => flushSync(apply));
    vt.ready
      .then(() =>
        root.animate(
          { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
          { duration: 620, easing: "cubic-bezier(0.32, 0.72, 0, 1)", pseudoElement: "::view-transition-new(root)" },
        ),
      )
      .catch(() => {});
  }, []);

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** The point a click came from; keyboard presses (no pointer) start from the button's centre. */
export function originOf(e: { clientX: number; clientY: number; detail: number; currentTarget: Element }): Origin {
  if (e.detail > 0) return { x: e.clientX, y: e.clientY };
  const r = e.currentTarget.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

export function useTheme() {
  return useContext(ThemeContext);
}
