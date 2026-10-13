"use client";

import { useEffect } from "react";

/**
 * Liquid Chrome pieces shared across the app.
 *
 * - LiquidChromeFilter: the SVG filter that bends the backdrop's metal bands into slow liquid
 *   swirls. It is applied to a fixed layer that never animates, so it is computed once.
 * - ChromePointer: moves the specular highlight on a chrome button towards the pointer. The
 *   highlight's position is a registered CSS property with a transition, so it glides after the
 *   pointer with a little lag instead of sticking to it. Mouse and trackpad only.
 * - SegmentThumb: the chrome pill that slides to the chosen option of a segmented control.
 */

export function LiquidChromeFilter() {
  return (
    <svg aria-hidden width="0" height="0" className="absolute">
      <filter id="liquid-chrome" x="-10%" y="-10%" width="120%" height="120%">
        <feTurbulence type="fractalNoise" baseFrequency="0.0035 0.005" numOctaves="2" seed="7" result="noise" />
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="180" xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </svg>
  );
}

const CHROME = ".bg-primary, .bg-accent";

export function ChromePointer() {
  useEffect(() => {
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    let el: HTMLElement | null = null;
    let frame = 0;
    let x = 0;
    let y = 0;
    const release = () => {
      el?.style.removeProperty("--mx");
      el?.style.removeProperty("--my");
      el = null;
    };
    const apply = () => {
      frame = 0;
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${(((x - r.left) / r.width) * 100).toFixed(1)}%`);
      el.style.setProperty("--my", `${(((y - r.top) / r.height) * 100).toFixed(1)}%`);
    };
    const move = (e: PointerEvent) => {
      if (!fine.matches || document.documentElement.dataset.theme !== "chrome") return;
      const target = e.target instanceof Element ? e.target.closest<HTMLElement>(CHROME) : null;
      if (target !== el) release();
      if (!target) return;
      el = target;
      x = e.clientX;
      y = e.clientY;
      if (!frame) frame = requestAnimationFrame(apply);
    };
    document.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("pointerleave", release);
    return () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerleave", release);
      cancelAnimationFrame(frame);
    };
  }, []);
  return null;
}

/**
 * Sits inside a segmented control with `relative` and `p-1` (options laid out in equal columns,
 * `gap` rem apart); options above it need `relative z-10`.
 */
export function SegmentThumb({ index, count, gap = 0.25, round = "rounded-md" }: { index: number; count: number; gap?: number; round?: string }) {
  if (index < 0) return null;
  return (
    <span
      aria-hidden
      className={`segment-thumb pointer-events-none absolute inset-y-1 left-1 ${round}`}
      style={{
        width: `calc((100% - 0.5rem - ${(count - 1) * gap}rem) / ${count})`,
        transform: `translateX(calc(${index} * (100% + ${gap}rem)))`,
      }}
    />
  );
}
