"use client";

import { useEffect, useRef } from "react";
import { motionOff } from "@/lib/motion";

/**
 * Liquid metal pieces shared by every theme (each theme has its own metal, see globals.css).
 *
 * - LiquidChromeFilter: the SVG filter that bends the backdrop's metal bands into slow liquid
 *   swirls. It is applied to a fixed layer that never animates, so it is computed once.
 * - ChromePointer: moves the specular highlight on a metal button towards the pointer. The
 *   highlight's position is a registered CSS property with a transition, so it glides after the
 *   pointer with a little lag instead of sticking to it. Mouse and trackpad only.
 * - SegmentThumb: the metal pill that slides to the chosen option of a segmented control.
 * - HoverPill: a soft pill that follows the pointer between the options.
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

const METAL = ".bg-primary, .bg-accent, .metal";

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
      if (!fine.matches) return;
      const target = e.target instanceof Element ? e.target.closest<HTMLElement>(METAL) : null;
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
 * Motion blur for something sliding sideways: a brief blur and a little horizontal stretch that
 * peak mid-move. It uses the `filter` and `scale` properties, so it layers on top of the CSS
 * `transform` transition doing the actual move instead of replacing it.
 */
function motionBlur(el: HTMLElement, distance: number) {
  if (motionOff() || distance < 4) return;
  const stretch = Math.min(1.08, 1 + distance / 1200);
  el.animate(
    [
      { filter: "blur(0px)", scale: "1 1" },
      { filter: `blur(${Math.min(3, 1 + distance / 120).toFixed(1)}px)`, scale: `${stretch} ${(2 - stretch).toFixed(3)}`, offset: 0.4 },
      { filter: "blur(0px)", scale: "1 1" },
    ],
    { duration: 240, easing: "cubic-bezier(0.23, 1, 0.32, 1)" },
  );
}

/**
 * Sits inside a segmented control with `relative` and `p-1` (options laid out in equal columns,
 * `gap` rem apart); options above it need `relative z-10`.
 */
export function SegmentThumb({ index, count, gap = 0.25, round = "rounded-md" }: { index: number; count: number; gap?: number; round?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const last = useRef(index);
  useEffect(() => {
    const el = ref.current;
    if (el && last.current !== index && last.current >= 0) motionBlur(el, Math.abs(index - last.current) * el.offsetWidth);
    last.current = index;
  }, [index]);
  if (index < 0) return null;
  return (
    <span
      ref={ref}
      aria-hidden
      className={`segment-thumb pointer-events-none absolute inset-y-1 left-1 ${round}`}
      style={{
        width: `calc((100% - 0.5rem - ${(count - 1) * gap}rem) / ${count})`,
        transform: `translateX(calc(${index} * (100% + ${gap}rem)))`,
      }}
    />
  );
}

/**
 * A soft pill that glides to whichever option the pointer is over (with motion blur on the way),
 * then fades when the pointer leaves. Mouse and trackpad only. Put it inside the segmented
 * control, before its SegmentThumb, so the chosen option's metal stays on top. Positions are
 * written straight to the element's style: no React render per pointer move.
 */
export function HoverPill({ round = "rounded-md" }: { round?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const pill = ref.current;
    const group = pill?.parentElement;
    if (!pill || !group) return;
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    let current: HTMLElement | null = null;
    let x = 0;
    const over = (e: PointerEvent) => {
      if (!fine.matches || !(e.target instanceof Element)) return;
      const option = e.target.closest<HTMLElement>("button");
      if (!option || !group.contains(option) || option === current) return;
      const next = option.offsetLeft;
      pill.style.width = `${option.offsetWidth}px`;
      if (!current) {
        // first option under the pointer: appear in place, don't fly in from the side
        pill.style.transition = "none";
        pill.style.transform = `translateX(${next}px)`;
        void pill.offsetWidth;
        pill.style.transition = "";
      } else {
        pill.style.transform = `translateX(${next}px)`;
        motionBlur(pill, Math.abs(next - x));
      }
      pill.style.opacity = "1";
      current = option;
      x = next;
    };
    const leave = () => {
      current = null;
      pill.style.opacity = "0";
    };
    group.addEventListener("pointerover", over);
    group.addEventListener("pointerleave", leave);
    return () => {
      group.removeEventListener("pointerover", over);
      group.removeEventListener("pointerleave", leave);
    };
  }, []);
  return <span ref={ref} aria-hidden className={`hover-pill pointer-events-none absolute inset-y-1 left-0 ${round}`} />;
}
