"use client";

import { useFrame } from "@react-three/fiber";
import { memo, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  CanvasTexture,
  DoubleSide,
  type Group,
  Color,
  type InstancedMesh,
  type Mesh,
  type MeshBasicMaterial,
  Object3D,
  type PointLight,
  RepeatWrapping,
  SRGBColorSpace,
  type Texture,
} from "three";
import { type Key, type Lang, translate } from "@/lib/i18n";
import type { DecorItem, FloorStyle, Phase } from "@/lib/office-custom";
import { currentEventKind } from "./office-events";
import type { ZoneId } from "./camera-focus";
import { isPresent, walkers } from "./office-nav";
import { PcTower } from "./pc";
import { rgbMaterials } from "./rgb";
import { useStill } from "@/lib/motion";
import { clip, seeded, useDisposable } from "./scene-utils";
import { DYNAMIC, StaticMerge } from "./static-merge";

export type BoardLine = { text: string; status: "queued" | "working" | "done" | "error" };
type V3 = [number, number, number];

// ---------- Floor plan (metres, y up). The camera looks from +x/+z, so the north (-z) and
// west (-x) walls are full height and the south/east walls are cut away like a dollhouse. ----------

export const FLOOR = { x0: -8, x1: 26, z0: -6, z1: 24 };
/** The east wing (lobby, town hall, garden) starts here; the open hall is west of it. */
export const EAST = { x0: 16, lobbyZ: 1.2, gardenZ: 8.8 };
export const CORRIDOR = { z0: -0.3, z1: 0.9 };
/** South wing: a corridor (z0..door) and four zones split at x = gym, pods, labs. */
export const SOUTH = { z0: 16, door: 17.2, z1: 24, gym: 1, pods: 8.5, labs: 17 };
const MEETING = { x0: -8, x1: -2.6 };
const KITCHEN = { x0: -2.6, x1: 3 };
const LOUNGE = { x0: 3, x1: 8 };
const GAME = { x0: 8, x1: 12.2 };
const SERVER = { x0: 12.2, x1: 16 };
export const WORKSPACE = { z0: CORRIDOR.z1, z1: SOUTH.z0 };
export const PROJECTOR = { x: -5.6, z: FLOOR.z0 };
export const PRESENTER = { x: -3.9, z: -4.9 };
export const MANAGER_TV = { x: -7.7, z: -1.7 };
const EXT_H = 2.4;
const INT_H = 1.9;

const WALL = "#f1eee9";
const WALL_TOP = "#c9c4bd";
const CHAIR = "#2b2f33";
const YELLOW = "#f2c14e";

// ---------- Procedural textures ----------

function plankTexture(hue: number, sat: number, light: number, repeat: [number, number], seed: number) {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 512;
  const g = c.getContext("2d")!;
  const rnd = seeded(seed);
  const plank = 64;
  for (let x = 0; x < 512; x += plank) {
    const offset = (x / plank) % 2 ? 128 : 0;
    for (let y = -256; y < 512; y += 256) {
      g.fillStyle = `hsl(${hue + rnd() * 6}, ${sat + rnd() * 8}%, ${light + rnd() * 8}%)`;
      g.fillRect(x, y + offset, plank, 256);
      g.fillStyle = "rgba(50,25,10,0.35)";
      g.fillRect(x, y + offset, plank, 2);
    }
    g.fillStyle = "rgba(50,25,10,0.4)";
    g.fillRect(x, 0, 2, 512);
  }
  return finish(c, repeat);
}

function tileTexture(base: string, line: string, repeat: [number, number]) {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = base;
  g.fillRect(0, 0, 256, 256);
  g.fillStyle = line;
  for (let i = 0; i < 256; i += 64) {
    g.fillRect(i, 0, 2, 256);
    g.fillRect(0, i, 256, 2);
  }
  return finish(c, repeat);
}

function brickTexture(repeat: [number, number]) {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const g = c.getContext("2d")!;
  const rnd = seeded(9);
  g.fillStyle = "#e9e4dc";
  g.fillRect(0, 0, 256, 256);
  for (let row = 0; row < 8; row++) {
    for (let col = -1; col < 4; col++) {
      const x = col * 64 + (row % 2 ? 32 : 0);
      g.fillStyle = `hsl(${8 + rnd() * 8}, ${45 + rnd() * 10}%, ${34 + rnd() * 8}%)`;
      g.fillRect(x + 2, row * 32 + 2, 60, 28);
    }
  }
  return finish(c, repeat);
}

/** What the windows show: blue sky, a sunset, or a starry night. */
export function skyTexture(phase: Phase = "day") {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const g = c.getContext("2d")!;
  const grad = g.createLinearGradient(0, 0, 0, 128);
  const [top, bottom] = phase === "night" ? ["#0b1636", "#24326a"] : phase === "sunset" ? ["#ff8f6b", "#ffd59a"] : ["#9fd8f5", "#e6f6ff"];
  grad.addColorStop(0, top);
  grad.addColorStop(1, bottom);
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  if (phase === "night") {
    const rnd = seeded(21);
    g.fillStyle = "#ffffff";
    for (let i = 0; i < 26; i++) g.fillRect(rnd() * 128, rnd() * 90, 1.5, 1.5);
    g.fillStyle = "#fff6d6";
    g.beginPath();
    g.arc(96, 30, 10, 0, Math.PI * 2);
    g.fill();
  } else {
    g.fillStyle = phase === "sunset" ? "rgba(255,240,200,0.55)" : "rgba(255,255,255,0.5)";
    g.fillRect(0, 70, 128, 4);
    if (phase === "sunset") {
      g.fillStyle = "#fff1c1";
      g.beginPath();
      g.arc(40, 92, 14, 0, Math.PI * 2);
      g.fill();
    }
  }
  return finish(c, [1, 1]);
}

function carpetTexture(base: string, repeat: [number, number]) {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const g = c.getContext("2d")!;
  const rnd = seeded(31);
  g.fillStyle = base;
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = rnd() > 0.5 ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.08)";
    g.fillRect(rnd() * 256, rnd() * 256, 2, 2);
  }
  g.fillStyle = "rgba(0,0,0,0.12)";
  for (let i = 0; i < 256; i += 64) {
    g.fillRect(i, 0, 1, 256);
    g.fillRect(0, i, 256, 1);
  }
  return finish(c, repeat);
}

function concreteTexture(repeat: [number, number]) {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const g = c.getContext("2d")!;
  const rnd = seeded(17);
  g.fillStyle = "#bdbcb8";
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 40; i++) {
    const x = rnd() * 256;
    const y = rnd() * 256;
    const r = 10 + rnd() * 40;
    const blot = g.createRadialGradient(x, y, 0, x, y, r);
    blot.addColorStop(0, rnd() > 0.5 ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.07)");
    blot.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = blot;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  g.fillStyle = "rgba(0,0,0,0.14)";
  g.fillRect(0, 0, 256, 1);
  g.fillRect(0, 0, 1, 256);
  return finish(c, repeat);
}

/** Rows of colourful book spines for the library shelves. */
function booksTexture(seed: number) {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 320;
  const g = c.getContext("2d")!;
  const rnd = seeded(seed);
  g.fillStyle = "#6b4a32";
  g.fillRect(0, 0, 256, 320);
  const colors = ["#c0392b", "#2e86de", "#27ae60", "#f39c12", "#8e44ad", "#16a085", "#e67e22", "#f5f0e6", "#34495e", "#e84393"];
  for (let shelf = 0; shelf < 5; shelf++) {
    const base = 60 + shelf * 64;
    let x = 6;
    while (x < 246) {
      const w = 7 + rnd() * 9;
      const h = 34 + rnd() * 18;
      if (rnd() < 0.08) {
        x += w + 6;
        continue;
      }
      g.fillStyle = colors[Math.floor(rnd() * colors.length)];
      g.fillRect(x, base - h, w, h);
      g.fillStyle = "rgba(255,255,255,0.35)";
      g.fillRect(x + 1, base - h + 6, w - 2, 2);
      x += w + 1;
    }
    g.fillStyle = "#4a3222";
    g.fillRect(0, base, 256, 6);
  }
  return finish(c, [1, 1]);
}

function vendingTexture() {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = "#14181c";
  g.fillRect(0, 0, 128, 256);
  const colors = ["#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#ec4899", "#a3e635"];
  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 4; col++) {
      g.fillStyle = colors[(row + col) % colors.length];
      g.fillRect(10 + col * 28, 14 + row * 38, 18, 26);
    }
    g.fillStyle = "#6b7280";
    g.fillRect(6, 42 + row * 38, 116, 3);
  }
  return finish(c, [1, 1]);
}

function artTexture(seed: number) {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 96;
  const g = c.getContext("2d")!;
  const rnd = seeded(seed);
  g.fillStyle = ["#fef3c7", "#e0f2fe", "#fce7f3"][seed % 3];
  g.fillRect(0, 0, 128, 96);
  for (let i = 0; i < 5; i++) {
    g.fillStyle = ["#10b981", "#f59e0b", "#ec4899", "#3b82f6", "#ef4444"][(i + seed) % 5];
    g.beginPath();
    if (i % 2) g.arc(rnd() * 128, rnd() * 96, 10 + rnd() * 20, 0, Math.PI * 2);
    else g.rect(rnd() * 100, rnd() * 70, 20 + rnd() * 30, 10 + rnd() * 20);
    g.fill();
  }
  return finish(c, [1, 1]);
}

function finish(c: HTMLCanvasElement, repeat: [number, number]) {
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.repeat.set(repeat[0], repeat[1]);
  tex.anisotropy = 8;
  return tex;
}

/** Projector slide listing the live subtasks. */
function slideTexture(lines: BoardLine[], merging: boolean, lang: Lang) {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 576;
  const g = c.getContext("2d")!;
  const font = 'system-ui, "Segoe UI", Roboto, sans-serif';
  g.fillStyle = "#fbfbfa";
  g.fillRect(0, 0, 1024, 576);
  g.fillStyle = "#10b981";
  g.fillRect(0, 0, 1024, 96);
  g.fillStyle = "#ffffff";
  g.font = `700 46px ${font}`;
  g.fillText(translate(lang, merging ? "slide.merging" : "slide.title"), 40, 64);
  if (lines.length === 0) {
    g.fillStyle = "#6b7280";
    g.font = `500 40px ${font}`;
    g.fillText(translate(lang, "slide.empty"), 150, 320);
  }
  lines.slice(0, 7).forEach((l, i) => {
    const y = 150 + i * 60;
    const box = { done: "#10b981", working: "#f59e0b", error: "#ef4444", queued: "#9ca3af" }[l.status];
    g.lineWidth = 5;
    g.strokeStyle = box;
    g.strokeRect(48, y - 30, 36, 36);
    if (l.status !== "queued") {
      g.fillStyle = box;
      g.font = `800 32px ${font}`;
      g.fillText(l.status === "done" ? "✓" : l.status === "error" ? "✗" : "●", 52, y);
    }
    g.fillStyle = l.status === "done" ? "#6b7280" : "#111827";
    g.font = `600 34px ${font}`;
    g.fillText(clip(l.text, 46), 106, y);
  });
  g.fillStyle = "#9ca3af";
  g.font = `500 22px ${font}`;
  g.textAlign = "right";
  g.fillText(translate(lang, "slide.footer"), 1000, 552);
  return finish(c, [1, 1]);
}

// ---------- Building blocks ----------

function B({ s, p, c, r = 0, rough = 0.7, metal = 0 }: { s: V3; p: V3; c: string; r?: number; rough?: number; metal?: number }) {
  return (
    <mesh position={p} rotation-y={r} castShadow receiveShadow>
      <boxGeometry args={s} />
      <meshStandardMaterial color={c} roughness={rough} metalness={metal} />
    </mesh>
  );
}

function Floor({ x0, x1, z0, z1, map, color, y = 0.002 }: { x0: number; x1: number; z0: number; z1: number; map?: Texture; color?: string; y?: number }) {
  return (
    <mesh rotation-x={-Math.PI / 2} position={[(x0 + x1) / 2, y, (z0 + z1) / 2]} receiveShadow>
      <planeGeometry args={[x1 - x0, z1 - z0]} />
      <meshStandardMaterial map={map} color={color ?? "#ffffff"} roughness={0.6} />
    </mesh>
  );
}

/** Straight wall from a to b (on the floor plane) with a darker cap, like the cut walls of a model. */
function Wall({ a, b, h, t = 0.15, color = WALL }: { a: [number, number]; b: [number, number]; h: number; t?: number; color?: string }) {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const len = Math.hypot(dx, dz);
  const rot = -Math.atan2(dz, dx);
  const cx = (a[0] + b[0]) / 2;
  const cz = (a[1] + b[1]) / 2;
  return (
    <group position={[cx, 0, cz]} rotation-y={rot}>
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[len + t, h, t]} />
        <meshStandardMaterial color={color} roughness={0.85} />
      </mesh>
      <mesh position={[0, h + 0.01, 0]}>
        <boxGeometry args={[len + t, 0.02, t + 0.01]} />
        <meshStandardMaterial color={WALL_TOP} />
      </mesh>
    </group>
  );
}

/** Glass partition along x at depth z, from x0 to x1, with a low solid base and mullions. */
function GlassWall({ x0, x1, z, h = INT_H }: { x0: number; x1: number; z: number; h?: number }) {
  const len = x1 - x0;
  const posts = Math.max(1, Math.round(len / 1.2));
  return (
    <group position={[(x0 + x1) / 2, 0, z]}>
      <B s={[len, 0.12, 0.1]} p={[0, 0.06, 0]} c="#d6d3cf" />
      <mesh position={[0, h / 2 + 0.06, 0]}>
        <boxGeometry args={[len, h - 0.12, 0.03]} />
        <meshStandardMaterial color="#bfe3f0" transparent opacity={0.22} depthWrite={false} roughness={0.1} />
      </mesh>
      {Array.from({ length: posts + 1 }, (_, i) => (
        <B key={i} s={[0.05, h, 0.06]} p={[-len / 2 + (i * len) / posts, h / 2, 0]} c="#5f6b70" />
      ))}
      <B s={[len, 0.05, 0.06]} p={[0, h, 0]} c="#5f6b70" />
    </group>
  );
}

/** Door frame in a gap along x, with a yellow door swung open into the room (-z). */
function Door({ x0, x1, z }: { x0: number; x1: number; z: number }) {
  const w = x1 - x0;
  return (
    <group>
      <B s={[0.07, 2.05, 0.16]} p={[x0, 1.025, z]} c="#ffffff" />
      <B s={[0.07, 2.05, 0.16]} p={[x1, 1.025, z]} c="#ffffff" />
      <B s={[w + 0.07, 0.07, 0.16]} p={[(x0 + x1) / 2, 2.05, z]} c="#ffffff" />
      <group position={[x1, 0, z]} rotation-y={-Math.PI / 2 + 0.25}>
        <B s={[w - 0.08, 2.0, 0.05]} p={[-(w - 0.08) / 2, 1.0, 0]} c={YELLOW} />
        <B s={[0.03, 0.03, 0.12]} p={[-(w - 0.2), 1.0, 0]} c="#9ca3af" />
      </group>
    </group>
  );
}

function WindowPane({ p, r = 0, w, h, sky }: { p: V3; r?: number; w: number; h: number; sky: Texture }) {
  return (
    <group position={p} rotation-y={r}>
      <mesh>
        <boxGeometry args={[w + 0.1, h + 0.1, 0.04]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
      <mesh position={[0, 0, 0.025]}>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial map={sky} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0, 0.03]}>
        <planeGeometry args={[0.04, h]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
    </group>
  );
}

function Art({ p, r = 0, seed, w = 0.8, h = 0.6 }: { p: V3; r?: number; seed: number; w?: number; h?: number }) {
  const tex = useDisposable(() => artTexture(seed), `art${seed}`);
  return (
    <group position={p} rotation-y={r}>
      <mesh>
        <boxGeometry args={[w + 0.08, h + 0.08, 0.03]} />
        <meshStandardMaterial color="#222222" />
      </mesh>
      <mesh position={[0, 0, 0.02]}>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial map={tex} />
      </mesh>
    </group>
  );
}

/** Black swivel office chair; the sitter faces -z (backrest on +z). */
export function OfficeChair({ p, r = 0 }: { p: V3; r?: number }) {
  return (
    <group position={p} rotation-y={r}>
      <mesh position={[0, 0.04, 0]} castShadow>
        <cylinderGeometry args={[0.26, 0.26, 0.04, 16]} />
        <meshStandardMaterial color={CHAIR} />
      </mesh>
      <mesh position={[0, 0.25, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 0.38, 8]} />
        <meshStandardMaterial color="#6b7280" metalness={0.6} roughness={0.4} />
      </mesh>
      <B s={[0.48, 0.07, 0.46]} p={[0, 0.46, 0]} c={CHAIR} />
      <B s={[0.46, 0.5, 0.07]} p={[0, 0.78, 0.22]} c={CHAIR} />
    </group>
  );
}

function WoodChair({ p, r = 0 }: { p: V3; r?: number }) {
  return (
    <group position={p} rotation-y={r}>
      <B s={[0.4, 0.05, 0.4]} p={[0, 0.45, 0]} c="#c08850" />
      <B s={[0.4, 0.4, 0.05]} p={[0, 0.68, 0.18]} c="#c08850" />
      {[
        [-0.17, -0.17],
        [0.17, -0.17],
        [-0.17, 0.17],
        [0.17, 0.17],
      ].map(([x, z]) => (
        <B key={`${x}${z}`} s={[0.04, 0.45, 0.04]} p={[x, 0.225, z]} c="#8a5a32" />
      ))}
    </group>
  );
}

function Table({ p, s, top = "#f5f5f4", legs = "#374151" }: { p: V3; s: [number, number]; top?: string; legs?: string }) {
  const [w, d] = s;
  return (
    <group position={p}>
      <B s={[w, 0.05, d]} p={[0, 0.75, 0]} c={top} rough={0.4} />
      {[
        [-w / 2 + 0.06, -d / 2 + 0.06],
        [w / 2 - 0.06, -d / 2 + 0.06],
        [-w / 2 + 0.06, d / 2 - 0.06],
        [w / 2 - 0.06, d / 2 - 0.06],
      ].map(([x, z]) => (
        <B key={`${x}${z}`} s={[0.05, 0.73, 0.05]} p={[x, 0.365, z]} c={legs} />
      ))}
    </group>
  );
}

function Sofa({ p, r = 0, color = "#f3f4f6" }: { p: V3; r?: number; color?: string }) {
  return (
    <group position={p} rotation-y={r}>
      <B s={[1.8, 0.4, 0.8]} p={[0, 0.2, 0]} c={color} rough={0.9} />
      <B s={[1.8, 0.5, 0.2]} p={[0, 0.55, -0.3]} c={color} rough={0.9} />
      <B s={[0.18, 0.55, 0.8]} p={[-0.81, 0.32, 0]} c={color} rough={0.9} />
      <B s={[0.18, 0.55, 0.8]} p={[0.81, 0.32, 0]} c={color} rough={0.9} />
      <B s={[0.7, 0.1, 0.55]} p={[-0.37, 0.45, 0.08]} c="#e5e7eb" rough={0.9} />
      <B s={[0.7, 0.1, 0.55]} p={[0.37, 0.45, 0.08]} c="#e5e7eb" rough={0.9} />
    </group>
  );
}

function Armchair({ p, r = 0, color = "#1f2328" }: { p: V3; r?: number; color?: string }) {
  return (
    <group position={p} rotation-y={r}>
      <B s={[0.8, 0.4, 0.8]} p={[0, 0.2, 0]} c={color} rough={0.6} />
      <B s={[0.8, 0.55, 0.2]} p={[0, 0.6, -0.3]} c={color} rough={0.6} />
      <B s={[0.16, 0.5, 0.8]} p={[-0.36, 0.4, 0]} c={color} rough={0.6} />
      <B s={[0.16, 0.5, 0.8]} p={[0.36, 0.4, 0]} c={color} rough={0.6} />
    </group>
  );
}

export function PalmPlant({ p, s = 1 }: { p: V3; s?: number }) {
  const leaves = useRef<Group>(null);
  const still = useStill();
  useFrame(({ clock }) => {
    if (!leaves.current || still) return;
    const t = clock.elapsedTime + p[0];
    leaves.current.rotation.z = Math.sin(t * 0.9) * 0.05;
    leaves.current.rotation.x = Math.sin(t * 0.7) * 0.04;
  });
  return (
    <group userData={DYNAMIC} position={p} scale={s}>
      <mesh position={[0, 0.22, 0]} castShadow>
        <cylinderGeometry args={[0.22, 0.17, 0.44, 20]} />
        <meshStandardMaterial color="#f5f5f4" />
      </mesh>
      <mesh position={[0, 0.75, 0]}>
        <cylinderGeometry args={[0.03, 0.04, 0.7, 8]} />
        <meshStandardMaterial color="#7c5a3a" />
      </mesh>
      <group ref={leaves}>
      {Array.from({ length: 8 }, (_, i) => (
        <group key={i} position={[0, 1.1 + (i % 2) * 0.12, 0]} rotation-y={(i / 8) * Math.PI * 2}>
          <mesh position={[0, -0.05, 0.32]} rotation-x={0.55} scale={[0.14, 0.03, 0.55]} castShadow>
            <sphereGeometry args={[1, 10, 8]} />
            <meshStandardMaterial color={i % 2 ? "#2f8f4e" : "#3fae5f"} />
          </mesh>
        </group>
      ))}
      </group>
    </group>
  );
}

/** Wisps of steam rising from the coffee machine. */
function Steam({ p }: { p: V3 }) {
  const puffs = useRef<(Group | null)[]>([]);
  const still = useStill();
  useFrame(({ clock }) => {
    if (still) return;
    puffs.current.forEach((g, i) => {
      if (!g) return;
      const k = (clock.elapsedTime * 0.5 + i / 3) % 1;
      g.position.set(Math.sin(k * 6 + i) * 0.04, k * 0.45, 0);
      const broken = currentEventKind() === "coffee";
      g.scale.setScalar((0.5 + k) * (broken ? 1.8 : 1));
      const m = (g.children[0] as Mesh).material as MeshBasicMaterial;
      m.opacity = (broken ? 0.75 : 0.45) * (1 - k);
      m.color.set(broken ? "#3f3f46" : "#ffffff");
    });
  });
  return (
    <group userData={DYNAMIC} position={p}>
      {[0, 1, 2].map((i) => (
        <group
          key={i}
          ref={(g) => {
            puffs.current[i] = g;
          }}
        >
          <mesh>
            <sphereGeometry args={[0.05, 8, 8]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.4} depthWrite={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export function Planter({ p, len, r = 0 }: { p: V3; len: number; r?: number }) {
  const bushes = Math.max(2, Math.round(len / 0.35));
  return (
    <group position={p} rotation-y={r}>
      <B s={[len, 0.42, 0.42]} p={[0, 0.21, 0]} c="#e7e5e4" />
      {Array.from({ length: bushes }, (_, i) => (
        <mesh key={i} position={[-len / 2 + 0.2 + (i * (len - 0.4)) / Math.max(1, bushes - 1), 0.5, (i % 2) * 0.08 - 0.04]} castShadow>
          <sphereGeometry args={[0.2, 10, 8]} />
          <meshStandardMaterial color={i % 2 ? "#3f9e5a" : "#4fb86a"} />
        </mesh>
      ))}
    </group>
  );
}

// ---------- Rooms ----------

function MeetingRoom({ sky }: { sky: Texture }) {
  const wood = useDisposable(() => plankTexture(12, 30, 52, [3, 3], 4), "meeting-floor");
  const bricks = useDisposable(() => brickTexture([4, 2]), "bricks");
  const { x0, x1 } = MEETING;
  const cx = (x0 + x1) / 2;
  return (
    <group>
      <Floor x0={x0} x1={x1} z0={FLOOR.z0} z1={CORRIDOR.z0} map={wood} />
      {/* brick feature wall behind the projector */}
      <mesh position={[cx, EXT_H / 2, FLOOR.z0 + 0.08]}>
        <planeGeometry args={[x1 - x0 - 0.1, EXT_H]} />
        <meshStandardMaterial map={bricks} roughness={0.95} />
      </mesh>
      {/* projector housing (the screen itself is the live <Projector />) */}
      <B s={[2.9, 0.12, 0.15]} p={[PROJECTOR.x, 2.2, FLOOR.z0 + 0.18]} c="#1f2937" />
      <Table p={[-5.4, 0, -3.1]} s={[3.0, 1.1]} />
      {[-6.4, -5.4, -4.4].flatMap((x) => [
        <OfficeChair key={`s${x}`} p={[x, 0, -2.25]} />,
        <OfficeChair key={`n${x}`} p={[x, 0, -3.95]} r={Math.PI} />,
      ])}
      {/* whiteboard on the west wall */}
      <group position={[x0 + 0.1, 1.35, -4.6]} rotation-y={Math.PI / 2}>
        <B s={[1.7, 1.05, 0.04]} p={[0, 0, 0]} c="#9ca3af" />
        <mesh position={[0, 0, 0.025]}>
          <planeGeometry args={[1.6, 0.95]} />
          <meshStandardMaterial color="#ffffff" roughness={0.3} />
        </mesh>
        {[0.25, 0.05, -0.15].map((y, i) => (
          <mesh key={y} position={[-0.25 + i * 0.1, y, 0.03]}>
            <planeGeometry args={[0.9 - i * 0.2, 0.025]} />
            <meshBasicMaterial color={["#10b981", "#3b82f6", "#ef4444"][i]} />
          </mesh>
        ))}
      </group>
      <WindowPane p={[x0 + 0.09, 1.5, -3.2]} r={Math.PI / 2} w={1.1} h={1.1} sky={sky} />
      {/* yellow sideboard under the manager's dashboard */}
      <B s={[0.45, 0.75, 1.4]} p={[MANAGER_TV.x, 0.375, MANAGER_TV.z]} c="#e8b23a" />
      <B s={[0.7, 1.7, 0.5]} p={[x0 + 0.5, 0.85, FLOOR.z0 + 0.45]} c="#e8b23a" />
      <PalmPlant p={[x1 - 0.5, 0, FLOOR.z0 + 0.5]} s={0.9} />
    </group>
  );
}

function Kitchen() {
  const wood = useDisposable(() => plankTexture(28, 55, 58, [3, 3], 6), "kitchen-floor");
  const { x0, x1 } = KITCHEN;
  const back = FLOOR.z0;
  return (
    <group>
      <Floor x0={x0} x1={x1} z0={FLOOR.z0} z1={CORRIDOR.z0} map={wood} />
      {/* counter run with orange cabinets */}
      <B s={[3.8, 0.85, 0.6]} p={[-0.5, 0.425, back + 0.38]} c="#d9772b" />
      <B s={[3.85, 0.05, 0.64]} p={[-0.5, 0.875, back + 0.38]} c="#3f3f46" rough={0.3} />
      {[-2.0, -1.25, -0.5, 0.25, 1.0].map((x) => (
        <B key={x} s={[0.02, 0.6, 0.01]} p={[x + 0.37, 0.45, back + 0.685]} c="#a3541c" />
      ))}
      {/* upper cabinets */}
      <B s={[3.8, 0.55, 0.35]} p={[-0.5, 1.8, back + 0.25]} c="#e8893c" />
      {/* sink + stove */}
      <B s={[0.5, 0.02, 0.36]} p={[-1.5, 0.905, back + 0.38]} c="#cbd5e1" metal={0.6} rough={0.3} />
      <B s={[0.6, 0.02, 0.45]} p={[0.6, 0.905, back + 0.38]} c="#111111" />
      {[
        [0.45, 0.28],
        [0.75, 0.28],
        [0.45, 0.5],
        [0.75, 0.5],
      ].map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x, 0.92, back + z]} rotation-x={-Math.PI / 2}>
          <ringGeometry args={[0.05, 0.08, 16]} />
          <meshBasicMaterial color="#6b7280" />
        </mesh>
      ))}
      {/* coffee machine */}
      <B s={[0.25, 0.35, 0.25]} p={[1.15, 1.08, back + 0.35]} c="#1f2937" />
      <Steam p={[1.15, 1.3, back + 0.42]} />
      {/* fridge */}
      <B s={[0.85, 1.95, 0.7]} p={[2.35, 0.975, back + 0.42]} c="#26292d" rough={0.35} metal={0.3} />
      <B s={[0.03, 0.5, 0.03]} p={[2.05, 1.25, back + 0.79]} c="#9ca3af" />
      {/* island with stools */}
      <B s={[2.2, 0.88, 0.9]} p={[-0.6, 0.44, -3.4]} c="#4a3b33" />
      <B s={[2.3, 0.05, 1.0]} p={[-0.6, 0.905, -3.4]} c="#f5f5f4" rough={0.3} />
      {[-1.3, -0.6, 0.1].map((x) => (
        <group key={x} position={[x, 0, -2.6]}>
          <mesh position={[0, 0.33, 0]}>
            <cylinderGeometry args={[0.025, 0.025, 0.66, 8]} />
            <meshStandardMaterial color="#6b7280" metalness={0.6} />
          </mesh>
          <mesh position={[0, 0.68, 0]} castShadow>
            <cylinderGeometry args={[0.17, 0.17, 0.06, 16]} />
            <meshStandardMaterial color="#f59e0b" />
          </mesh>
        </group>
      ))}
      {/* two dining tables */}
      {[-1.6, 1.8].map((x) => (
        <group key={x}>
          <Table p={[x, 0, -1.35]} s={[0.95, 0.95]} top="#e9c38b" legs="#8a5a32" />
          <WoodChair p={[x, 0, -0.75]} />
          <WoodChair p={[x, 0, -1.95]} r={Math.PI} />
          <WoodChair p={[x - 0.6, 0, -1.35]} r={-Math.PI / 2} />
          <WoodChair p={[x + 0.6, 0, -1.35]} r={Math.PI / 2} />
        </group>
      ))}
      <Art p={[x0 + 0.09, 1.5, -1.4]} r={Math.PI / 2} seed={3} w={0.9} h={0.6} />
    </group>
  );
}

function Lounge({ sky }: { sky: Texture }) {
  const tiles = useDisposable(() => tileTexture("#eceae6", "#d6d3cf", [4, 4]), "lounge-floor");
  const vending = useDisposable(vendingTexture, "vending");
  const { x0, x1 } = LOUNGE;
  return (
    <group>
      <Floor x0={x0} x1={x1} z0={FLOOR.z0} z1={CORRIDOR.z0} map={tiles} />
      <Floor x0={4.1} x1={7.1} z0={-4.4} z1={-2.0} color="#e8899a" y={0.006} />
      <Sofa p={[5.6, 0, -4.45]} />
      <Sofa p={[7.25, 0, -3.05]} r={-Math.PI / 2} />
      <group position={[5.5, 0, -3.0]}>
        <B s={[1.0, 0.06, 0.6]} p={[0, 0.36, 0]} c="#2fa39b" rough={0.4} />
        <B s={[0.9, 0.33, 0.5]} p={[0, 0.165, 0]} c="#1f2937" />
      </group>
      <Armchair p={[3.9, 0, -3.6]} r={Math.PI / 2} />
      <Armchair p={[3.9, 0, -2.4]} r={Math.PI / 2} />
      {/* red vending machine */}
      <group position={[7.3, 0, FLOOR.z0 + 0.45]}>
        <B s={[0.9, 1.95, 0.7]} p={[0, 0.975, 0]} c="#d63a3a" rough={0.4} />
        <mesh position={[-0.12, 1.1, 0.355]}>
          <planeGeometry args={[0.55, 1.4]} />
          <meshBasicMaterial map={vending} toneMapped={false} />
        </mesh>
        <B s={[0.18, 0.5, 0.02]} p={[0.3, 1.2, 0.36]} c="#111111" />
      </group>
      <WindowPane p={[5.6, 1.55, FLOOR.z0 + 0.09]} w={1.8} h={1.1} sky={sky} />
      <PalmPlant p={[x0 + 0.5, 0, FLOOR.z0 + 0.55]} />
      <Art p={[x0 + 0.09, 1.45, -1.6]} r={Math.PI / 2} seed={7} w={0.7} h={0.5} />
    </group>
  );
}

// ---------- The open hall: desks (drawn by OfficeScene) surrounded by zones ----------

export type FloorDecor = {
  floor: FloorStyle;
  accent: string;
  items: Record<DecorItem, boolean>;
  sign: string;
  phase: Phase;
};

function hallFloorTexture(style: FloorStyle) {
  if (style === "wood") return plankTexture(30, 42, 60, [12, 8], 12);
  if (style === "carpet") return carpetTexture("#7d8fa6", [12, 7.5]);
  if (style === "concrete") return concreteTexture([6, 4]);
  return tileTexture("#e9ebee", "#d7dadf", [8, 5]);
}

/** A light bulb that glows warm after dark. */
function Bulb({ p, r = 0.06, on }: { p: V3; r?: number; on: boolean }) {
  return (
    <mesh position={p}>
      <sphereGeometry args={[r, 12, 12]} />
      <meshBasicMaterial color={on ? "#ffd58a" : "#f5f1e6"} toneMapped={false} />
    </mesh>
  );
}

function FloorLamp({ p, on }: { p: V3; on: boolean }) {
  return (
    <group position={p}>
      <B s={[0.32, 0.04, 0.32]} p={[0, 0.02, 0]} c="#2b2f33" />
      <mesh position={[0, 0.8, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 1.56, 8]} />
        <meshStandardMaterial color="#2b2f33" metalness={0.5} />
      </mesh>
      <mesh position={[0, 1.62, 0]}>
        <cylinderGeometry args={[0.14, 0.22, 0.26, 20, 1, true]} />
        <meshStandardMaterial color="#f6ead2" side={DoubleSide} emissive="#ffcf8a" emissiveIntensity={on ? 0.9 : 0} />
      </mesh>
      <Bulb p={[0, 1.56, 0]} r={0.05} on={on} />
    </group>
  );
}

function Rug({ x0, x1, z0, z1, color }: { x0: number; x1: number; z0: number; z1: number; color: string }) {
  return (
    <group>
      <Floor x0={x0} x1={x1} z0={z0} z1={z1} color={color} y={0.006} />
      <Floor x0={x0 + 0.12} x1={x1 - 0.12} z0={z0 + 0.12} z1={z1 - 0.12} color="#ffffff" y={0.007} />
      <Floor x0={x0 + 0.16} x1={x1 - 0.16} z0={z0 + 0.16} z1={z1 - 0.16} color={color} y={0.008} />
    </group>
  );
}

/** Tall bookshelf; its open side faces +z before rotation. */
function Bookshelf({ p, r = 0, seed }: { p: V3; r?: number; seed: number }) {
  const books = useDisposable(() => booksTexture(seed), `books${seed}`);
  return (
    <group position={p} rotation-y={r}>
      <B s={[1.4, 2.0, 0.36]} p={[0, 1.0, -0.02]} c="#8a5a32" />
      <mesh position={[0, 1.0, 0.165]}>
        <planeGeometry args={[1.3, 1.9]} />
        <meshStandardMaterial map={books} roughness={0.9} />
      </mesh>
      <B s={[1.44, 0.06, 0.4]} p={[0, 2.02, 0]} c="#6b4a32" />
    </group>
  );
}

function Library({ decor, sky }: { decor: FloorDecor; sky: Texture }) {
  const glow = decor.phase !== "day";
  return (
    <group>
      {decor.items.rugs && <Rug x0={-7.25} x1={-4.15} z0={2.15} z1={4.25} color="#b5835a" />}
      <Bookshelf p={[-7.74, 0, 2.25]} r={Math.PI / 2} seed={41} />
      <Bookshelf p={[-7.74, 0, 3.85]} r={Math.PI / 2} seed={42} />
      <Armchair p={[-6.7, 0, 3.2]} r={Math.PI / 2} color="#8a4f3d" />
      <Armchair p={[-4.7, 0, 3.2]} r={-Math.PI / 2} color="#3f5f6b" />
      {/* side table with a stack of books and a mug */}
      <group position={[-5.7, 0, 3.2]}>
        <mesh position={[0, 0.44, 0]} castShadow>
          <cylinderGeometry args={[0.3, 0.3, 0.04, 20]} />
          <meshStandardMaterial color="#c08850" />
        </mesh>
        <mesh position={[0, 0.22, 0]}>
          <cylinderGeometry args={[0.04, 0.07, 0.44, 8]} />
          <meshStandardMaterial color="#5a3a2a" />
        </mesh>
        <B s={[0.2, 0.05, 0.14]} p={[-0.06, 0.485, 0]} c="#2e86de" />
        <B s={[0.18, 0.04, 0.13]} p={[-0.06, 0.53, 0.01]} c="#c0392b" r={0.2} />
        <mesh position={[0.12, 0.5, 0.05]}>
          <cylinderGeometry args={[0.035, 0.03, 0.08, 12]} />
          <meshStandardMaterial color="#f5f0e6" />
        </mesh>
      </group>
      {decor.items.lamps && <FloorLamp p={[-7.3, 0, 1.15]} on={glow} />}
      <WindowPane p={[-7.91, 1.5, 5.1]} r={Math.PI / 2} w={0.8} h={1.1} sky={sky} />
    </group>
  );
}

function Treadmill({ p }: { p: V3 }) {
  return (
    <group position={p}>
      <B s={[1.6, 0.12, 0.8]} p={[0, 0.06, 0]} c="#2b2f33" />
      <B s={[1.4, 0.02, 0.56]} p={[-0.05, 0.13, 0]} c="#111317" />
      {[-0.36, 0.36].map((z) => (
        <B key={z} s={[0.06, 1.0, 0.06]} p={[0.72, 0.6, z]} c="#4b5563" />
      ))}
      <B s={[0.22, 0.08, 0.78]} p={[0.7, 1.1, 0]} c="#374151" />
      <mesh position={[0.62, 1.15, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[0.3, 0.06]} />
        <meshBasicMaterial color="#34d399" toneMapped={false} />
      </mesh>
    </group>
  );
}

function YogaMat({ p, color }: { p: V3; color: string }) {
  return <B s={[1.5, 0.014, 0.62]} p={[p[0], 0.008, p[2]]} c={color} rough={0.95} />;
}

/** The office name in green neon on the wellness wall. */
function OfficeSign({ text }: { text: string }) {
  const tex = useDisposable(() => neonTexture(text.trim() || " ", "#34d399"), `sign:${text}`);
  return (
    <group position={[-7.9, 2.08, 9.0]} rotation-y={Math.PI / 2}>
      <B s={[2.34, 0.62, 0.04]} p={[0, 0, 0]} c="#111827" />
      <mesh position={[0, 0, 0.025]}>
        <planeGeometry args={[2.24, 0.56]} />
        <meshBasicMaterial map={tex} transparent toneMapped={false} />
      </mesh>
    </group>
  );
}

function Wellness({ decor }: { decor: FloorDecor }) {
  return (
    <group>
      <Floor x0={-7.92} x1={-3.7} z0={5.95} z1={10.6} color="#c9d6cf" y={0.004} />
      {/* mirror wall */}
      <group position={[-7.91, 1.02, 9.0]} rotation-y={Math.PI / 2}>
        <B s={[2.2, 1.42, 0.04]} p={[0, 0, 0]} c="#d6d3cf" />
        <mesh position={[0, 0, 0.025]}>
          <planeGeometry args={[2.1, 1.32]} />
          <meshStandardMaterial color="#dcebf2" metalness={0.6} roughness={0.08} />
        </mesh>
      </group>
      <Treadmill p={[-7.1, 0, 6.8]} />
      <YogaMat p={[-6.5, 0, 8.5]} color="#8b5cf6" />
      <YogaMat p={[-6.5, 0, 9.5]} color="#14b8a6" />
      <mesh position={[-4.3, 0.3, 9.9]} castShadow>
        <sphereGeometry args={[0.3, 24, 16]} />
        <meshStandardMaterial color="#60a5fa" roughness={0.4} />
      </mesh>
      <PalmPlant p={[-7.45, 0, 10.35]} />
      {decor.items.sign && <OfficeSign text={decor.sign} />}
      {decor.items.art && <Art p={[-7.91, 1.75, 6.8]} r={Math.PI / 2} seed={13} w={0.9} h={0.5} />}
    </group>
  );
}

/** Glass phone booth against the west wall, open towards the hall. */
function PhoneBooth({ z, accent, glow }: { z: number; accent: string; glow: boolean }) {
  const x0 = -7.92;
  const x1 = -6.62;
  return (
    <group>
      <Floor x0={x0} x1={x1} z0={z - 0.65} z1={z + 0.65} color="#3b3f46" y={0.006} />
      <GlassWall x0={x0} x1={x1} z={z - 0.65} h={2.1} />
      <GlassWall x0={x0} x1={x1} z={z + 0.65} h={2.1} />
      <B s={[0.06, 0.06, 1.3]} p={[x1, 2.1, z]} c="#5f6b70" />
      <mesh position={[-7.91, 1.25, z]} rotation-y={Math.PI / 2}>
        <planeGeometry args={[1.1, 1.2]} />
        <meshStandardMaterial color={accent} roughness={1} />
      </mesh>
      <B s={[0.3, 0.04, 0.6]} p={[-7.75, 1.0, z]} c="#c08850" />
      <Bulb p={[-7.3, 1.98, z]} r={0.07} on={glow} />
    </group>
  );
}

function PrintStation() {
  return (
    <group>
      <group position={[-5.0, 0, 15.45]}>
        <B s={[0.6, 0.6, 0.5]} p={[0, 0.3, 0]} c="#d1d5db" />
        <B s={[0.55, 0.15, 0.45]} p={[0, 0.68, 0]} c="#e5e7eb" />
        <B s={[0.3, 0.01, 0.2]} p={[0, 0.765, -0.05]} c="#ffffff" />
      </group>
      <B s={[0.8, 1.1, 0.5]} p={[-6.2, 0.55, 15.5]} c="#9ca3af" />
      <B s={[0.7, 0.02, 0.4]} p={[-6.2, 1.11, 15.5]} c="#6b7280" />
    </group>
  );
}

function Breakout({ decor }: { decor: FloorDecor }) {
  return (
    <group>
      {decor.items.rugs && (
        <mesh rotation-x={-Math.PI / 2} position={[14.3, 0.006, 3.6]} receiveShadow>
          <circleGeometry args={[1.3, 40]} />
          <meshStandardMaterial color={decor.accent} roughness={1} />
        </mesh>
      )}
      {/* water cooler */}
      <group position={[15.5, 0, 1.6]}>
        <B s={[0.35, 1.0, 0.35]} p={[0, 0.5, 0]} c="#f5f5f4" />
        <mesh position={[0, 1.2, 0]}>
          <cylinderGeometry args={[0.15, 0.15, 0.4, 16]} />
          <meshStandardMaterial color="#93c5fd" transparent opacity={0.7} />
        </mesh>
      </group>
      {/* round table, two chairs and beanbags */}
      <group position={[14.3, 0, 3.6]}>
        <mesh position={[0, 0.74, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.6, 0.6, 0.05, 32]} />
          <meshStandardMaterial color="#f5f5f4" />
        </mesh>
        <mesh position={[0, 0.37, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 0.72, 8]} />
          <meshStandardMaterial color="#374151" />
        </mesh>
        <WoodChair p={[0, 0, 0.85]} />
        <WoodChair p={[-0.85, 0, 0]} r={-Math.PI / 2} />
        {[
          [1.3, 0.9, "#10b981"],
          [1.1, -1.0, "#f59e0b"],
        ].map(([x, z, c]) => (
          <mesh key={c as string} position={[x as number, 0.22, z as number]} scale={[1, 0.6, 1]} castShadow>
            <sphereGeometry args={[0.42, 20, 16]} />
            <meshStandardMaterial color={c as string} roughness={0.9} />
          </mesh>
        ))}
      </group>
      <PalmPlant p={[15.55, 0, 5.6]} />
    </group>
  );
}

/** Ping-pong table running along z in the east of the hall. */
function PingPongTable() {
  return (
    <group position={[14.4, 0, 7.85]}>
      <B s={[1.5, 0.05, 2.6]} p={[0, 0.74, 0]} c="#1f7a4d" rough={0.5} />
      <B s={[0.02, 0.01, 2.6]} p={[0, 0.77, 0]} c="#ffffff" />
      <B s={[1.6, 0.15, 0.02]} p={[0, 0.84, 0]} c="#e5e7eb" />
      {[
        [-0.65, -1.15],
        [0.65, -1.15],
        [-0.65, 1.15],
        [0.65, 1.15],
      ].map(([x, z]) => (
        <B key={`${x}${z}`} s={[0.05, 0.72, 0.05]} p={[x, 0.36, z]} c="#374151" />
      ))}
    </group>
  );
}

/** Fish tank with fish swimming back and forth. */
function Aquarium() {
  const fish = useRef<(Group | null)[]>([]);
  const still = useStill();
  useFrame(({ clock }) => {
    if (still) return;
    const t = clock.elapsedTime;
    fish.current.forEach((f, i) => {
      if (!f) return;
      const speed = 0.25 + (i % 3) * 0.08;
      const k = Math.sin(t * speed + i * 1.7);
      f.position.z = k * 0.85;
      f.position.y = 0.95 + (i % 3) * 0.13 + Math.sin(t * 1.3 + i) * 0.03;
      // face the way it swims
      f.rotation.y = Math.cos(t * speed + i * 1.7) > 0 ? 0 : Math.PI;
    });
  });
  const colors = ["#ff8c42", "#ffd166", "#ef476f", "#4cc9f0", "#f72585", "#06d6a0"];
  return (
    <group userData={DYNAMIC} position={[15.675, 0, 12.0]}>
      <B s={[0.45, 0.7, 2.2]} p={[0, 0.35, 0]} c="#2b2f33" />
      <B s={[0.4, 0.06, 2.12]} p={[0, 0.73, 0]} c="#d6c7a1" />
      {[-0.7, -0.2, 0.45, 0.85].map((z, i) => (
        <mesh key={z} position={[0.02 * i, 0.86, z]}>
          <coneGeometry args={[0.05, 0.24 + (i % 2) * 0.08, 8]} />
          <meshStandardMaterial color={i % 2 ? "#2f8f4e" : "#3fae5f"} />
        </mesh>
      ))}
      {colors.map((c, i) => (
        <group
          key={c}
          ref={(g) => {
            fish.current[i] = g;
          }}
          position={[0.06 * ((i % 3) - 1), 1.0, 0]}
        >
          <mesh scale={[0.6, 0.8, 1.4]}>
            <sphereGeometry args={[0.045, 10, 8]} />
            <meshStandardMaterial color={c} />
          </mesh>
          <mesh position={[0, 0, -0.07]} rotation-x={Math.PI / 2}>
            <coneGeometry args={[0.03, 0.05, 4]} />
            <meshStandardMaterial color={c} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 1.04, 0]}>
        <boxGeometry args={[0.42, 0.62, 2.16]} />
        <meshStandardMaterial color="#7cc7e8" transparent opacity={0.28} depthWrite={false} roughness={0.1} />
      </mesh>
      <B s={[0.46, 0.04, 2.22]} p={[0, 1.37, 0]} c="#111827" />
    </group>
  );
}

/** Reclining nap chair; the sitter faces +z. */
function Recliner({ p, color }: { p: V3; color: string }) {
  return (
    <group position={p}>
      <B s={[0.8, 0.34, 0.7]} p={[0, 0.17, -0.05]} c={color} rough={0.85} />
      <group position={[0, 0.34, -0.36]} rotation-x={-0.4}>
        <B s={[0.8, 0.78, 0.16]} p={[0, 0.38, 0]} c={color} rough={0.85} />
      </group>
      <B s={[0.7, 0.14, 0.42]} p={[0, 0.26, 0.5]} c={color} rough={0.85} />
      {[-0.4, 0.4].map((x) => (
        <B key={x} s={[0.1, 0.18, 0.66]} p={[x, 0.43, -0.05]} c="#2b2f33" />
      ))}
    </group>
  );
}

function NapCorner({ decor }: { decor: FloorDecor }) {
  const glow = decor.phase !== "day";
  return (
    <group>
      {decor.items.aquarium && <Aquarium />}
      <Recliner p={[13.5, 0, 14.6]} color="#5b7c99" />
      <Recliner p={[14.9, 0, 14.6]} color="#9a6b8f" />
      <group position={[14.2, 0, 14.65]}>
        <mesh position={[0, 0.25, 0]}>
          <cylinderGeometry args={[0.16, 0.16, 0.5, 16]} />
          <meshStandardMaterial color="#e5e7eb" />
        </mesh>
        {decor.items.lamps && (
          <group position={[0, 0.5, 0]}>
            <mesh position={[0, 0.12, 0]}>
              <cylinderGeometry args={[0.015, 0.03, 0.24, 8]} />
              <meshStandardMaterial color="#6b7280" />
            </mesh>
            <mesh position={[0, 0.28, 0]}>
              <cylinderGeometry args={[0.07, 0.11, 0.12, 16, 1, true]} />
              <meshStandardMaterial color="#f6ead2" side={DoubleSide} emissive="#ffcf8a" emissiveIntensity={glow ? 0.9 : 0} />
            </mesh>
          </group>
        )}
      </group>
    </group>
  );
}

function BarStool({ p }: { p: V3 }) {
  return (
    <group position={p}>
      <mesh position={[0, 0.34, 0]}>
        <cylinderGeometry args={[0.025, 0.025, 0.66, 8]} />
        <meshStandardMaterial color="#6b7280" metalness={0.6} />
      </mesh>
      <mesh position={[0, 0.68, 0]} castShadow>
        <cylinderGeometry args={[0.17, 0.17, 0.06, 16]} />
        <meshStandardMaterial color="#2fa39b" />
      </mesh>
    </group>
  );
}

function BistroTable({ x }: { x: number }) {
  return (
    <group>
      <group position={[x, 0, 14.5]}>
        <mesh position={[0, 0.75, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.4, 0.4, 0.04, 28]} />
          <meshStandardMaterial color="#f5f5f4" />
        </mesh>
        <mesh position={[0, 0.37, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 0.74, 8]} />
          <meshStandardMaterial color="#2b2f33" />
        </mesh>
        <mesh position={[0, 0.02, 0]}>
          <cylinderGeometry args={[0.22, 0.22, 0.04, 16]} />
          <meshStandardMaterial color="#2b2f33" />
        </mesh>
        <mesh position={[0.08, 0.81, -0.05]}>
          <cylinderGeometry args={[0.04, 0.035, 0.09, 12]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
      </group>
      <WoodChair p={[x - 0.68, 0, 14.5]} r={-Math.PI / 2} />
      <WoodChair p={[x + 0.68, 0, 14.5]} r={Math.PI / 2} />
    </group>
  );
}

const LIGHT_POLES: [number, number][] = [
  [-3.1, 13.55],
  [4.0, 13.55],
  [12.55, 13.55],
  [-3.1, 15.85],
  [4.0, 15.85],
  [12.55, 15.85],
];

/** Festoon lights strung between poles around the café. */
function StringLights({ glow }: { glow: boolean }) {
  const bulbs = useRef<InstancedMesh>(null);
  const points = useMemo(() => {
    const out: V3[] = [];
    for (const z of [13.55, 15.85]) {
      for (const [a, b] of [
        [-3.1, 4.0],
        [4.0, 12.55],
      ]) {
        for (let i = 1; i < 14; i++) {
          const k = i / 14;
          out.push([a + (b - a) * k, 2.3 - Math.sin(k * Math.PI) * 0.35, z]);
        }
      }
    }
    return out;
  }, []);
  useLayoutEffect(() => {
    const m = bulbs.current;
    if (!m) return;
    const o = new Object3D();
    points.forEach((p, i) => {
      o.position.set(...p);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  }, [points]);
  return (
    <group>
      {LIGHT_POLES.map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x, 1.2, z]}>
          <cylinderGeometry args={[0.03, 0.04, 2.4, 8]} />
          <meshStandardMaterial color="#2b2f33" />
        </mesh>
      ))}
      <instancedMesh ref={bulbs} args={[undefined, undefined, points.length]}>
        <sphereGeometry args={[0.05, 10, 8]} />
        <meshBasicMaterial color={glow ? "#ffd58a" : "#fff6e0"} toneMapped={false} />
      </instancedMesh>
    </group>
  );
}

function Cafe({ decor }: { decor: FloorDecor }) {
  const glow = decor.phase !== "day";
  return (
    <group>
      {decor.items.rugs && <Rug x0={1.6} x1={9.2} z0={13.75} z1={15.3} color={decor.accent} />}
      {/* coffee bar */}
      <B s={[3.0, 1.0, 0.6]} p={[-1.1, 0.5, 15.4]} c="#3b2f2a" />
      <B s={[3.1, 0.05, 0.7]} p={[-1.1, 1.025, 15.4]} c="#f5f5f4" rough={0.3} />
      <B s={[0.32, 0.38, 0.3]} p={[-1.9, 1.24, 15.45]} c="#9ca3af" metal={0.6} rough={0.3} />
      <Steam p={[-1.9, 1.48, 15.35]} />
      <mesh position={[-0.3, 1.2, 15.45]}>
        <boxGeometry args={[0.7, 0.3, 0.4]} />
        <meshStandardMaterial color="#e0f2fe" transparent opacity={0.45} />
      </mesh>
      {[-0.5, -0.3, -0.1].map((x, i) => (
        <mesh key={x} position={[x, 1.1, 15.45]}>
          <sphereGeometry args={[0.06, 10, 8]} />
          <meshStandardMaterial color={["#d4a373", "#e9c46a", "#bc6c25"][i]} />
        </mesh>
      ))}
      <BarStool p={[-0.9, 0, 14.75]} />
      <BarStool p={[-0.1, 0, 14.75]} />
      {[2.6, 5.4, 8.2].map((x) => (
        <BistroTable key={x} x={x} />
      ))}
      {decor.items.plants && <Planter p={[10.45, 0, 15.72]} len={2.2} />}
      {decor.items.stringLights && <StringLights glow={glow} />}
    </group>
  );
}

function Hall({ decor, sky }: { decor: FloorDecor; sky: Texture }) {
  const floor = useDisposable(() => hallFloorTexture(decor.floor), `hall-${decor.floor}`);
  const glow = decor.phase !== "day";
  return (
    <group>
      <Floor x0={FLOOR.x0} x1={EAST.x0} z0={WORKSPACE.z0} z1={WORKSPACE.z1} map={floor} />
      <Library decor={decor} sky={sky} />
      <Wellness decor={decor} />
      <PhoneBooth z={11.85} accent={decor.accent} glow={glow} />
      <PhoneBooth z={13.55} accent={decor.accent} glow={glow} />
      <PrintStation />
      <Breakout decor={decor} />
      <PingPongTable />
      <NapCorner decor={decor} />
      <Cafe decor={decor} />
      {decor.items.plants && (
        <group>
          <PalmPlant p={[-3.95, 0, 15.45]} s={1.1} />
          <PalmPlant p={[15.55, 0, 15.45]} />
          <PalmPlant p={[-3.95, 0, 5.75]} s={0.9} />
        </group>
      )}
      {decor.items.art && <Art p={[-7.91, 1.55, 15.0]} r={Math.PI / 2} seed={19} w={0.8} h={0.6} />}
    </group>
  );
}

function neonTexture(text = "GAME ON", glow = "#f0abfc") {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 128;
  const g = c.getContext("2d")!;
  // shrink long names so they still fit the sign
  let size = 84;
  g.font = `800 ${size}px system-ui, "Segoe UI", "Noto Sans Thai", sans-serif`;
  while (size > 30 && g.measureText(text).width > 470) {
    size -= 4;
    g.font = `800 ${size}px system-ui, "Segoe UI", "Noto Sans Thai", sans-serif`;
  }
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.shadowColor = glow;
  g.shadowBlur = 24;
  g.fillStyle = "#fdf4ff";
  g.fillText(text, 256, 68);
  return finish(c, [1, 1]);
}

/** Arcade cabinet whose screen flickers through colours. */
function Arcade({ p, hue }: { p: V3; hue: number }) {
  const screen = useRef<MeshBasicMaterial>(null);
  const still = useStill();
  useFrame(({ clock }) => {
    if (!screen.current || still) return;
    const t = clock.elapsedTime * (currentEventKind() === "arcade" ? 4 : 1.2) + hue;
    screen.current.color.setHSL((hue + Math.sin(t) * 0.08 + 1) % 1, 0.8, 0.45 + Math.sin(t * 3) * 0.1);
  });
  return (
    <group userData={DYNAMIC} position={p}>
      <B s={[0.7, 1.7, 0.7]} p={[0, 0.85, 0]} c="#1e1b4b" />
      <B s={[0.72, 0.08, 0.4]} p={[0, 0.95, 0.3]} c="#312e81" />
      <mesh position={[0, 1.3, 0.355]} rotation-x={-0.15}>
        <planeGeometry args={[0.5, 0.42]} />
        <meshBasicMaterial ref={screen} color="#a855f7" toneMapped={false} />
      </mesh>
      <B s={[0.7, 0.18, 0.72]} p={[0, 1.62, 0]} c="#7c3aed" />
    </group>
  );
}

/** A side-scrolling game for the gaming PCs: sky, hills, platforms, coins and a score. */
function gameTexture(seed: number) {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 192;
  const g = c.getContext("2d")!;
  const rnd = seeded(seed);
  const sky = g.createLinearGradient(0, 0, 0, 192);
  sky.addColorStop(0, seed % 2 ? "#1e1b4b" : "#0ea5e9");
  sky.addColorStop(1, seed % 2 ? "#7c3aed" : "#bae6fd");
  g.fillStyle = sky;
  g.fillRect(0, 0, 512, 192);
  g.fillStyle = seed % 2 ? "#312e81" : "#22c55e";
  for (let x = -40; x < 560; x += 120) {
    g.beginPath();
    g.ellipse(x + rnd() * 40, 175, 80, 55 + rnd() * 25, 0, Math.PI, 0);
    g.fill();
  }
  g.fillStyle = "#78350f";
  g.fillRect(0, 168, 512, 24);
  for (let i = 0; i < 6; i++) {
    const x = 20 + i * 85 + rnd() * 20;
    const y = 70 + rnd() * 60;
    g.fillStyle = "#f59e0b";
    g.fillRect(x, y, 50, 10);
    g.fillStyle = "#fde047";
    g.beginPath();
    g.arc(x + 25, y - 14, 6, 0, Math.PI * 2);
    g.fill();
  }
  // the hero and a monster
  g.fillStyle = "#ef4444";
  g.fillRect(150, 140, 16, 28);
  g.fillStyle = "#a855f7";
  g.beginPath();
  g.arc(330, 156, 12, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#ffffff";
  g.font = "bold 18px monospace";
  g.fillText("SCORE 0" + Math.floor(rnd() * 900 + 100), 12, 24);
  return finish(c, [1, 1]);
}

/**
 * A high-end custom gaming setup: desk with RGB underglow, a big screen (the game scrolls while
 * someone plays), a glass-sided RGB tower, RGB keyboard and a racing chair.
 */
function GamingRig({ x, spot, seed, accent }: { x: number; spot: string; seed: number; accent: string }) {
  const tex = useDisposable(() => gameTexture(seed), `game-${seed}`);
  const screen = useRef<MeshBasicMaterial>(null);
  const still = useStill();
  const m = rgbMaterials();
  const z = FLOOR.z0 + 0.4;
  useFrame((_, dt) => {
    const mat = screen.current;
    if (!mat) return;
    const playing = isPresent(spot);
    // the level scrolls past while someone plays
    if (playing && !still && mat.map) mat.map.offset.x = (mat.map.offset.x + dt * 0.09) % 1;
    mat.color.set(playing ? "#ffffff" : "#4b5263");
  });
  return (
    <group>
      {/* desk and racing chair (static) */}
      <B s={[1.1, 0.05, 0.6]} p={[x, 0.75, z]} c="#111827" rough={0.3} />
      {[-0.5, 0.5].map((dx) => (
        <B key={dx} s={[0.05, 0.73, 0.5]} p={[x + dx, 0.365, z]} c="#1f2937" />
      ))}
      <B s={[0.9, 0.003, 0.32]} p={[x - 0.05, 0.777, z + 0.12]} c="#0b0d12" rough={1} />
      <group position={[x, 0, -4.85]}>
        <mesh position={[0, 0.04, 0]}>
          <cylinderGeometry args={[0.28, 0.28, 0.04, 5]} />
          <meshStandardMaterial color="#111827" />
        </mesh>
        <B s={[0.06, 0.38, 0.06]} p={[0, 0.25, 0]} c="#374151" metal={0.6} />
        <B s={[0.5, 0.09, 0.5]} p={[0, 0.48, 0]} c="#111827" />
        <B s={[0.5, 0.8, 0.09]} p={[0, 0.92, 0.23]} c="#111827" />
        <B s={[0.14, 0.78, 0.095]} p={[0, 0.92, 0.232]} c={accent} />
        <B s={[0.32, 0.16, 0.1]} p={[0, 1.38, 0.235]} c="#111827" />
        {[-0.27, 0.27].map((dx) => (
          <B key={dx} s={[0.05, 0.05, 0.36]} p={[dx, 0.68, 0.02]} c="#1f2937" />
        ))}
      </group>
      {/* the parts that glow and move */}
      <group userData={DYNAMIC}>
        <mesh position={[x, 0.735, z + 0.302]} material={m.strip}>
          <boxGeometry args={[1.04, 0.012, 0.004]} />
        </mesh>
        <B s={[0.82, 0.4, 0.035]} p={[x - 0.1, 1.17, z - 0.17]} c="#0b0d12" />
        <mesh position={[x - 0.1, 1.17, z - 0.151]}>
          <planeGeometry args={[0.78, 0.36]} />
          <meshBasicMaterial ref={screen} map={tex} toneMapped={false} />
        </mesh>
        <B s={[0.05, 0.2, 0.05]} p={[x - 0.1, 0.87, z - 0.19]} c="#1f2937" />
        <B s={[0.24, 0.015, 0.16]} p={[x - 0.1, 0.78, z - 0.19]} c="#1f2937" />
        <PcTower p={[x + 0.4, 0.775, z]} on s={1.4} />
        <B s={[0.42, 0.02, 0.13]} p={[x - 0.12, 0.79, z + 0.12]} c="#0b0d12" />
        <mesh position={[x - 0.12, 0.8005, z + 0.12]} rotation-x={-Math.PI / 2} material={m.fans}>
          <planeGeometry args={[0.38, 0.1]} />
        </mesh>
        <B s={[0.06, 0.025, 0.1]} p={[x + 0.18, 0.79, z + 0.12]} c="#111827" />
      </group>
    </group>
  );
}

/** Biscuit's things: a kennel and mat in the garden, a water bowl in the kitchen, and his ball. */
function DogThings() {
  return (
    <group>
      <group position={[16.55, 0, 10.55]}>
        <B s={[0.62, 0.42, 0.58]} p={[0, 0.21, 0]} c="#b45309" />
        <mesh position={[0, 0.52, 0]} rotation-z={Math.PI / 4} scale={[1, 1, 1.05]}>
          <boxGeometry args={[0.46, 0.46, 0.6]} />
          <meshStandardMaterial color="#7c2d12" />
        </mesh>
        <mesh position={[0, 0.2, 0.295]}>
          <circleGeometry args={[0.14, 16, 0, Math.PI]} />
          <meshStandardMaterial color="#1c1917" />
        </mesh>
      </group>
      <mesh position={[16.6, 0.02, 11.3]}>
        <cylinderGeometry args={[0.36, 0.38, 0.04, 20]} />
        <meshStandardMaterial color="#fde68a" roughness={1} />
      </mesh>
      <mesh position={[2.4, 0.04, -3.15]}>
        <cylinderGeometry args={[0.12, 0.1, 0.08, 16]} />
        <meshStandardMaterial color="#3b82f6" />
      </mesh>
      <mesh position={[18.9, 0.07, 12.9]}>
        <sphereGeometry args={[0.07, 12, 10]} />
        <meshStandardMaterial color="#a3e635" />
      </mesh>
    </group>
  );
}

function GameRoom() {
  const tiles = useDisposable(() => tileTexture("#2a2340", "#3b3157", [4, 5]), "game-floor");
  const neon = useDisposable(neonTexture, "neon");
  const { x0, x1 } = GAME;
  return (
    <group>
      <Floor x0={x0} x1={x1} z0={FLOOR.z0} z1={CORRIDOR.z0} map={tiles} />
      <Floor x0={8.6} x1={11.6} z0={-4.3} z1={-2.1} color="#4c1d95" y={0.006} />
      <mesh position={[(x0 + x1) / 2, 1.95, FLOOR.z0 + 0.09]}>
        <planeGeometry args={[2.2, 0.55]} />
        <meshBasicMaterial map={neon} transparent toneMapped={false} />
      </mesh>
      <GamingRig x={8.75} spot="rig-1" seed={3} accent="#dc2626" />
      <GamingRig x={9.95} spot="rig-2" seed={8} accent="#2563eb" />
      <Arcade p={[10.95, 0, -5.55]} hue={0.78} />
      {/* foosball table */}
      <group position={[10.1, 0, -3.2]}>
        <B s={[1.3, 0.25, 0.75]} p={[0, 0.72, 0]} c="#0f766e" />
        <B s={[1.2, 0.02, 0.65]} p={[0, 0.85, 0]} c="#22c55e" />
        {[-0.45, -0.15, 0.15, 0.45].map((x) => (
          <mesh key={x} position={[x, 0.92, 0]} rotation-x={Math.PI / 2}>
            <cylinderGeometry args={[0.015, 0.015, 1.1, 6]} />
            <meshStandardMaterial color="#d1d5db" metalness={0.7} />
          </mesh>
        ))}
        {[
          [-0.55, -0.3],
          [0.55, -0.3],
          [-0.55, 0.3],
          [0.55, 0.3],
        ].map(([x, z]) => (
          <B key={`${x}${z}`} s={[0.08, 0.6, 0.08]} p={[x, 0.3, z]} c="#134e4a" />
        ))}
      </group>
      {/* beanbag */}
      <mesh position={[11.5, 0.22, -1.4]} scale={[1, 0.6, 1]} castShadow>
        <sphereGeometry args={[0.42, 20, 16]} />
        <meshStandardMaterial color="#ec4899" roughness={0.9} />
      </mesh>
      <PalmPlant p={[11.75, 0, -5.5]} s={0.9} />
    </group>
  );
}

/** Front of a rack: stacked 1U/2U servers with drive bays and vents. */
function serverFaceTexture() {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 384;
  const g = c.getContext("2d")!;
  g.fillStyle = "#07080a";
  g.fillRect(0, 0, 128, 384);
  let y = 6;
  let i = 0;
  while (y < 376) {
    const h = i % 5 === 2 ? 36 : 18;
    g.fillStyle = i % 7 === 4 ? "#0b0d10" : "#23272e";
    g.fillRect(4, y, 120, h - 2);
    g.fillStyle = "#3a4049";
    for (let b = 0; b < (h > 20 ? 8 : 4); b++) g.fillRect(8 + b * 13, y + 3, 10, h - 8);
    g.fillStyle = "#14171c";
    for (let v = 0; v < 6; v++) g.fillRect(70 + v * 6, y + 4, 3, h - 10);
    y += h;
    i++;
  }
  return finish(c, [1, 1]);
}

/** Raised-floor tiles, every other one perforated for the cold air. */
function perforatedTexture(repeat: [number, number]) {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const g = c.getContext("2d")!;
  g.fillStyle = "#c9d0d8";
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = "#9aa4af";
  for (let yy = 8; yy < 64; yy += 7) for (let xx = 8; xx < 64; xx += 7) g.fillRect(xx, yy, 3, 3);
  for (let yy = 72; yy < 128; yy += 7) for (let xx = 72; xx < 128; xx += 7) g.fillRect(xx, yy, 3, 3);
  g.fillStyle = "#8a939d";
  g.fillRect(0, 63, 128, 2);
  g.fillRect(63, 0, 2, 128);
  return finish(c, repeat);
}

const LEDS_PER_RACK = 18;

/** A 42U rack (front +z before rotation) with server faces and blinking status LEDs; red during a server alarm. */
function ServerRack({ p, r = 0, seed }: { p: V3; r?: number; seed: number }) {
  const face = useDisposable(serverFaceTexture, "server-face");
  const leds = useRef<InstancedMesh>(null);
  const still = useStill();
  const [color] = useState(() => new Color());
  useLayoutEffect(() => {
    const mesh = leds.current;
    if (!mesh) return;
    const o = new Object3D();
    for (let i = 0; i < LEDS_PER_RACK; i++) {
      o.position.set(i % 2 ? 0.255 : 0.225, 0.14 + Math.floor(i / 2) * 0.2 + (i % 2) * 0.05, 0.456);
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
      mesh.setColorAt(i, color.set("#34d399"));
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, [color]);
  useFrame(({ clock }) => {
    const mesh = leds.current;
    if (!mesh?.instanceColor) return;
    const alarm = currentEventKind() === "server";
    const t = clock.elapsedTime;
    for (let i = 0; i < LEDS_PER_RACK; i++) {
      const on = still || Math.sin(t * (alarm ? 12 : 3 + (i % 5)) + i * 1.7 + seed * 3) > (alarm ? -0.2 : 0.1);
      color.set(alarm ? (on ? "#ef4444" : "#450a0a") : on ? (i % 5 === 0 ? "#f59e0b" : i % 3 ? "#34d399" : "#60a5fa") : "#052e16");
      mesh.setColorAt(i, color);
    }
    mesh.instanceColor.needsUpdate = true;
  });
  return (
    <group position={p} rotation-y={r}>
      <B s={[0.66, 2.0, 0.9]} p={[0, 1.0, 0]} c="#111317" rough={0.45} metal={0.35} />
      <B s={[0.68, 0.05, 0.92]} p={[0, 2.02, 0]} c="#1f2329" />
      <mesh position={[0, 1.0, 0.452]}>
        <planeGeometry args={[0.6, 1.88]} />
        <meshStandardMaterial map={face} roughness={0.5} metalness={0.2} />
      </mesh>
      <instancedMesh ref={leds} args={[undefined, undefined, LEDS_PER_RACK]} userData={DYNAMIC}>
        <planeGeometry args={[0.04, 0.02]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
    </group>
  );
}

/** Yellow ladder cable tray along x (or z with `alongZ`) just above the racks. */
function CableTray({ a, b, at, alongZ = false }: { a: number; b: number; at: number; alongZ?: boolean }) {
  const len = b - a;
  const mid = (a + b) / 2;
  const rungs = Math.round(len / 0.3);
  const P = (u: number, w: number, y: number): V3 => (alongZ ? [at + w, y, u] : [u, y, at + w]);
  const S = (l: number, w: number, h: number): V3 => (alongZ ? [w, h, l] : [l, h, w]);
  return (
    <group>
      {[-0.18, 0.18].map((w) => (
        <B key={w} s={S(len, 0.03, 0.05)} p={P(mid, w, 2.2)} c="#eab308" metal={0.3} />
      ))}
      {Array.from({ length: rungs + 1 }, (_, i) => (
        <B key={i} s={S(0.03, 0.36, 0.02)} p={P(a + (i * len) / rungs, 0, 2.19)} c="#ca8a04" />
      ))}
      {/* bundles of network cable in the tray */}
      <B s={S(len, 0.12, 0.05)} p={P(mid, -0.06, 2.22)} c="#2563eb" rough={0.9} />
      <B s={S(len, 0.1, 0.05)} p={P(mid, 0.07, 2.22)} c="#f59e0b" rough={0.9} />
    </group>
  );
}

function ServerRoom() {
  const tiles = useDisposable(() => perforatedTexture([6, 9]), "server-floor-perf");
  const { x0, x1 } = SERVER;
  const north = [12.75, 13.45, 14.15, 14.85, 15.55];
  const west = [-4.2, -3.5, -2.8];
  return (
    <group>
      <Floor x0={x0} x1={x1} z0={FLOOR.z0} z1={CORRIDOR.z0} map={tiles} />
      {/* cold aisle: a strip of blue light on the floor in front of the racks */}
      <Floor x0={12.4} x1={15.9} z0={-4.95} z1={-4.85} color="#60a5fa" y={0.006} />
      {north.map((x, i) => (
        <ServerRack key={x} p={[x, 0, -5.45]} seed={i} />
      ))}
      {west.map((z, i) => (
        <ServerRack key={z} p={[12.65, 0, z]} r={Math.PI / 2} seed={i + 5} />
      ))}
      <CableTray a={12.42} b={15.88} at={-5.45} />
      <CableTray a={-4.6} b={-2.45} at={12.65} alongZ />
      {/* cables dropping into each rack */}
      {north.map((x) => (
        <mesh key={x} position={[x - 0.15, 2.1, -5.55]}>
          <cylinderGeometry args={[0.025, 0.025, 0.2, 6]} />
          <meshStandardMaterial color="#2563eb" />
        </mesh>
      ))}
      {/* precision cooling unit (CRAC) */}
      <B s={[0.6, 1.9, 1.0]} p={[15.6, 0.95, -2.6]} c="#e5e7eb" rough={0.5} />
      {Array.from({ length: 8 }, (_, i) => (
        <B key={i} s={[0.02, 0.04, 0.8]} p={[15.29, 0.4 + i * 0.14, -2.6]} c="#9ca3af" />
      ))}
      <mesh position={[15.288, 1.65, -2.85]} rotation-y={-Math.PI / 2}>
        <planeGeometry args={[0.22, 0.14]} />
        <meshBasicMaterial color="#22d3ee" toneMapped={false} />
      </mesh>
      {/* UPS battery cabinet */}
      <B s={[0.5, 1.25, 0.6]} p={[15.65, 0.625, -3.75]} c="#1f2937" rough={0.5} />
      <mesh position={[15.398, 1.0, -3.75]} rotation-y={-Math.PI / 2}>
        <planeGeometry args={[0.16, 0.1]} />
        <meshBasicMaterial color="#84cc16" toneMapped={false} />
      </mesh>
      {/* fire suppression cylinders */}
      {[-0.75, -1.05].map((z) => (
        <group key={z} position={[15.72, 0, z]}>
          <mesh position={[0, 0.55, 0]} castShadow>
            <cylinderGeometry args={[0.12, 0.12, 1.1, 16]} />
            <meshStandardMaterial color="#dc2626" roughness={0.4} />
          </mesh>
          <mesh position={[0, 1.15, 0]}>
            <cylinderGeometry args={[0.04, 0.06, 0.1, 10]} />
            <meshStandardMaterial color="#9ca3af" metalness={0.7} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ---------- East wing: lobby, town hall and garden ----------

function grassTexture(repeat: [number, number]) {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const g = c.getContext("2d")!;
  const rnd = seeded(55);
  g.fillStyle = "#7cc06a";
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2400; i++) {
    g.fillStyle = rnd() > 0.5 ? "rgba(40,110,40,0.22)" : "rgba(210,255,170,0.18)";
    g.fillRect(rnd() * 256, rnd() * 256, 2, 4);
  }
  return finish(c, repeat);
}

/** Company name on the lobby wall. */
/** The café's neon name over the back bar. */
function CafeSign({ text }: { text: string }) {
  const name = `${(text.trim() || "AGENT HQ").toUpperCase()} CAFÉ`;
  const tex = useDisposable(() => neonTexture(name, "#fbbf24"), `cafe:${name}`);
  return (
    <group position={[19.3, 1.98, FLOOR.z0 + 0.1]}>
      <B s={[2.5, 0.62, 0.05]} p={[0, 0, 0]} c="#1c1410" />
      <mesh position={[0, 0, 0.03]}>
        <planeGeometry args={[2.4, 0.56]} />
        <meshBasicMaterial map={tex} transparent toneMapped={false} />
      </mesh>
    </group>
  );
}

/** Chalkboard menu. */
function menuTexture(side: number) {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 224;
  const g = c.getContext("2d")!;
  g.fillStyle = "#1f2d26";
  g.fillRect(0, 0, 256, 224);
  g.strokeStyle = "#a16207";
  g.lineWidth = 10;
  g.strokeRect(5, 5, 246, 214);
  g.fillStyle = "#fef3c7";
  g.font = "bold 30px Georgia, serif";
  g.textAlign = "center";
  g.fillText(side ? "PASTRY" : "COFFEE", 128, 46);
  g.font = "20px Georgia, serif";
  const items = side
    ? [["Croissant", "55"], ["Muffin", "50"], ["Donut", "45"], ["Banana bread", "60"], ["Matcha", "70"]]
    : [["Espresso", "55"], ["Latte", "65"], ["Mocha", "70"], ["Cold brew", "75"], ["Flat white", "65"]];
  items.forEach(([name, price], i) => {
    g.textAlign = "left";
    g.fillText(name, 24, 86 + i * 28);
    g.textAlign = "right";
    g.fillText(price, 232, 86 + i * 28);
  });
  return finish(c, [1, 1]);
}

function MenuBoard({ x, side }: { x: number; side: number }) {
  const tex = useDisposable(() => menuTexture(side), `menu${side}`);
  return (
    <group position={[x, 1.85, FLOOR.z0 + 0.1]}>
      <mesh>
        <planeGeometry args={[0.92, 0.8]} />
        <meshStandardMaterial map={tex} roughness={0.95} />
      </mesh>
    </group>
  );
}

/** Round café table with a chair on each side (the seats face the table). */
function CafeTable({ x, z }: { x: number; z: number }) {
  return (
    <group>
      <group position={[x, 0, z]}>
        <mesh position={[0, 0.75, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.4, 0.4, 0.04, 28]} />
          <meshStandardMaterial color="#f5f5f4" roughness={0.3} />
        </mesh>
        <mesh position={[0, 0.37, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 0.74, 8]} />
          <meshStandardMaterial color="#2b2f33" />
        </mesh>
        <mesh position={[0, 0.02, 0]}>
          <cylinderGeometry args={[0.22, 0.22, 0.04, 16]} />
          <meshStandardMaterial color="#2b2f33" />
        </mesh>
        <mesh position={[0.05, 0.79, 0.12]}>
          <cylinderGeometry args={[0.035, 0.035, 0.06, 10]} />
          <meshStandardMaterial color="#fde68a" />
        </mesh>
      </group>
      <WoodChair p={[x - 0.65, 0, z]} r={-Math.PI / 2} />
      <WoodChair p={[x + 0.65, 0, z]} r={Math.PI / 2} />
    </group>
  );
}

/** Pastries in the glass case: croissants, muffins and donuts. */
function Pastries() {
  const colors = ["#d97706", "#92400e", "#f9a8d4", "#fbbf24"];
  return (
    <group>
      {Array.from({ length: 8 }, (_, i) => {
        const x = 17.6 + (i % 4) * 0.26;
        const y = i < 4 ? 1.12 : 1.31;
        const kind = (i + Math.floor(i / 4)) % 3;
        return kind === 0 ? (
          <mesh key={i} position={[x, y, -4.5]} rotation-x={Math.PI / 2}>
            <torusGeometry args={[0.06, 0.03, 8, 12, Math.PI]} />
            <meshStandardMaterial color={colors[0]} />
          </mesh>
        ) : kind === 1 ? (
          <mesh key={i} position={[x, y + 0.02, -4.5]}>
            <sphereGeometry args={[0.06, 12, 8]} />
            <meshStandardMaterial color={colors[1]} />
          </mesh>
        ) : (
          <mesh key={i} position={[x, y, -4.5]} rotation-x={Math.PI / 2}>
            <torusGeometry args={[0.055, 0.025, 8, 14]} />
            <meshStandardMaterial color={colors[2 + (i % 2)]} />
          </mesh>
        );
      })}
    </group>
  );
}

/** The lobby café: counter with a pastry case, back bar with the espresso machine, menus and tables. */
function LobbyCafe({ decor }: { decor: FloorDecor }) {
  const planks = useDisposable(() => plankTexture(28, 38, 42, [6, 4], 21), "cafe-floor");
  const glow = decor.phase !== "day";
  return (
    <group>
      <Floor x0={EAST.x0} x1={22.4} z0={FLOOR.z0} z1={-1.4} map={planks} y={0.004} />
      <CafeSign text={decor.sign} />
      <MenuBoard x={17.4} side={0} />
      <MenuBoard x={21.2} side={1} />
      {/* back bar */}
      <B s={[4.7, 0.95, 0.6]} p={[19.3, 0.475, -5.65]} c="#3b2a20" />
      <B s={[4.75, 0.04, 0.62]} p={[19.3, 0.97, -5.65]} c="#d6d3cf" rough={0.3} />
      {/* espresso machine */}
      <group position={[19.3, 0.99, -5.62]}>
        <B s={[0.78, 0.42, 0.42]} p={[0, 0.21, 0]} c="#c0c4c9" metal={0.7} rough={0.25} />
        <B s={[0.78, 0.03, 0.42]} p={[0, 0.43, 0]} c="#8b9096" metal={0.6} />
        {[-0.2, 0.2].map((x) => (
          <group key={x}>
            <mesh position={[x, 0.16, 0.24]}>
              <cylinderGeometry args={[0.05, 0.05, 0.06, 14]} />
              <meshStandardMaterial color="#6b7280" metalness={0.8} roughness={0.2} />
            </mesh>
            <B s={[0.04, 0.03, 0.16]} p={[x, 0.13, 0.33]} c="#111827" />
          </group>
        ))}
        <B s={[0.7, 0.03, 0.14]} p={[0, 0.015, 0.25]} c="#4b5563" metal={0.6} />
        {[-0.24, -0.08, 0.08].map((x) => (
          <mesh key={x} position={[x, 0.48, 0]}>
            <cylinderGeometry args={[0.04, 0.035, 0.07, 10]} />
            <meshStandardMaterial color="#ffffff" />
          </mesh>
        ))}
      </group>
      <Steam p={[19.1, 1.46, -5.42]} />
      {/* grinder */}
      <group position={[18.45, 0.99, -5.65]}>
        <B s={[0.2, 0.3, 0.24]} p={[0, 0.15, 0]} c="#111827" />
        <mesh position={[0, 0.39, 0]}>
          <cylinderGeometry args={[0.1, 0.06, 0.18, 14]} />
          <meshStandardMaterial color="#5b3a22" />
        </mesh>
      </group>
      {/* syrups */}
      {["#b91c1c", "#d97706", "#65a30d", "#7c3aed", "#0e7490"].map((c, i) => (
        <mesh key={c} position={[20.45 + i * 0.16, 1.11, -5.7]}>
          <cylinderGeometry args={[0.04, 0.04, 0.24, 10]} />
          <meshStandardMaterial color={c} roughness={0.2} />
        </mesh>
      ))}
      {/* counter: wood slats under a white top */}
      <B s={[4.7, 1.0, 0.7]} p={[19.3, 0.5, -4.5]} c="#8a5a3a" />
      {Array.from({ length: 16 }, (_, i) => (
        <B key={i} s={[0.06, 0.92, 0.02]} p={[17.1 + i * 0.29, 0.48, -4.145]} c="#6f4529" />
      ))}
      <B s={[4.8, 0.05, 0.8]} p={[19.3, 1.025, -4.5]} c="#f5f5f4" rough={0.3} />
      {/* pastry case */}
      <B s={[1.12, 0.02, 0.58]} p={[18.0, 1.22, -4.5]} c="#e5e7eb" />
      <Pastries />
      <mesh position={[18.0, 1.26, -4.5]}>
        <boxGeometry args={[1.14, 0.42, 0.6]} />
        <meshStandardMaterial color="#e0f2fe" transparent opacity={0.28} depthWrite={false} roughness={0.05} />
      </mesh>
      {/* till and pickup cups */}
      <group position={[20.4, 1.05, -4.62]} rotation-x={-0.35}>
        <B s={[0.3, 0.2, 0.03]} p={[0, 0.14, 0]} c="#111827" />
        <mesh position={[0, 0.14, 0.016]}>
          <planeGeometry args={[0.26, 0.16]} />
          <meshBasicMaterial color="#34d399" toneMapped={false} />
        </mesh>
      </group>
      {[21.15, 21.35, 21.55].map((x) => (
        <group key={x} position={[x, 1.05, -4.35]}>
          <mesh position={[0, 0.06, 0]}>
            <cylinderGeometry args={[0.045, 0.035, 0.12, 12]} />
            <meshStandardMaterial color="#ffffff" />
          </mesh>
          <mesh position={[0, 0.125, 0]}>
            <cylinderGeometry args={[0.048, 0.048, 0.015, 12]} />
            <meshStandardMaterial color="#5b3a22" />
          </mesh>
        </group>
      ))}
      {/* pendant lights over the counter */}
      {[18.2, 19.3, 20.4].map((x) => (
        <group key={x} position={[x, 0, -4.5]}>
          <mesh position={[0, 2.3, 0]}>
            <cylinderGeometry args={[0.006, 0.006, 0.3, 4]} />
            <meshStandardMaterial color="#111827" />
          </mesh>
          <mesh position={[0, 2.1, 0]}>
            <coneGeometry args={[0.14, 0.14, 16, 1, true]} />
            <meshStandardMaterial color="#1f2937" side={DoubleSide} />
          </mesh>
          <Bulb p={[0, 2.03, 0]} r={0.05} on={glow} />
        </group>
      ))}
      <CafeTable x={17.4} z={-2.3} />
      <CafeTable x={19.4} z={-2.3} />
      <PalmPlant p={[22.2, 0, -5.4]} />
    </group>
  );
}

/** Lift doors on the lobby's back wall (the building's main lifts). */
function LobbyLift({ x }: { x: number }) {
  return (
    <group position={[x, 0, FLOOR.z0 + 0.09]}>
      <B s={[1.2, 2.3, 0.06]} p={[0, 1.15, 0]} c="#9ca3af" metal={0.5} rough={0.35} />
      <B s={[0.5, 2.05, 0.03]} p={[-0.26, 1.03, 0.04]} c="#d1d5db" metal={0.6} rough={0.25} />
      <B s={[0.5, 2.05, 0.03]} p={[0.26, 1.03, 0.04]} c="#d1d5db" metal={0.6} rough={0.25} />
      <mesh position={[0, 2.2, 0.05]}>
        <circleGeometry args={[0.05, 3]} />
        <meshBasicMaterial color="#34d399" toneMapped={false} />
      </mesh>
    </group>
  );
}

function Lobby({ decor }: { decor: FloorDecor }) {
  const marble = useDisposable(() => tileTexture("#f3f1ec", "#e3dfd7", [5, 3.6]), "lobby-floor");
  const { x0, lobbyZ } = EAST;
  return (
    <group>
      <Floor x0={x0} x1={FLOOR.x1} z0={FLOOR.z0} z1={lobbyZ} map={marble} />
      {decor.items.rugs && <Rug x0={22.9} x1={25.6} z0={-3.8} z1={-1.2} color={decor.accent} />}
      <LobbyCafe decor={decor} />
      <LobbyLift x={23.2} />
      <LobbyLift x={24.8} />
      {/* café lounge: coffee table and sofa */}
      <group position={[23.6, 0, -2.5]}>
        <B s={[0.6, 0.04, 0.6]} p={[0, 0.42, 0]} c="#c08850" />
        <B s={[0.08, 0.4, 0.08]} p={[0, 0.2, 0]} c="#2b2f33" />
        <B s={[0.22, 0.02, 0.3]} p={[-0.1, 0.45, 0.05]} c="#e84393" r={0.3} />
        <B s={[0.22, 0.02, 0.3]} p={[0.1, 0.47, -0.05]} c="#2e86de" r={-0.2} />
      </group>
      <Sofa p={[24.8, 0, -2.5]} r={-Math.PI / 2} color="#cbd5e1" />
      <PalmPlant p={[25.3, 0, -5.3]} s={1.1} />
      {decor.items.plants && <PalmPlant p={[25.3, 0, 0.6]} />}
      {/* glass entrance doors in the east wall */}
      <group position={[FLOOR.x1, 0, -2.6]}>
        {[-1.0, 1.0].map((z) => (
          <B key={z} s={[0.1, 2.3, 0.1]} p={[0, 1.15, z]} c="#5f6b70" />
        ))}
        <B s={[0.1, 0.12, 2.1]} p={[0, 2.3, 0]} c="#5f6b70" />
        <mesh position={[0, 1.1, 0]}>
          <boxGeometry args={[0.03, 2.1, 1.9]} />
          <meshStandardMaterial color="#bfe3f0" transparent opacity={0.25} depthWrite={false} roughness={0.1} />
        </mesh>
      </group>
      {/* wall to the server room, low wall with a door into the town hall */}
      {/* glass wall to the server room, so the racks stay visible */}
      <group position={[x0, 0, (FLOOR.z0 + CORRIDOR.z0) / 2]} rotation-y={-Math.PI / 2}>
        <GlassWall x0={-(CORRIDOR.z0 - FLOOR.z0) / 2} x1={(CORRIDOR.z0 - FLOOR.z0) / 2} z={0} />
      </group>
      <Wall a={[x0, lobbyZ]} b={[17.0, lobbyZ]} h={1.0} />
      <Wall a={[18.0, lobbyZ]} b={[FLOOR.x1, lobbyZ]} h={1.0} />
      {[17.0, 18.0].map((x) => (
        <B key={x} s={[0.08, 2.1, 0.12]} p={[x, 1.05, lobbyZ]} c="#7a2f3b" />
      ))}
      <B s={[1.08, 0.12, 0.12]} p={[17.5, 2.1, lobbyZ]} c="#7a2f3b" />
    </group>
  );
}

function TownHall() {
  const carpet = useDisposable(() => carpetTexture("#7a2f3b", [5, 3.8]), "townhall-floor");
  const { x0, lobbyZ, gardenZ } = EAST;
  return (
    <group>
      <Floor x0={x0} x1={FLOOR.x1} z0={lobbyZ} z1={gardenZ} map={carpet} />
      {/* stage, screen frame (the slides are drawn by the scene), podium and speakers */}
      <B s={[4.8, 0.25, 1.3]} p={[21, 0.125, 1.95]} c="#3a2a2a" />
      <B s={[4.8, 0.03, 0.06]} p={[21, 0.255, 2.58]} c="#f2c14e" />
      {[18.85, 23.15].map((x) => (
        <B key={x} s={[0.08, 2.4, 0.08]} p={[x, 1.45, 1.36]} c="#2b2f33" />
      ))}
      <B s={[4.3, 1.75, 0.05]} p={[21, 1.75, 1.38]} c="#111827" />
      <group position={[19.4, 0.25, 2.25]}>
        <B s={[0.5, 1.0, 0.4]} p={[0, 0.5, 0]} c="#4a3b33" />
        <mesh position={[0.1, 1.12, 0.05]} rotation-x={-0.5}>
          <cylinderGeometry args={[0.012, 0.012, 0.3, 6]} />
          <meshStandardMaterial color="#374151" />
        </mesh>
      </group>
      {[18.75, 23.25].map((x) => (
        <B key={x} s={[0.35, 0.6, 0.3]} p={[x, 0.55, 2.3]} c="#1f2937" />
      ))}
      {[4.3, 5.7, 7.1].flatMap((z) => [18.6, 19.8, 21.0, 22.2, 23.4].map((x) => <WoodChair key={`${x},${z}`} p={[x, 0, z]} />))}
      {/* low wall to the open hall */}
      <Wall a={[x0, CORRIDOR.z1]} b={[x0, gardenZ]} h={1.0} />
    </group>
  );
}

function Tree({ p, s = 1 }: { p: V3; s?: number }) {
  return (
    <group position={p} scale={s}>
      <mesh position={[0, 0.6, 0]} castShadow>
        <cylinderGeometry args={[0.1, 0.15, 1.2, 10]} />
        <meshStandardMaterial color="#7c5a3a" />
      </mesh>
      {[
        [0, 1.55, 0, 0.62],
        [0.32, 1.35, 0.15, 0.45],
        [-0.3, 1.4, -0.12, 0.48],
      ].map(([x, y, z, r]) => (
        <mesh key={`${x}${z}`} position={[x, y, z]} castShadow>
          <sphereGeometry args={[r, 14, 12]} />
          <meshStandardMaterial color={x ? "#3f9e5a" : "#4fb86a"} roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

function Hedge({ a, b }: { a: [number, number]; b: [number, number] }) {
  const along = a[1] === b[1];
  const len = along ? b[0] - a[0] : b[1] - a[1];
  return (
    <B
      s={along ? [len, 0.65, 0.4] : [0.36, 0.6, len]}
      p={[(a[0] + b[0]) / 2, 0.32, (a[1] + b[1]) / 2]}
      c="#3f8f4e"
      rough={1}
    />
  );
}

/** Koi pond with lily pads, a little fountain and fish swimming round. */
function Pond() {
  const fish = useRef<(Group | null)[]>([]);
  const jet = useRef<Mesh>(null);
  const still = useStill();
  useFrame(({ clock }) => {
    if (still) return;
    const t = clock.elapsedTime;
    fish.current.forEach((f, i) => {
      if (!f) return;
      const a = t * (0.35 + i * 0.1) + i * 2.1;
      f.position.set(Math.cos(a) * (1.0 + i * 0.15), 0.06, Math.sin(a) * (0.6 + i * 0.1));
      f.rotation.y = -a;
    });
    if (jet.current) jet.current.scale.y = 1 + Math.sin(t * 6) * 0.15;
  });
  return (
    <group userData={DYNAMIC} position={[22.8, 0, 11.4]}>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, 0]} scale={[1.85, 1.25, 1]}>
        <circleGeometry args={[1, 40]} />
        <meshStandardMaterial color="#9a8f80" roughness={1} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.03, 0]} scale={[1.65, 1.08, 1]}>
        <circleGeometry args={[1, 40]} />
        <meshStandardMaterial color="#4aa3c8" roughness={0.15} metalness={0.2} />
      </mesh>
      {[
        [-0.8, 0.3],
        [0.9, -0.4],
        [0.4, 0.55],
      ].map(([x, z]) => (
        <mesh key={`${x}${z}`} rotation-x={-Math.PI / 2} position={[x, 0.035, z]}>
          <circleGeometry args={[0.16, 14, 0.4, Math.PI * 1.8]} />
          <meshStandardMaterial color="#5aa55a" />
        </mesh>
      ))}
      {["#ff8c42", "#f8fafc", "#ef476f"].map((c, i) => (
        <group
          key={c}
          ref={(g) => {
            fish.current[i] = g;
          }}
        >
          <mesh scale={[0.7, 0.5, 1.6]}>
            <sphereGeometry args={[0.06, 10, 8]} />
            <meshStandardMaterial color={c} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 0.12, 0]}>
        <cylinderGeometry args={[0.16, 0.2, 0.2, 14]} />
        <meshStandardMaterial color="#9ca3af" roughness={0.9} />
      </mesh>
      <mesh ref={jet} position={[0, 0.35, 0]}>
        <coneGeometry args={[0.05, 0.3, 10]} />
        <meshStandardMaterial color="#dbeafe" transparent opacity={0.6} />
      </mesh>
    </group>
  );
}

/** A couple of butterflies fluttering over the flower bed. */
function Butterflies() {
  const flies = useRef<(Group | null)[]>([]);
  const still = useStill();
  useFrame(({ clock }) => {
    if (still) return;
    const t = clock.elapsedTime;
    flies.current.forEach((f, i) => {
      if (!f) return;
      f.position.set(21 + Math.sin(t * 0.5 + i * 3) * 2.6, 0.9 + Math.sin(t * 2.3 + i) * 0.2, 9.5 + Math.cos(t * 0.7 + i) * 0.35);
      const flap = Math.sin(t * 18 + i);
      f.children.forEach((w, k) => (w.rotation.z = (k ? -1 : 1) * (0.3 + flap * 0.6)));
    });
  });
  return (
    <group userData={DYNAMIC}>
      {["#f9a8d4", "#fde68a"].map((c, i) => (
        <group
          key={c}
          ref={(g) => {
            flies.current[i] = g;
          }}
        >
          {[-1, 1].map((sd) => (
            <mesh key={sd} position={[sd * 0.05, 0, 0]}>
              <planeGeometry args={[0.1, 0.08]} />
              <meshBasicMaterial color={c} side={DoubleSide} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

function GardenLamp({ p, on }: { p: V3; on: boolean }) {
  return (
    <group position={p}>
      <mesh position={[0, 0.6, 0]}>
        <cylinderGeometry args={[0.03, 0.04, 1.2, 8]} />
        <meshStandardMaterial color="#2b2f33" />
      </mesh>
      <Bulb p={[0, 1.25, 0]} r={0.09} on={on} />
    </group>
  );
}

function Garden({ decor }: { decor: FloorDecor }) {
  const grass = useDisposable(() => grassTexture([5, 3.6]), "garden-grass");
  const { x0, gardenZ } = EAST;
  const glow = decor.phase !== "day";
  const flowers = ["#f472b6", "#fde047", "#f97316", "#c084fc", "#f43f5e", "#38bdf8"];
  return (
    <group>
      <Floor x0={x0} x1={FLOOR.x1} z0={gardenZ} z1={SOUTH.z0} map={grass} />
      {/* stone paths */}
      <Floor x0={x0} x1={23.6} z0={13.15} z1={14.05} color="#d6cfc2" y={0.006} />
      <Floor x0={17.05} x1={17.95} z0={gardenZ} z1={13.15} color="#d6cfc2" y={0.006} />
      <Hedge a={[x0, gardenZ]} b={[17.0, gardenZ]} />
      <Hedge a={[18.0, gardenZ]} b={[FLOOR.x1, gardenZ]} />
      <Hedge a={[x0, gardenZ]} b={[x0, 13.0]} />
      <Hedge a={[x0, 14.2]} b={[x0, SOUTH.z0]} />
      {/* flower bed along the hedge */}
      <B s={[6.0, 0.22, 0.45]} p={[22, 0.11, 9.375]} c="#7a5a3a" />
      {Array.from({ length: 18 }, (_, i) => (
        <mesh key={i} position={[19.2 + i * 0.33, 0.3 + (i % 3) * 0.04, 9.3 + (i % 2) * 0.15]}>
          <sphereGeometry args={[0.07, 8, 6]} />
          <meshStandardMaterial color={flowers[i % flowers.length]} />
        </mesh>
      ))}
      <Butterflies />
      {/* picnic table */}
      <group position={[19.8, 0, 11.3]}>
        <B s={[1.4, 0.06, 0.8]} p={[0, 0.74, 0]} c="#c08850" />
        {[-0.55, 0.55].map((x) => (
          <B key={x} s={[0.08, 0.72, 0.6]} p={[x, 0.36, 0]} c="#8a5a32" />
        ))}
        {[-0.7, 0.7].map((z) => (
          <group key={z}>
            <B s={[1.4, 0.06, 0.3]} p={[0, 0.44, z]} c="#c08850" />
            {[-0.55, 0.55].map((x) => (
              <B key={x} s={[0.06, 0.42, 0.06]} p={[x, 0.21, z]} c="#8a5a32" />
            ))}
          </group>
        ))}
      </group>
      <Pond />
      {/* sun loungers (head end to the north) */}
      {[21.6, 23.0].map((x) => (
        <group key={x} position={[x, 0, 15.0]}>
          <B s={[0.6, 0.22, 1.6]} p={[0, 0.2, 0]} c="#f8fafc" />
          <group position={[0, 0.3, -0.6]} rotation-x={-0.6}>
            <B s={[0.6, 0.06, 0.6]} p={[0, 0, 0.2]} c={decor.accent} />
          </group>
          <B s={[0.56, 0.04, 1.0]} p={[0, 0.33, 0.25]} c={decor.accent} />
        </group>
      ))}
      {/* hammock between two posts */}
      <group>
        {[24.0, 25.8].map((x) => (
          <B key={x} s={[0.12, 1.3, 0.12]} p={[x, 0.65, 14.6]} c="#8a5a32" />
        ))}
        <B s={[1.4, 0.05, 0.6]} p={[24.9, 0.52, 14.6]} c="#f97316" />
        <B s={[1.4, 0.052, 0.12]} p={[24.9, 0.525, 14.6]} c="#fde68a" />
        {[24.05, 25.75].map((x) => (
          <mesh key={x} position={[x + (x < 24.9 ? 0.12 : -0.12), 0.85, 14.6]} rotation-z={x < 24.9 ? -0.9 : 0.9}>
            <cylinderGeometry args={[0.01, 0.01, 0.75, 4]} />
            <meshStandardMaterial color="#e5e7eb" />
          </mesh>
        ))}
      </group>
      <Tree p={[25.5, 0, 10.3]} />
      <Tree p={[25.4, 0, 12.5]} s={0.85} />
      <Tree p={[16.8, 0, 15.3]} s={0.9} />
      {decor.items.lamps && (
        <>
          <GardenLamp p={[18.3, 0, 14.6]} on={glow} />
          <GardenLamp p={[24.3, 0, 9.95]} on={glow} />
        </>
      )}
    </group>
  );
}

function EastWing({ decor }: { decor: FloorDecor }) {
  return (
    <group>
      <Lobby decor={decor} />
      <TownHall />
      <Garden decor={decor} />
    </group>
  );
}

// ---------- South wing: four working zones off a second corridor ----------

/** Digital whiteboard: sticky notes, a flow sketch and a doodled chart. */
function whiteboardTexture(seed: number) {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 256;
  const g = c.getContext("2d")!;
  const rnd = seeded(seed);
  g.fillStyle = "#f8fafc";
  g.fillRect(0, 0, 512, 256);
  const notes = ["#fde68a", "#fbcfe8", "#bae6fd", "#bbf7d0", "#fed7aa"];
  for (let i = 0; i < 9; i++) {
    const x = 18 + (i % 3) * 58 + rnd() * 8;
    const y = 18 + Math.floor(i / 3) * 74 + rnd() * 8;
    g.fillStyle = notes[Math.floor(rnd() * notes.length)];
    g.fillRect(x, y, 48, 48);
    g.fillStyle = "rgba(30,41,59,0.55)";
    for (let l = 0; l < 3; l++) g.fillRect(x + 6, y + 10 + l * 12, 18 + rnd() * 18, 3);
  }
  // flow chart
  g.strokeStyle = "#2563eb";
  g.lineWidth = 4;
  const boxes: [number, number][] = [
    [230, 40],
    [330, 40],
    [280, 130],
    [400, 130],
  ];
  boxes.forEach(([x, y]) => g.strokeRect(x, y, 70, 40));
  g.beginPath();
  g.moveTo(300, 60);
  g.lineTo(330, 60);
  g.moveTo(265, 80);
  g.lineTo(300, 130);
  g.moveTo(350, 150);
  g.lineTo(400, 150);
  g.stroke();
  // chart doodle
  g.strokeStyle = "#ef4444";
  g.beginPath();
  g.moveTo(240, 230);
  for (let i = 1; i <= 8; i++) g.lineTo(240 + i * 30, 230 - i * 8 - rnd() * 20);
  g.stroke();
  return finish(c, [1, 1]);
}

/** Video call and roadmap on the strategy hub's screen wall. */
function avTexture() {
  const c = document.createElement("canvas");
  c.width = 640;
  c.height = 300;
  const g = c.getContext("2d")!;
  g.fillStyle = "#0f172a";
  g.fillRect(0, 0, 640, 300);
  const tiles = ["#fca5a5", "#fcd34d", "#86efac", "#93c5fd", "#c4b5fd", "#f9a8d4"];
  tiles.forEach((col, i) => {
    const x = 16 + (i % 3) * 104;
    const y = 16 + Math.floor(i / 3) * 136;
    g.fillStyle = "#1e293b";
    g.fillRect(x, y, 96, 124);
    g.fillStyle = col;
    g.beginPath();
    g.arc(x + 48, y + 52, 26, 0, Math.PI * 2);
    g.fill();
    g.fillRect(x + 20, y + 84, 56, 30);
  });
  // roadmap: three swimlanes of bars
  g.fillStyle = "#e2e8f0";
  g.fillRect(340, 16, 284, 268);
  const bars = ["#2563eb", "#16a34a", "#f59e0b"];
  bars.forEach((col, i) => {
    g.fillStyle = col;
    g.fillRect(356 + i * 30, 50 + i * 76, 150, 26);
    g.fillRect(420 + i * 40, 84 + i * 76, 110, 18);
  });
  g.fillStyle = "#0f172a";
  g.fillRect(356, 28, 120, 10);
  return finish(c, [1, 1]);
}

/** Wall along z at x, built from the same glass panels as the corridor fronts. */
function GlassWallZ({ x, z0, z1, h = INT_H }: { x: number; z0: number; z1: number; h?: number }) {
  return (
    <group position={[x, 0, (z0 + z1) / 2]} rotation-y={-Math.PI / 2}>
      <GlassWall x0={-(z1 - z0) / 2} x1={(z1 - z0) / 2} z={0} h={h} />
    </group>
  );
}

/** Open doorway frame across a gap in a wall along x. */
function Doorway({ x0, x1, z, color = "#5f6b70" }: { x0: number; x1: number; z: number; color?: string }) {
  return (
    <group>
      <B s={[0.07, 2.05, 0.14]} p={[x0, 1.025, z]} c={color} />
      <B s={[0.07, 2.05, 0.14]} p={[x1, 1.025, z]} c={color} />
      <B s={[x1 - x0 + 0.07, 0.07, 0.14]} p={[(x0 + x1) / 2, 2.05, z]} c={color} />
    </group>
  );
}

function Dumbbell({ p, c }: { p: V3; c: string }) {
  return (
    <group position={p}>
      <B s={[0.04, 0.04, 0.24]} p={[0, 0, 0]} c="#9ca3af" metal={0.6} rough={0.3} />
      {[-0.1, 0.1].map((z) => (
        <B key={z} s={[0.1, 0.1, 0.05]} p={[0, 0, z]} c={c} />
      ))}
    </group>
  );
}

/** Zone 5: cardio and weights at the front, yoga mats and a meditation corner on soft floors. */
function FitnessStudio({ decor, sky }: { decor: FloorDecor; sky: Texture }) {
  const { door, z1, gym } = SOUTH;
  const glow = decor.phase !== "day";
  return (
    <group>
      <Floor x0={FLOOR.x0} x1={gym} z0={door} z1={20.6} color="#3f4448" />
      {/* cork floor for yoga, tatami for meditation */}
      <Floor x0={FLOOR.x0} x1={-4.7} z0={20.6} z1={z1} color="#d9b98c" />
      <Floor x0={-4.7} x1={gym} z0={20.6} z1={z1} color="#d8d3a4" />
      {Array.from({ length: 5 }, (_, i) => (
        <Floor key={i} x0={-4.7 + i * 1.14} x1={-4.7 + i * 1.14 + 0.02} z0={20.6} z1={z1} color="#b5ad72" y={0.004} />
      ))}
      {/* cardio */}
      <Treadmill p={[-7.0, 0, 18.2]} />
      <Treadmill p={[-7.0, 0, 19.8]} />
      <group position={[-4.6, 0, 18.45]}>
        <B s={[0.12, 0.08, 1.0]} p={[0, 0.04, 0]} c="#2b2f33" />
        <B s={[0.06, 0.5, 0.06]} p={[0, 0.3, 0]} c="#4b5563" />
        <B s={[0.24, 0.06, 0.3]} p={[0, 0.55, 0]} c="#111317" />
        <B s={[0.06, 0.8, 0.06]} p={[0, 0.45, 0.4]} c="#4b5563" />
        <B s={[0.44, 0.05, 0.06]} p={[0, 0.86, 0.4]} c="#111317" />
        <mesh position={[0, 0.3, 0.32]} rotation-z={Math.PI / 2}>
          <cylinderGeometry args={[0.2, 0.2, 0.07, 20]} />
          <meshStandardMaterial color="#ef4444" metalness={0.4} roughness={0.4} />
        </mesh>
      </group>
      {/* dumbbell rack and kettlebells */}
      <group position={[-1.35, 0, 18.6]}>
        <B s={[0.5, 0.06, 1.2]} p={[0, 0.3, 0]} c="#2b2f33" />
        <B s={[0.5, 0.06, 1.2]} p={[0, 0.62, 0]} c="#2b2f33" />
        {[-0.55, 0.55].map((z) => (
          <B key={z} s={[0.06, 0.7, 0.06]} p={[0, 0.35, z]} c="#4b5563" />
        ))}
        {[-0.4, -0.13, 0.14, 0.41].map((z, i) => (
          <group key={z}>
            <Dumbbell p={[0, 0.39, z]} c={["#ef4444", "#3b82f6", "#22c55e", "#f59e0b"][i]} />
            <Dumbbell p={[0, 0.71, z]} c="#111317" />
          </group>
        ))}
      </group>
      {[17.6, 17.95].map((z, i) => (
        <mesh key={z} position={[-0.3 - i * 0.4, 0.13, z]} castShadow>
          <sphereGeometry args={[0.13, 16, 12]} />
          <meshStandardMaterial color={i ? "#f97316" : "#111317"} roughness={0.5} />
        </mesh>
      ))}
      <mesh position={[0.3, 0.32, 20.0]} castShadow>
        <sphereGeometry args={[0.32, 24, 16]} />
        <meshStandardMaterial color="#a78bfa" roughness={0.4} />
      </mesh>
      {/* mirror wall for the yoga mats */}
      <group position={[-7.91, 1.05, 22.2]} rotation-y={Math.PI / 2}>
        <B s={[3.0, 1.5, 0.04]} p={[0, 0, 0]} c="#d6d3cf" />
        <mesh position={[0, 0, 0.025]}>
          <planeGeometry args={[2.9, 1.4]} />
          <meshStandardMaterial color="#dcebf2" metalness={0.6} roughness={0.08} />
        </mesh>
      </group>
      {[21.0, 22.0, 23.0].map((z, i) => (
        <YogaMat key={z} p={[-6.8, 0, z]} color={["#8b5cf6", "#14b8a6", "#f472b6"][i]} />
      ))}
      {/* meditation cushions facing a little stone fountain and candles */}
      {[-3.8, -2.8, -1.8].map((x, i) => (
        <mesh key={x} position={[x, 0.06, 22.2]} scale={[1, 0.35, 1]} castShadow>
          <sphereGeometry args={[0.3, 20, 12]} />
          <meshStandardMaterial color={["#e0b0ff", "#a3d9c9", "#ffc9a8"][i]} roughness={1} />
        </mesh>
      ))}
      <group position={[-2.8, 0, 23.45]}>
        <B s={[2.4, 0.3, 0.5]} p={[0, 0.15, 0]} c="#8a6a4a" />
        {[0.12, 0.09, 0.06].map((r, i) => (
          <mesh key={r} position={[0.2, 0.36 + i * 0.12, 0]} scale={[1.3, 0.7, 1]}>
            <sphereGeometry args={[r, 12, 8]} />
            <meshStandardMaterial color={["#6b7280", "#9ca3af", "#d1d5db"][i]} />
          </mesh>
        ))}
        {[-0.9, -0.6, 0.8].map((x) => (
          <group key={x}>
            <B s={[0.07, 0.14, 0.07]} p={[x, 0.37, 0]} c="#fef3c7" />
            <Bulb p={[x, 0.47, 0]} r={0.025} on={glow} />
          </group>
        ))}
        <mesh position={[-0.25, 0.42, 0]}>
          <icosahedronGeometry args={[0.13, 0]} />
          <meshStandardMaterial color="#52b788" flatShading />
        </mesh>
      </group>
      <WindowPane p={[-7.92 + 0.02, 1.5, 18.9]} r={Math.PI / 2} w={1.6} h={1.0} sky={sky} />
      {decor.items.plants && (
        <>
          <PalmPlant p={[0.45, 0, 23.5]} />
          <PalmPlant p={[-7.45, 0, 23.6]} s={0.9} />
        </>
      )}
    </group>
  );
}

/** One sound-proofed booth: felt back panel, desk, monitor, chair and a busy light. */
function FocusPod({ id, x, z, open, felt }: { id: string; x: number; z: number; open: "east" | "west"; felt: string }) {
  // x, z: where the sitter sits (facing -z); the desk is in front, the door on the open side
  const side = open === "east" ? 1 : -1;
  const wx = x + side * 1.3;
  const back = x - side * 1.4;
  const dz = z - 0.75;
  return (
    <group>
      <Floor x0={Math.min(back, wx)} x1={Math.max(back, wx)} z0={z - 1.15} z1={z + 0.95} color="#46505a" y={0.005} />
      {/* felt panel behind the desk and on the closed side */}
      <B s={[2.6, 1.7, 0.06]} p={[x, 0.85, z - 1.12]} c={felt} rough={1} />
      <B s={[0.06, 1.7, 2.0]} p={[back, 0.85, z - 0.1]} c={felt} rough={1} />
      <GlassWall x0={Math.min(back, wx)} x1={Math.max(back, wx)} z={z + 0.95} h={2.0} />
      <GlassWallZ x={wx} z0={z - 1.15} z1={z - 0.45} h={2.0} />
      <GlassWallZ x={wx} z0={z + 0.6} z1={z + 0.95} h={2.0} />
      <B s={[0.07, 0.07, 1.06]} p={[wx, 2.0, z + 0.07]} c="#5f6b70" />
      <PodLive id={id} x={x} z={z} wx={wx} dz={dz} side={side} />
      {/* desk with a monitor, keyboard and headphones */}
      <B s={[1.5, 0.05, 0.6]} p={[x, 0.74, dz]} c="#e7d3b5" />
      {[-0.68, 0.68].map((ox) => (
        <B key={ox} s={[0.05, 0.72, 0.5]} p={[x + ox, 0.36, dz]} c="#374151" />
      ))}
      <B s={[0.7, 0.42, 0.04]} p={[x, 1.08, dz - 0.18]} c="#111827" />
      <B s={[0.05, 0.16, 0.05]} p={[x, 0.85, dz - 0.18]} c="#374151" />
      <B s={[0.44, 0.02, 0.14]} p={[x, 0.775, dz + 0.08]} c="#f5f5f4" />
      <mesh position={[x + 0.5, 0.8, dz + 0.05]} rotation-x={Math.PI / 2}>
        <torusGeometry args={[0.08, 0.018, 8, 16, Math.PI]} />
        <meshStandardMaterial color="#111827" />
      </mesh>
      <OfficeChair p={[x, 0, z + 0.05]} />
    </group>
  );
}

/** Zone 4: four enclosed focus pods off a quiet aisle. */
function FocusPods({ decor }: { decor: FloorDecor }) {
  const { door, z1, gym, pods } = SOUTH;
  const carpet = useDisposable(() => carpetTexture("#6b7f73", [4, 3.6]), "pods-floor");
  return (
    <group>
      <Floor x0={gym} x1={pods} z0={door} z1={z1} map={carpet} />
      <FocusPod id="pod-0" x={2.6} z={19.35} open="east" felt="#5b8a72" />
      <FocusPod id="pod-1" x={6.4} z={19.35} open="west" felt="#7a6aa8" />
      <FocusPod id="pod-2" x={2.6} z={22.55} open="east" felt="#c07a5a" />
      <FocusPod id="pod-3" x={6.4} z={22.55} open="west" felt="#4f7aa8" />
      {decor.items.plants && <PalmPlant p={[4.5, 0, 23.6]} s={0.85} />}
    </group>
  );
}

// ---------- South wing props that react to the people using them ----------

/** Marker strokes for a whiteboard sketch (transparent, drawn over the board). */
function sketchTexture(seed: number) {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 256;
  const g = c.getContext("2d")!;
  const rnd = seeded(seed);
  g.lineCap = "round";
  g.lineJoin = "round";
  const pens = ["#dc2626", "#2563eb", "#16a34a", "#111827"];
  for (let i = 0; i < 5; i++) {
    const x = 30 + i * 95 + rnd() * 20;
    const y = 50 + rnd() * 140;
    g.strokeStyle = pens[i % pens.length];
    g.lineWidth = 4;
    // a box or a circle, a few scribbled words, and an arrow to the next idea
    if (i % 2) {
      g.beginPath();
      g.ellipse(x + 30, y, 34, 22, 0, 0, Math.PI * 2);
      g.stroke();
    } else g.strokeRect(x, y - 22, 64, 44);
    g.lineWidth = 2.5;
    for (let l = 0; l < 2; l++) {
      g.beginPath();
      g.moveTo(x + 8, y - 6 + l * 12);
      for (let k = 1; k <= 8; k++) g.lineTo(x + 8 + k * 6, y - 6 + l * 12 + Math.sin(k * 2 + rnd() * 3) * 3);
      g.stroke();
    }
    if (i < 4) {
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(x + 70, y);
      g.lineTo(x + 95, y + (rnd() - 0.5) * 30);
      g.stroke();
    }
  }
  g.strokeStyle = "#f59e0b";
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(40, 225);
  g.lineTo(470, 225);
  g.stroke();
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

/** While someone sketches at the board, a new drawing appears left to right; it fades once they leave. */
function LiveSketch({ spot, seed }: { spot: string; seed: number }) {
  const tex = useDisposable(() => sketchTexture(seed), `sketch-${seed}`);
  const wipe = useRef<Group>(null);
  const mat = useRef<MeshBasicMaterial>(null);
  const progress = useRef(0);
  useFrame((_, dt) => {
    const g = wipe.current;
    const m = mat.current;
    if (!g || !m?.map) return;
    const drawing = isPresent(spot);
    progress.current = drawing ? Math.min(1, progress.current + dt / 16) : Math.max(0, progress.current - dt / 40);
    const k = Math.max(0.001, progress.current);
    // reveal the left part of the sketch at its real size, like a marker moving across
    g.scale.x = k;
    m.map.repeat.x = k;
    g.visible = progress.current > 0.005;
  });
  return (
    <group ref={wipe} position={[-1.04, 0, 0.034]} userData={DYNAMIC}>
      <mesh position={[1.04, 0, 0]}>
        <planeGeometry args={[2.08, 1.03]} />
        <meshBasicMaterial ref={mat} map={tex} transparent toneMapped={false} />
      </mesh>
    </group>
  );
}

/** The touch table lights up and projects floating ideas while someone works at it. */
function LiveTouchTable({ map }: { map: Texture }) {
  const top = useRef<MeshBasicMaterial>(null);
  const holo = useRef<Group>(null);
  const still = useStill();
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const active = isPresent("tt-a") || isPresent("tt-b");
    top.current?.color.setScalar(active ? 0.85 + Math.sin(t * 3) * 0.15 : 0.45);
    const h = holo.current;
    if (!h) return;
    h.visible = active;
    if (!active || still) return;
    h.children.forEach((c, i) => {
      c.position.y = 0.25 + Math.sin(t * 1.5 + i * 2) * 0.06;
      c.rotation.y = t * (0.8 + i * 0.3);
      c.rotation.x = t * 0.5;
    });
  });
  return (
    <group userData={DYNAMIC}>
      <mesh position={[0, 0.905, 0]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[1.48, 0.88]} />
        <meshBasicMaterial ref={top} map={map} toneMapped={false} />
      </mesh>
      <group ref={holo} position={[0, 0.9, 0]} visible={false}>
        {["#22d3ee", "#a78bfa", "#f472b6"].map((c, i) => (
          <mesh key={c} position={[(i - 1) * 0.4, 0.25, 0]}>
            {i === 1 ? <icosahedronGeometry args={[0.09, 0]} /> : <boxGeometry args={[0.12, 0.12, 0.12]} />}
            <meshBasicMaterial color={c} transparent opacity={0.75} toneMapped={false} wireframe={i === 1} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/** The 3D printer's head sweeps and the print grows while someone runs a job. */
function LivePrinter() {
  const head = useRef<Mesh>(null);
  const print = useRef<Mesh>(null);
  const grown = useRef(0.3);
  const still = useStill();
  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    const printing = isPresent("printer3d");
    if (printing) grown.current = grown.current >= 1 ? 0.15 : grown.current + dt / 25;
    if (head.current) {
      head.current.position.x = printing && !still ? Math.sin(t * 5) * 0.2 : 0;
      head.current.position.z = printing && !still ? Math.cos(t * 3.3) * 0.18 : 0;
      head.current.position.y = 0.76 + grown.current * 0.12;
    }
    print.current?.scale.set(1, grown.current, 1);
  });
  return (
    <group userData={DYNAMIC}>
      <mesh ref={head} position={[0, 0.8, 0]}>
        <boxGeometry args={[0.1, 0.06, 0.1]} />
        <meshStandardMaterial color="#111827" />
      </mesh>
      <mesh ref={print} position={[0, 0.78, 0]}>
        <torusKnotGeometry args={[0.08, 0.03, 48, 8]} />
        <meshStandardMaterial color="#f97316" />
      </mesh>
    </group>
  );
}

/** A focus pod's live bits: busy light (red when someone's in), screen wakes up with scrolling work, lamp on. */
function PodLive({ id, x, z, wx, dz, side }: { id: string; x: number; z: number; wx: number; dz: number; side: number }) {
  const light = useRef<MeshBasicMaterial>(null);
  const screen = useRef<MeshBasicMaterial>(null);
  const lamp = useRef<MeshBasicMaterial>(null);
  const code = useDisposable(() => codeTexture(id.length + x), `pod-code-${id}`);
  const still = useStill();
  useFrame((_, dt) => {
    const inUse = isPresent(id);
    light.current?.color.set(inUse ? "#ef4444" : "#22c55e");
    lamp.current?.color.set(inUse ? "#ffd58a" : "#f5f1e6");
    const m = screen.current;
    if (!m?.map) return;
    m.color.set(inUse ? "#ffffff" : "#1e293b");
    if (inUse && !still) m.map.offset.y = (m.map.offset.y + dt * 0.05) % 1;
  });
  return (
    <group userData={DYNAMIC}>
      <mesh position={[wx, 2.1, z + 0.07]}>
        <sphereGeometry args={[0.06, 12, 10]} />
        <meshBasicMaterial ref={light} color="#22c55e" toneMapped={false} />
      </mesh>
      <mesh position={[x, 1.08, dz - 0.155]}>
        <planeGeometry args={[0.64, 0.36]} />
        <meshBasicMaterial ref={screen} map={code} toneMapped={false} />
      </mesh>
      <mesh position={[x - side * 0.55, 1.6, z - 1.05]}>
        <sphereGeometry args={[0.06, 12, 12]} />
        <meshBasicMaterial ref={lamp} color="#f5f1e6" toneMapped={false} />
      </mesh>
    </group>
  );
}

/** Lines of code / text for a pod's monitor (scrolls while someone works). */
function codeTexture(seed: number) {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const g = c.getContext("2d")!;
  const rnd = seeded(Math.floor(seed * 7));
  g.fillStyle = "#0f172a";
  g.fillRect(0, 0, 256, 256);
  const colors = ["#7dd3fc", "#a78bfa", "#86efac", "#fca5a5", "#e2e8f0"];
  for (let y = 8; y < 256; y += 12) {
    let x = 8 + Math.floor(rnd() * 4) * 12;
    while (x < 230 && rnd() > 0.15) {
      const w = 12 + rnd() * 40;
      g.fillStyle = colors[Math.floor(rnd() * colors.length)];
      g.fillRect(x, y, w, 5);
      x += w + 6;
    }
  }
  return finish(c, [1, 1]);
}

const HUB_IDS = ["hub-n0", "hub-n1", "hub-n2", "hub-n3", "hub-s0", "hub-s1", "hub-s2", "hub-s3", "hub-w", "hub-e"];

/** The hub's screen: dim when the room is free; a live video call (with a blinking REC dot) when people meet. */
function HubScreen({ map }: { map: Texture }) {
  const screen = useRef<MeshBasicMaterial>(null);
  const rec = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    const inUse = HUB_IDS.some((id) => isPresent(id));
    screen.current?.color.set(inUse ? "#ffffff" : "#3b4252");
    if (rec.current) rec.current.visible = inUse && clock.elapsedTime % 1.2 < 0.7;
  });
  return (
    <group userData={DYNAMIC}>
      <mesh position={[0, 0, 0.03]}>
        <planeGeometry args={[2.8, 1.25]} />
        <meshBasicMaterial ref={screen} map={map} toneMapped={false} />
      </mesh>
      <mesh ref={rec} position={[-1.28, 0.52, 0.035]} visible={false}>
        <circleGeometry args={[0.045, 16]} />
        <meshBasicMaterial color="#ef4444" toneMapped={false} />
      </mesh>
    </group>
  );
}

/** Pinball playfield flashing while someone plays. */
function LivePinball({ glow }: { glow: boolean }) {
  const field = useRef<MeshBasicMaterial>(null);
  useFrame(({ clock }) => {
    const m = field.current;
    if (!m) return;
    if (isPresent("pinball")) m.color.setHSL((clock.elapsedTime * 0.6) % 1, 0.9, 0.7);
    else m.color.set(glow ? "#f0abfc" : "#f5d0fe");
  });
  return (
    <mesh position={[0, 0.9, 0]} rotation-x={-Math.PI / 2 + 0.1} userData={DYNAMIC}>
      <planeGeometry args={[0.52, 1.0]} />
      <meshBasicMaterial ref={field} color="#f5d0fe" toneMapped={false} />
    </mesh>
  );
}

/** A sunset painting for the easel (revealed brush stroke by brush stroke while someone paints). */
function paintingTexture() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 192;
  const g = c.getContext("2d")!;
  const sky = g.createLinearGradient(0, 0, 0, 130);
  sky.addColorStop(0, "#7c3aed");
  sky.addColorStop(0.6, "#f97316");
  sky.addColorStop(1, "#fde047");
  g.fillStyle = sky;
  g.fillRect(0, 0, 256, 130);
  g.fillStyle = "#fef08a";
  g.beginPath();
  g.arc(170, 120, 28, Math.PI, 0);
  g.fill();
  g.fillStyle = "#1e3a8a";
  g.fillRect(0, 128, 256, 64);
  g.fillStyle = "#14532d";
  g.beginPath();
  g.moveTo(0, 140);
  g.quadraticCurveTo(60, 95, 120, 135);
  g.quadraticCurveTo(170, 160, 256, 120);
  g.lineTo(256, 192);
  g.lineTo(0, 192);
  g.fill();
  return finish(c, [1, 1]);
}

/** Easel with a canvas that fills with a painting while someone stands at it. */
function Easel() {
  const tex = useDisposable(paintingTexture, "easel-painting");
  const wipe = useRef<Group>(null);
  const mat = useRef<MeshBasicMaterial>(null);
  const progress = useRef(0.2);
  useFrame((_, dt) => {
    const g = wipe.current;
    const m = mat.current;
    if (!g || !m?.map) return;
    const painting = isPresent("easel");
    progress.current = painting ? Math.min(1, progress.current + dt / 20) : progress.current;
    if (progress.current >= 1 && !painting) progress.current = 0.05;
    const k = Math.max(0.001, progress.current);
    g.scale.x = k;
    m.map.repeat.x = k;
  });
  return (
    <group position={[14.6, 0, 19.3]}>
      {[-0.22, 0.22].map((x) => (
        <mesh key={x} position={[x, 0.8, 0]} rotation-z={x > 0 ? -0.12 : 0.12}>
          <boxGeometry args={[0.04, 1.6, 0.04]} />
          <meshStandardMaterial color="#a16207" />
        </mesh>
      ))}
      <mesh position={[0, 0.75, -0.25]} rotation-x={0.35}>
        <boxGeometry args={[0.04, 1.5, 0.04]} />
        <meshStandardMaterial color="#a16207" />
      </mesh>
      <B s={[0.7, 0.03, 0.08]} p={[0, 0.9, 0.04]} c="#92400e" />
      <B s={[0.66, 0.5, 0.03]} p={[0, 1.18, 0.06]} c="#f8fafc" />
      <group ref={wipe} position={[-0.31, 1.18, 0.078]} userData={DYNAMIC}>
        <mesh position={[0.31, 0, 0]}>
          <planeGeometry args={[0.62, 0.46]} />
          <meshBasicMaterial ref={mat} map={tex} toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}

/** Upright piano in the labs (keys towards the room), with its bench. */
function Piano() {
  return (
    <group position={[15.6, 0, 20.0]} rotation-y={Math.PI / 2}>
      <B s={[0.4, 1.2, 1.2]} p={[0, 0.6, 0]} c="#1c1917" rough={0.25} metal={0.2} />
      <B s={[0.3, 0.05, 1.12]} p={[-0.3, 0.76, 0]} c="#1c1917" rough={0.25} />
      <B s={[0.12, 0.03, 1.08]} p={[-0.32, 0.79, 0]} c="#f8fafc" />
      {Array.from({ length: 9 }, (_, i) => (
        <B key={i} s={[0.07, 0.035, 0.03]} p={[-0.29, 0.81, -0.48 + i * 0.12]} c="#111827" />
      ))}
      <B s={[0.38, 0.06, 0.7]} p={[-0.65, 0.45, 0]} c="#1c1917" />
      {[-0.3, 0.3].map((z) => (
        <B key={z} s={[0.05, 0.42, 0.05]} p={[-0.65, 0.21, z]} c="#1c1917" />
      ))}
    </group>
  );
}

/** Stool and a guitar on its stand. */
function MusicCorner() {
  return (
    <group>
      <group position={[14.3, 0, 21.4]}>
        <mesh position={[0, 0.43, 0]}>
          <cylinderGeometry args={[0.18, 0.18, 0.05, 16]} />
          <meshStandardMaterial color="#b45309" />
        </mesh>
        <mesh position={[0, 0.21, 0]}>
          <cylinderGeometry args={[0.03, 0.05, 0.42, 8]} />
          <meshStandardMaterial color="#374151" />
        </mesh>
      </group>
      <group position={[14.75, 0, 21.75]} rotation-y={-0.6}>
        <mesh position={[0, 0.35, 0]} scale={[1, 1.3, 0.35]}>
          <sphereGeometry args={[0.17, 14, 10]} />
          <meshStandardMaterial color="#c2410c" />
        </mesh>
        <B s={[0.05, 0.55, 0.03]} p={[0, 0.8, 0]} c="#451a03" />
        <B s={[0.25, 0.04, 0.2]} p={[0, 0.02, 0]} c="#111827" />
      </group>
    </group>
  );
}

/** Zone 3: digital whiteboards, a touch table, a 3D printer, pinball and an arcade cabinet. */
function CreativeLabs({ decor }: { decor: FloorDecor }) {
  const { door, z1, pods, labs } = SOUTH;
  const glow = decor.phase !== "day";
  const tiles = useDisposable(() => tileTexture("#eee9f7", "#ddd3ef", [8, 6.8]), "labs-floor");
  const board1 = useDisposable(() => whiteboardTexture(5), "wb-5");
  const board2 = useDisposable(() => whiteboardTexture(11), "wb-11");
  const table = useDisposable(() => whiteboardTexture(23), "wb-23");
  return (
    <group>
      <Floor x0={pods} x1={labs} z0={door} z1={z1} map={tiles} />
      {decor.items.rugs && (
        <mesh rotation-x={-Math.PI / 2} position={[12.0, 0.006, 20.2]} receiveShadow>
          <circleGeometry args={[1.6, 40]} />
          <meshStandardMaterial color={decor.accent} roughness={1} />
        </mesh>
      )}
      {/* digital whiteboards on the west wall */}
      {(
        [
          [18.9, board1, "wb-1"],
          [21.6, board2, "wb-2"],
        ] as const
      ).map(([z, map, spot], i) => (
        <group key={z} position={[pods + 0.1, 1.2, z]} rotation-y={Math.PI / 2}>
          <B s={[2.2, 1.15, 0.05]} p={[0, 0, 0]} c="#1f2937" />
          <mesh position={[0, 0, 0.03]}>
            <planeGeometry args={[2.08, 1.03]} />
            <meshBasicMaterial map={map} toneMapped={false} />
          </mesh>
          <LiveSketch spot={spot} seed={31 + i * 17} />
          <B s={[1.2, 0.04, 0.1]} p={[0, -0.6, 0.06]} c="#9ca3af" />
        </group>
      ))}
      {/* touch table with a glowing screen top */}
      <group position={[12.0, 0, 20.2]}>
        <B s={[1.6, 0.12, 1.0]} p={[0, 0.84, 0]} c="#1f2937" />
        <LiveTouchTable map={table} />
        <B s={[0.5, 0.78, 0.4]} p={[0, 0.39, 0]} c="#374151" />
      </group>
      {/* 3D printer with a print in progress */}
      <group position={[15.75, 0, 18.4]}>
        <B s={[0.7, 0.75, 0.7]} p={[0, 0.375, 0]} c="#f5f5f4" />
        <mesh position={[0, 1.05, 0]}>
          <boxGeometry args={[0.6, 0.6, 0.6]} />
          <meshStandardMaterial color="#bfe3f0" transparent opacity={0.3} depthWrite={false} />
        </mesh>
        <B s={[0.62, 0.04, 0.62]} p={[0, 1.37, 0]} c="#374151" />
        <LivePrinter />
      </group>
      {/* beanbag for big thoughts */}
      <mesh position={[15.6, 0.22, 22.4]} scale={[1, 0.6, 1]} castShadow>
        <sphereGeometry args={[0.42, 20, 16]} />
        <meshStandardMaterial color="#facc15" roughness={0.9} />
      </mesh>
      {/* pinball machine and an arcade cabinet */}
      <group position={[10.0, 0, 23.3]}>
        <B s={[0.6, 0.75, 1.1]} p={[0, 0.5, 0]} c="#7c3aed" />
        <LivePinball glow={glow} />
        <B s={[0.6, 0.7, 0.12]} p={[0, 1.25, 0.5]} c="#4c1d95" />
        {[-0.24, 0.24].map((x) => (
          <B key={x} s={[0.05, 0.45, 0.05]} p={[x, 0.22, -0.48]} c="#111827" />
        ))}
      </group>
      <group position={[11.3, 0, 23.45]} rotation-y={Math.PI}>
        <Arcade p={[0, 0, 0]} hue={0.55} />
      </group>
      {decor.items.plants && <PalmPlant p={[16.5, 0, 23.6]} s={0.9} />}
      {decor.items.lamps && <FloorLamp p={[16.5, 0, 19.3]} on={glow} />}
      <Easel />
      <Piano />
      <MusicCorner />
    </group>
  );
}

/** Zone 6: the formal conference room with a big table and a screen wall. */
function StrategyHub({ decor }: { decor: FloorDecor }) {
  const { door, z1, labs } = SOUTH;
  const glow = decor.phase !== "day";
  const carpet = useDisposable(() => carpetTexture("#2d3a55", [6, 4.4]), "hub-floor");
  const screen = useDisposable(() => avTexture(), "hub-av");
  return (
    <group>
      <Floor x0={labs} x1={FLOOR.x1} z0={door} z1={z1} map={carpet} />
      {/* walnut panel, screen wall, camera bar, credenza and speakers */}
      <B s={[0.05, 1.8, 3.8]} p={[labs + 0.1, 0.9, 20.6]} c="#5a3d2b" />
      <group position={[labs + 0.15, 1.15, 20.6]} rotation-y={Math.PI / 2}>
        <B s={[2.9, 1.35, 0.05]} p={[0, 0, 0]} c="#0b0f19" />
        <HubScreen map={screen} />
        <B s={[0.5, 0.06, 0.08]} p={[0, 0.72, 0.03]} c="#111827" />
      </group>
      <B s={[0.4, 0.42, 2.6]} p={[labs + 0.3, 0.21, 20.6]} c="#3b2a20" />
      {[18.9, 22.3].map((z) => (
        <B key={z} s={[0.3, 1.0, 0.3]} p={[labs + 0.35, 0.5, z]} c="#111827" />
      ))}
      {/* conference table for ten */}
      <group position={[21.5, 0, 20.6]}>
        <B s={[4.0, 0.06, 1.4]} p={[0, 0.75, 0]} c="#6b4a33" rough={0.35} />
        <B s={[3.4, 0.065, 0.3]} p={[0, 0.752, 0]} c="#1f2937" rough={0.3} />
        {[-1.3, 1.3].map((x) => (
          <B key={x} s={[0.3, 0.72, 0.8]} p={[x, 0.36, 0]} c="#2b2f33" />
        ))}
        <mesh position={[0, 0.8, 0]}>
          <cylinderGeometry args={[0.14, 0.16, 0.05, 20]} />
          <meshStandardMaterial color="#111827" />
        </mesh>
        {[-1.5, -0.5, 0.5, 1.5].map((x) => (
          <group key={x}>
            <B s={[0.32, 0.015, 0.22]} p={[x, 0.79, -0.42]} c="#d1d5db" metal={0.5} rough={0.3} />
            <B s={[0.32, 0.015, 0.22]} p={[x, 0.79, 0.42]} c="#d1d5db" metal={0.5} rough={0.3} />
          </group>
        ))}
      </group>
      {[20.0, 21.0, 22.0, 23.0].map((x) => (
        <group key={x}>
          <OfficeChair p={[x, 0, 19.55]} r={Math.PI} />
          <OfficeChair p={[x, 0, 21.65]} />
        </group>
      ))}
      <OfficeChair p={[19.0, 0, 20.6]} r={-Math.PI / 2} />
      <OfficeChair p={[24.0, 0, 20.6]} r={Math.PI / 2} />
      {/* linear pendant over the table */}
      <B s={[3.6, 0.05, 0.12]} p={[21.5, 2.35, 20.6]} c="#2b2f33" />
      <mesh position={[21.5, 2.32, 20.6]}>
        <boxGeometry args={[3.5, 0.02, 0.08]} />
        <meshBasicMaterial color={glow ? "#ffe2a8" : "#f8fafc"} toneMapped={false} />
      </mesh>
      {[20.0, 23.0].map((x) => (
        <mesh key={x} position={[x, 2.5, 20.6]}>
          <cylinderGeometry args={[0.006, 0.006, 0.3, 4]} />
          <meshStandardMaterial color="#6b7280" />
        </mesh>
      ))}
      {decor.items.plants && (
        <>
          <PalmPlant p={[25.5, 0, 17.65]} />
          <PalmPlant p={[25.5, 0, 23.55]} />
          <PalmPlant p={[17.5, 0, 23.55]} s={0.85} />
        </>
      )}
      {decor.items.art && <Art p={[25.5, 1.4, 23.94]} r={Math.PI} seed={29} w={1.0} h={0.6} />}
    </group>
  );
}

/** Corridor, glass fronts with doorways, room dividers and the four zones. */
function SouthWing({ decor, sky }: { decor: FloorDecor; sky: Texture }) {
  const terrazzo = useDisposable(() => tileTexture("#ece8e1", "#dcd6cc", [17, 0.6]), "south-corridor");
  const { z0, door, z1, gym, pods, labs } = SOUTH;
  return (
    <group>
      <Floor x0={FLOOR.x0} x1={FLOOR.x1} z0={z0} z1={door} map={terrazzo} />
      {/* low wall to the hall with two ways through, a hedge along the garden */}
      <Wall a={[FLOOR.x0, z0]} b={[6.3, z0]} h={1.0} />
      <Wall a={[7.3, z0]} b={[11.75, z0]} h={1.0} />
      <Wall a={[12.75, z0]} b={[EAST.x0, z0]} h={1.0} />
      <Hedge a={[EAST.x0, z0]} b={[FLOOR.x1, z0]} />
      {/* glass fronts on the four zones */}
      <GlassWall x0={FLOOR.x0} x1={-4.5} z={door} />
      <Doorway x0={-4.5} x1={-3.5} z={door} />
      <GlassWall x0={-3.5} x1={4.0} z={door} />
      <Doorway x0={4.0} x1={5.0} z={door} />
      <GlassWall x0={5.0} x1={12.0} z={door} />
      <Doorway x0={12.0} x1={13.4} z={door} />
      <GlassWall x0={13.4} x1={21.0} z={door} />
      <Doorway x0={21.0} x1={22.0} z={door} color="#7a2f3b" />
      <GlassWall x0={22.0} x1={FLOOR.x1} z={door} />
      {/* room dividers */}
      <Wall a={[gym, door]} b={[gym, z1]} h={INT_H} color="#e7e3ee" />
      <Wall a={[pods, door]} b={[pods, z1]} h={INT_H} />
      <Wall a={[labs, door]} b={[labs, z1]} h={INT_H} />
      <FitnessStudio decor={decor} sky={sky} />
      <FocusPods decor={decor} />
      <CreativeLabs decor={decor} />
      <StrategyHub decor={decor} />
    </group>
  );
}

/** Zone name board: a dark panel with an emoji badge. */
function zoneSignTexture(emoji: string, text: string, accent: string) {
  const c = document.createElement("canvas");
  c.width = 640;
  c.height = 160;
  const g = c.getContext("2d")!;
  g.fillStyle = "#111827";
  g.beginPath();
  g.roundRect(4, 4, 632, 152, 28);
  g.fill();
  g.fillStyle = accent;
  g.beginPath();
  g.arc(82, 80, 54, 0, Math.PI * 2);
  g.fill();
  g.font = '64px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(emoji, 82, 86);
  let size = 62;
  const font = (s: number) => `800 ${s}px system-ui, "Segoe UI", "Noto Sans Thai", sans-serif`;
  g.font = font(size);
  while (size > 26 && g.measureText(text).width > 470) {
    size -= 2;
    g.font = font(size);
  }
  g.textAlign = "left";
  g.fillStyle = "#f8fafc";
  g.fillText(text, 156, 84);
  return finish(c, [1, 1]);
}

/** Name boards for the six working zones (the two in the old building stand on little posts). */
const ZONES: { id: ZoneId; emoji: string; sign: V3; posts?: number }[] = [
  { id: "engine", emoji: "⚙️", sign: [9.5, 1.6, 0.9], posts: 1.0 },
  { id: "social", emoji: "☕", sign: [-1.1, 1.85, 15.75], posts: 1.05 },
  { id: "labs", emoji: "🎨", sign: [12.7, 2.2, SOUTH.door] },
  { id: "pods", emoji: "🎧", sign: [4.5, 2.2, SOUTH.door] },
  { id: "fitness", emoji: "🧘", sign: [-4.0, 2.2, SOUTH.door] },
  { id: "hub", emoji: "📊", sign: [21.5, 2.2, SOUTH.door] },
];

function ZoneSign({ zone, text, accent }: { zone: (typeof ZONES)[number]; text: string; accent: string }) {
  const tex = useDisposable(() => zoneSignTexture(zone.emoji, text, accent), `zone:${zone.id}:${text}:${accent}`);
  return (
    <group position={zone.sign}>
      <mesh>
        <planeGeometry args={[1.8, 0.45]} />
        <meshBasicMaterial map={tex} transparent toneMapped={false} side={DoubleSide} />
      </mesh>
      {zone.posts !== undefined &&
        [-0.7, 0.7].map((x) => {
          const h = zone.sign[1] - 0.22 - zone.posts!;
          return <B key={x} s={[0.04, h, 0.04]} p={[x, -0.22 - h / 2, 0]} c="#374151" />;
        })}
    </group>
  );
}

/** Name boards over the six zones, in the current language. */
export function ZoneSigns({ lang, accent }: { lang: Lang; accent: string }) {
  return (
    <group>
      {ZONES.map((z) => (
        <ZoneSign key={z.id} zone={z} text={translate(lang, `zone.${z.id}` as Key)} accent={accent} />
      ))}
    </group>
  );
}

function PicnicBasket() {
  return (
    <group position={[19.8, 0.77, 11.3]}>
      <B s={[0.36, 0.2, 0.26]} p={[0, 0.1, 0]} c="#b5835a" />
      <B s={[0.38, 0.02, 0.28]} p={[0, 0.21, 0]} c="#ef4444" />
      <mesh position={[0, 0.3, 0]} rotation-x={Math.PI / 2}>
        <torusGeometry args={[0.12, 0.012, 6, 16, Math.PI]} />
        <meshStandardMaterial color="#8a5a32" />
      </mesh>
    </group>
  );
}

/** Slab, floors, walls, rooms and furniture. Re-renders only when the decoration settings change. */
export const OfficeFloor = memo(function OfficeFloor({ decor }: { decor: FloorDecor }) {
  const sky = useDisposable(() => skyTexture(decor.phase), `sky-${decor.phase}`);
  const { x0, x1, z0, z1 } = FLOOR;
  return (
    <StaticMerge>
      {/* building slab with a white edge, like a cut-away model */}
      <B s={[x1 - x0 + 0.3, 0.3, z1 - z0 + 0.3]} p={[(x0 + x1) / 2, -0.15, (z0 + z1) / 2]} c="#f5f5f4" />
      <Floor x0={x0} x1={EAST.x0} z0={CORRIDOR.z0} z1={CORRIDOR.z1} color={YELLOW} />

      <MeetingRoom sky={sky} />
      <Kitchen />
      <Lounge sky={sky} />
      <GameRoom />
      <ServerRoom />
      <Hall decor={decor} sky={sky} />

      {/* exterior walls: full height at the back, cut low at the front */}
      <Wall a={[x0, z0]} b={[x1, z0]} h={EXT_H} />
      <Wall a={[x0, z0]} b={[x0, LIFT.z0]} h={EXT_H} />
      <Wall a={[x0, LIFT.z1]} b={[x0, z1]} h={EXT_H} />
      <Elevator />
      <Wall a={[x0, z1]} b={[x1, z1]} h={0.3} />
      <Wall a={[x1, z0]} b={[x1, z1]} h={0.3} />
      {/* room dividers */}
      <Wall a={[MEETING.x1, z0]} b={[MEETING.x1, CORRIDOR.z0]} h={INT_H} />
      <Wall a={[LOUNGE.x0, z0]} b={[LOUNGE.x0, CORRIDOR.z0]} h={INT_H} color="#e7e3ee" />
      <Wall a={[LOUNGE.x1, z0]} b={[LOUNGE.x1, CORRIDOR.z0]} h={INT_H} color="#e7e3ee" />
      <Wall a={[GAME.x1, z0]} b={[GAME.x1, CORRIDOR.z0]} h={INT_H} />
      {/* glass fronts on the meeting room and lounge, the kitchen opens onto the corridor */}
      <GlassWall x0={MEETING.x0} x1={-3.9} z={CORRIDOR.z0} />
      <Door x0={-3.9} x1={-3.0} z={CORRIDOR.z0} />
      <GlassWall x0={-3.0} x1={MEETING.x1} z={CORRIDOR.z0} />
      <GlassWall x0={LOUNGE.x0} x1={3.4} z={CORRIDOR.z0} />
      <Door x0={3.4} x1={4.3} z={CORRIDOR.z0} />
      <GlassWall x0={4.3} x1={LOUNGE.x1} z={CORRIDOR.z0} />
      {/* the game room opens onto the corridor; the server room is behind glass */}
      <GlassWall x0={SERVER.x0} x1={13.4} z={CORRIDOR.z0} />
      <Door x0={13.4} x1={14.3} z={CORRIDOR.z0} />
      <GlassWall x0={14.3} x1={SERVER.x1} z={CORRIDOR.z0} />
      {/* low partition between the corridor and the hall, with four ways through */}
      <Wall a={[x0, CORRIDOR.z1]} b={[-5.6, CORRIDOR.z1]} h={1.0} />
      <Wall a={[-4.6, CORRIDOR.z1]} b={[-3.3, CORRIDOR.z1]} h={1.0} />
      <Wall a={[-2.3, CORRIDOR.z1]} b={[4.6, CORRIDOR.z1]} h={1.0} />
      <Wall a={[5.6, CORRIDOR.z1]} b={[13.4, CORRIDOR.z1]} h={1.0} />
      <Wall a={[14.4, CORRIDOR.z1]} b={[EAST.x0, CORRIDOR.z1]} h={1.0} />
      <EastWing decor={decor} />
      <DogThings />
      <SouthWing decor={decor} sky={sky} />
    </StaticMerge>
  );
});

// ---------- Elevator and time clock at the west end of the corridor ----------

const LIFT = { z0: -0.25, z1: 0.85 };

/** Elevator in the west wall; its doors slide open while someone is standing at it. */
function Elevator() {
  const left = useRef<Mesh>(null);
  const right = useRef<Mesh>(null);
  const lamp = useRef<MeshBasicMaterial>(null);
  const open = useRef(0);
  const half = (LIFT.z1 - LIFT.z0) / 2;
  useFrame((_, dt) => {
    let near = false;
    for (const w of walkers.values()) {
      if (w.phase.kind !== "seated" && Math.hypot(w.x + 7.4, w.z - 0.3) < 1.0) near = true;
    }
    open.current += ((near ? 1 : 0) - open.current) * Math.min(1, dt * 5);
    const w = half * (1 - open.current * 0.92);
    if (left.current) {
      left.current.scale.z = w / half;
      left.current.position.z = LIFT.z0 + w / 2;
    }
    if (right.current) {
      right.current.scale.z = w / half;
      right.current.position.z = LIFT.z1 - w / 2;
    }
    lamp.current?.color.set(near ? "#34d399" : "#3f3f46");
  });
  const x = FLOOR.x0;
  return (
    <group userData={DYNAMIC}>
      {/* the car behind the doors, lit warm */}
      <mesh position={[x - 0.06, 1.02, (LIFT.z0 + LIFT.z1) / 2]} rotation-y={Math.PI / 2}>
        <planeGeometry args={[LIFT.z1 - LIFT.z0, 2.05]} />
        <meshBasicMaterial color="#e9d8b4" />
      </mesh>
      {[LIFT.z0, LIFT.z1].map((z) => (
        <B key={z} s={[0.2, EXT_H, 0.12]} p={[x + 0.02, EXT_H / 2, z]} c="#9ca3af" metal={0.5} rough={0.35} />
      ))}
      <B s={[0.2, EXT_H - 2.1, LIFT.z1 - LIFT.z0 + 0.12]} p={[x + 0.02, (EXT_H + 2.1) / 2, (LIFT.z0 + LIFT.z1) / 2]} c="#9ca3af" metal={0.5} rough={0.35} />
      <mesh ref={left} position={[x + 0.04, 1.05, LIFT.z0 + half / 2]}>
        <boxGeometry args={[0.04, 2.08, half]} />
        <meshStandardMaterial color="#c7ccd1" metalness={0.7} roughness={0.25} />
      </mesh>
      <mesh ref={right} position={[x + 0.04, 1.05, LIFT.z1 - half / 2]}>
        <boxGeometry args={[0.04, 2.08, half]} />
        <meshStandardMaterial color="#c7ccd1" metalness={0.7} roughness={0.25} />
      </mesh>
      {/* floor indicator and call button */}
      <mesh position={[x + 0.13, 2.24, (LIFT.z0 + LIFT.z1) / 2]} rotation-y={Math.PI / 2}>
        <circleGeometry args={[0.07, 3]} />
        <meshBasicMaterial ref={lamp} color="#3f3f46" toneMapped={false} />
      </mesh>
      <B s={[0.03, 0.22, 0.1]} p={[x + 0.09, 1.1, LIFT.z0 - 0.22]} c="#d1d5db" metal={0.5} />
    </group>
  );
}

/** Live projector screen in the meeting room showing the task list. */
export function Projector({ lines, merging, lang }: { lines: BoardLine[]; merging: boolean; lang: Lang }) {
  const key = JSON.stringify([lines, merging, lang]);
  const tex = useDisposable(() => slideTexture(lines, merging, lang), key);
  return (
    <mesh position={[PROJECTOR.x, 1.35, PROJECTOR.z + 0.12]}>
      <planeGeometry args={[2.7, 1.52]} />
      <meshBasicMaterial map={tex} toneMapped={false} />
    </mesh>
  );
}

function Pizza({ p }: { p: V3 }) {
  return (
    <group position={p}>
      <B s={[0.42, 0.04, 0.42]} p={[0, 0.02, 0]} c="#d6b483" />
      <mesh position={[0, 0.05, 0]}>
        <cylinderGeometry args={[0.18, 0.18, 0.02, 20]} />
        <meshStandardMaterial color="#f59e0b" />
      </mesh>
      {[
        [0.07, 0.04],
        [-0.06, 0.07],
        [-0.04, -0.08],
        [0.08, -0.06],
      ].map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x, 0.065, z]}>
          <cylinderGeometry args={[0.03, 0.03, 0.01, 10]} />
          <meshStandardMaterial color="#b91c1c" />
        </mesh>
      ))}
    </group>
  );
}

function Cake({ p }: { p: V3 }) {
  const flames = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (flames.current) flames.current.scale.y = 1 + Math.sin(clock.elapsedTime * 20) * 0.25;
  });
  return (
    <group position={p}>
      <mesh position={[0, 0.08, 0]} castShadow>
        <cylinderGeometry args={[0.22, 0.22, 0.16, 24]} />
        <meshStandardMaterial color="#fbcfe8" />
      </mesh>
      <mesh position={[0, 0.2, 0]} castShadow>
        <cylinderGeometry args={[0.15, 0.15, 0.1, 24]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
      <group ref={flames}>
        {[-0.06, 0, 0.06].map((x) => (
          <group key={x} position={[x, 0.25, 0]}>
            <mesh position={[0, 0.04, 0]}>
              <cylinderGeometry args={[0.008, 0.008, 0.08, 6]} />
              <meshStandardMaterial color="#60a5fa" />
            </mesh>
            <mesh position={[0, 0.1, 0]}>
              <sphereGeometry args={[0.015, 8, 8]} />
              <meshBasicMaterial color="#fde047" toneMapped={false} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}

/** Red beacons flashing on the walls during the fire drill. */
function Beacons() {
  const lamps = useRef<(Mesh | null)[]>([]);
  useFrame(({ clock }) => {
    const on = Math.sin(clock.elapsedTime * 12) > 0;
    lamps.current.forEach((m, i) => {
      if (m) m.visible = i % 2 ? on : !on;
    });
  });
  const spots: V3[] = [
    [21, 2.2, -5.9],
    [-7.9, 2.2, -1.5],
    [-7.9, 2.2, 5.6],
    [-7.9, 2.2, 14.3],
    [0, 2.5, FLOOR.z0 + 0.1],
    [7, 2.5, FLOOR.z0 + 0.1],
    [14, 2.5, FLOOR.z0 + 0.1],
  ];
  return (
    <group>
      {spots.map((pos, i) => (
        <mesh
          key={i}
          position={pos}
          ref={(m) => {
            lamps.current[i] = m;
          }}
        >
          <sphereGeometry args={[0.16, 12, 12]} />
          <meshBasicMaterial color="#ef4444" toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

/** Blinking warning light on the jammed printer. */
function PrinterWarning() {
  const lamp = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    if (lamp.current) lamp.current.visible = Math.sin(clock.elapsedTime * 10) > 0;
  });
  return (
    <group position={[-5.0, 0, 15.45]}>
      <mesh ref={lamp} position={[0.15, 0.82, -0.2]}>
        <sphereGeometry args={[0.05, 10, 10]} />
        <meshBasicMaterial color="#ef4444" toneMapped={false} />
      </mesh>
      <B s={[0.3, 0.01, 0.38]} p={[0, 0.77, -0.12]} c="#ffffff" r={0.3} />
    </group>
  );
}

/** Lyrics TV and a spinning disco ball for karaoke in the lounge. */
function Karaoke() {
  const ball = useRef<Mesh>(null);
  const bar = useRef<Mesh>(null);
  const light = useRef<PointLight>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (ball.current) ball.current.rotation.y = t * 1.5;
    if (bar.current) {
      const k = (t * 0.35) % 1;
      bar.current.scale.x = Math.max(0.02, k);
      bar.current.position.z = -0.45 + (k * 0.9) / 2;
    }
    light.current?.color.setHSL((t * 0.2) % 1, 0.9, 0.6);
  });
  return (
    <group>
      <group position={[7.9, 1.35, -3.05]} rotation-y={-Math.PI / 2}>
        <B s={[1.25, 0.74, 0.05]} p={[0, 0, 0]} c="#111827" />
        <mesh position={[0, 0, 0.03]}>
          <planeGeometry args={[1.15, 0.64]} />
          <meshBasicMaterial color="#312e81" toneMapped={false} />
        </mesh>
        {[0.12, -0.04].map((y, i) => (
          <mesh key={y} position={[-0.05 * i, y, 0.035]}>
            <planeGeometry args={[0.9 - i * 0.2, 0.05]} />
            <meshBasicMaterial color="#e0e7ff" toneMapped={false} />
          </mesh>
        ))}
      </group>
      {/* the sung part of the line lights up */}
      <mesh ref={bar} position={[7.86, 1.47, -3.05]} rotation-y={-Math.PI / 2}>
        <planeGeometry args={[0.9, 0.05]} />
        <meshBasicMaterial color="#f472b6" toneMapped={false} />
      </mesh>
      <group position={[5.5, 0, -2.45]}>
        <mesh position={[0, 0.6, 0]}>
          <cylinderGeometry args={[0.015, 0.015, 1.2, 8]} />
          <meshStandardMaterial color="#374151" />
        </mesh>
        <mesh position={[0, 1.22, 0.04]}>
          <sphereGeometry args={[0.05, 12, 10]} />
          <meshStandardMaterial color="#6b7280" metalness={0.6} />
        </mesh>
      </group>
      <mesh ref={ball} position={[5.5, 1.75, -3.1]}>
        <icosahedronGeometry args={[0.16, 1]} />
        <meshStandardMaterial color="#e5e7eb" metalness={0.9} roughness={0.15} flatShading />
      </mesh>
      <pointLight ref={light} position={[5.5, 1.6, -3.1]} intensity={6} distance={5} decay={1.6} />
    </group>
  );
}

function IceCreamCart() {
  return (
    <group position={[10.7, 0, 14.4]}>
      <B s={[0.9, 0.7, 0.55]} p={[0, 0.45, 0]} c="#fbcfe8" />
      <B s={[0.92, 0.1, 0.57]} p={[0, 0.82, 0]} c="#ffffff" />
      {[-0.3, 0.3].map((x) => (
        <mesh key={x} position={[x, 0.1, 0.28]} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.1, 0.1, 0.04, 16]} />
          <meshStandardMaterial color="#374151" />
        </mesh>
      ))}
      {["#fde68a", "#a7f3d0", "#fca5a5"].map((c, i) => (
        <group key={c} position={[-0.25 + i * 0.25, 0.92, 0]}>
          <mesh position={[0, 0, 0]} rotation-x={Math.PI}>
            <coneGeometry args={[0.05, 0.14, 10]} />
            <meshStandardMaterial color="#d6a35c" />
          </mesh>
          <mesh position={[0, 0.09, 0]}>
            <sphereGeometry args={[0.06, 12, 10]} />
            <meshStandardMaterial color={c} />
          </mesh>
        </group>
      ))}
      <mesh position={[0.35, 1.3, -0.15]}>
        <cylinderGeometry args={[0.015, 0.015, 1.0, 6]} />
        <meshStandardMaterial color="#6b7280" />
      </mesh>
      <mesh position={[0.35, 1.85, -0.15]}>
        <coneGeometry args={[0.6, 0.3, 16, 1, true]} />
        <meshStandardMaterial color="#f472b6" side={DoubleSide} />
      </mesh>
    </group>
  );
}

function Parcels() {
  return (
    <group position={[-6.9, 0, 0.66]}>
      <B s={[0.42, 0.3, 0.3]} p={[0, 0.15, 0]} c="#c8a26b" />
      <B s={[0.3, 0.24, 0.26]} p={[0.05, 0.42, 0]} c="#d6b483" r={0.3} />
      <B s={[0.43, 0.02, 0.06]} p={[0, 0.3, 0]} c="#9a7a4c" />
    </group>
  );
}

/** A film plays on the town hall screen. */
function MovieScreen() {
  const screen = useRef<MeshBasicMaterial>(null);
  const blobs = useRef<(Mesh | null)[]>([]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    screen.current?.color.setHSL((0.6 + Math.sin(t * 0.3) * 0.1 + 1) % 1, 0.55, 0.28);
    blobs.current.forEach((m, i) => {
      if (m) m.position.x = Math.sin(t * (0.6 + i * 0.25) + i * 2) * 1.4;
    });
  });
  return (
    <group position={[21, 1.75, 1.45]}>
      <mesh>
        <planeGeometry args={[4.1, 1.6]} />
        <meshBasicMaterial ref={screen} color="#1e3a8a" toneMapped={false} />
      </mesh>
      {["#fde68a", "#f9a8d4", "#a7f3d0"].map((c, i) => (
        <mesh
          key={c}
          ref={(m) => {
            blobs.current[i] = m;
          }}
          position={[0, -0.35 + i * 0.3, 0.01]}
        >
          <circleGeometry args={[0.16 + i * 0.04, 24]} />
          <meshBasicMaterial color={c} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

/** Props that appear while an office event is running. */
export function EventProps({ kind }: { kind: string | null }) {
  if (kind === "pizza") {
    return (
      <group>
        <Pizza p={[-1.1, 0.93, -3.4]} />
        <Pizza p={[-0.1, 0.93, -3.4]} />
        <Pizza p={[-1.6, 0.78, -1.35]} />
        <Pizza p={[1.8, 0.78, -1.35]} />
      </group>
    );
  }
  if (kind === "birthday") return <Cake p={[5.5, 0.39, -3.0]} />;
  if (kind === "drill") return <Beacons />;
  if (kind === "printer") return <PrinterWarning />;
  if (kind === "karaoke") return <Karaoke />;
  if (kind === "icecream") return <IceCreamCart />;
  if (kind === "delivery") return <Parcels />;
  if (kind === "movie") return <MovieScreen />;
  if (kind === "picnic") return <PicnicBasket />;
  return null;
}
