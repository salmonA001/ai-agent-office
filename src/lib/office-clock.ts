import { useEffect, useState } from "react";
import type { Lighting, Phase } from "./office-custom";

/**
 * Office time of day. The clock follows the viewer's real time, a time-lapse (one office
 * minute per second, a whole day in 24 minutes) or a fixed day, sunset or night.
 */

const DAY = 24 * 60;

let lapse: { realMs: number; office: number } | null = null;

function realMinutes(now: number) {
  const d = new Date(now);
  return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
}

/** Office time in minutes after midnight. */
export function officeMinutes(mode: Lighting, now = Date.now()): number {
  if (mode !== "fast") lapse = null;
  if (mode === "day") return 10 * 60;
  if (mode === "sunset") return 18 * 60;
  if (mode === "night") return 23 * 60;
  if (mode === "auto") return realMinutes(now);
  // time-lapse starts from the real time and runs 60x faster
  lapse ??= { realMs: now, office: realMinutes(now) };
  return (lapse.office + (now - lapse.realMs) / 1000) % DAY;
}

export function phaseAt(minutes: number): Phase {
  const h = minutes / 60;
  if (h >= 7 && h < 17) return "day";
  if ((h >= 17 && h < 19) || (h >= 6 && h < 7)) return "sunset";
  return "night";
}

/** "07:05" */
export function clockText(minutes: number) {
  const m = Math.floor(minutes) % DAY;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/**
 * Office time for components; ticks every second in time-lapse and every 20 s otherwise.
 * Returns null until mounted so prerendered HTML never depends on the clock, unless `eager`
 * (for client-only components).
 */
export function useOfficeMinutes(mode: Lighting, eager = false) {
  const [now, setNow] = useState(() => (eager ? Date.now() : 0));
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), mode === "fast" ? 1000 : 20_000);
    return () => window.clearInterval(id);
  }, [mode]);
  return now ? officeMinutes(mode, now) : null;
}
