"use client";

import { useFrame } from "@react-three/fiber";
import { memo, useRef, useState } from "react";
import { CanvasTexture, type Group, type Mesh, type MeshBasicMaterial, RepeatWrapping, SRGBColorSpace, type Texture } from "three";
import { currentEventKind } from "./office-events";
import { clip, reducedMotion, seeded, useDisposable } from "./scene-utils";

export type BoardLine = { text: string; status: "queued" | "working" | "done" | "error" };
type V3 = [number, number, number];

// ---------- Floor plan (metres, y up). The camera looks from +x/+z, so the north (-z) and
// west (-x) walls are full height and the south/east walls are cut away like a dollhouse. ----------

export const FLOOR = { x0: -8, x1: 16, z0: -6, z1: 6 };
export const CORRIDOR = { z0: -0.3, z1: 0.9 };
const MEETING = { x0: -8, x1: -2.6 };
const KITCHEN = { x0: -2.6, x1: 3 };
const LOUNGE = { x0: 3, x1: 8 };
const GAME = { x0: 8, x1: 12.2 };
const SERVER = { x0: 12.2, x1: 16 };
export const WORKSPACE = { z0: CORRIDOR.z1, z1: FLOOR.z1 };
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

export function skyTexture() {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const g = c.getContext("2d")!;
  const grad = g.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, "#9fd8f5");
  grad.addColorStop(1, "#e6f6ff");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = "rgba(255,255,255,0.5)";
  g.fillRect(0, 70, 128, 4);
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
function slideTexture(lines: BoardLine[], merging: boolean) {
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
  g.fillText(merging ? "Final review: merging results" : "Sprint board: today's tasks", 40, 64);
  if (lines.length === 0) {
    g.fillStyle = "#6b7280";
    g.font = `500 40px ${font}`;
    g.fillText("Assign a task below to get started", 150, 320);
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
  g.fillText("presented by Max · Manager", 720, 552);
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

function Armchair({ p, r = 0 }: { p: V3; r?: number }) {
  return (
    <group position={p} rotation-y={r}>
      <B s={[0.8, 0.4, 0.8]} p={[0, 0.2, 0]} c="#1f2328" rough={0.6} />
      <B s={[0.8, 0.55, 0.2]} p={[0, 0.6, -0.3]} c="#1f2328" rough={0.6} />
      <B s={[0.16, 0.5, 0.8]} p={[-0.36, 0.4, 0]} c="#1f2328" rough={0.6} />
      <B s={[0.16, 0.5, 0.8]} p={[0.36, 0.4, 0]} c="#1f2328" rough={0.6} />
    </group>
  );
}

export function PalmPlant({ p, s = 1 }: { p: V3; s?: number }) {
  const leaves = useRef<Group>(null);
  const [still] = useState(reducedMotion);
  useFrame(({ clock }) => {
    if (!leaves.current || still) return;
    const t = clock.elapsedTime + p[0];
    leaves.current.rotation.z = Math.sin(t * 0.9) * 0.05;
    leaves.current.rotation.x = Math.sin(t * 0.7) * 0.04;
  });
  return (
    <group position={p} scale={s}>
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
  const [still] = useState(reducedMotion);
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
    <group position={p}>
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

function Workspace({ sky }: { sky: Texture }) {
  const tiles = useDisposable(() => tileTexture("#e9ebee", "#d7dadf", [8, 3]), "work-floor");
  return (
    <group>
      <Floor x0={FLOOR.x0} x1={FLOOR.x1} z0={WORKSPACE.z0} z1={WORKSPACE.z1} map={tiles} />
      {/* printer + water cooler */}
      <group position={[FLOOR.x0 + 0.5, 0, 1.6]}>
        <B s={[0.6, 0.6, 0.5]} p={[0, 0.3, 0]} c="#d1d5db" />
        <B s={[0.55, 0.15, 0.45]} p={[0, 0.68, 0]} c="#e5e7eb" />
      </group>
      <group position={[FLOOR.x1 - 0.5, 0, 1.6]}>
        <B s={[0.35, 1.0, 0.35]} p={[0, 0.5, 0]} c="#f5f5f4" />
        <mesh position={[0, 1.2, 0]}>
          <cylinderGeometry args={[0.15, 0.15, 0.4, 16]} />
          <meshStandardMaterial color="#93c5fd" transparent opacity={0.7} />
        </mesh>
      </group>
      {/* ping-pong table on the left */}
      <group position={[-6.0, 0, 3.7]}>
        <B s={[1.5, 0.05, 2.6]} p={[0, 0.74, 0]} c="#1f7a4d" rough={0.5} />
        <B s={[1.5, 0.01, 0.03]} p={[0, 0.77, 0]} c="#ffffff" />
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
      {/* breakout corner on the right: round table and beanbags */}
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
      <PalmPlant p={[FLOOR.x0 + 0.55, 0, FLOOR.z1 - 0.55]} s={1.1} />
      <PalmPlant p={[FLOOR.x1 - 0.55, 0, FLOOR.z1 - 0.6]} />
      <WindowPane p={[FLOOR.x0 + 0.09, 1.5, 2.5]} r={Math.PI / 2} w={1.4} h={1.1} sky={sky} />
      <WindowPane p={[FLOOR.x0 + 0.09, 1.5, 4.6]} r={Math.PI / 2} w={1.4} h={1.1} sky={sky} />
      <Art p={[FLOOR.x0 + 0.09, 1.45, 3.55]} r={Math.PI / 2} seed={11} w={0.6} h={0.5} />
    </group>
  );
}

function neonTexture() {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 128;
  const g = c.getContext("2d")!;
  g.font = '800 84px system-ui, "Segoe UI", sans-serif';
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.shadowColor = "#f0abfc";
  g.shadowBlur = 24;
  g.fillStyle = "#fdf4ff";
  g.fillText("GAME ON", 256, 68);
  return finish(c, [1, 1]);
}

/** Arcade cabinet whose screen flickers through colours. */
function Arcade({ p, hue }: { p: V3; hue: number }) {
  const screen = useRef<MeshBasicMaterial>(null);
  const [still] = useState(reducedMotion);
  useFrame(({ clock }) => {
    if (!screen.current || still) return;
    const t = clock.elapsedTime * (currentEventKind() === "arcade" ? 4 : 1.2) + hue;
    screen.current.color.setHSL((hue + Math.sin(t) * 0.08 + 1) % 1, 0.8, 0.45 + Math.sin(t * 3) * 0.1);
  });
  return (
    <group position={p}>
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
      <Arcade p={[9.0, 0, -5.55]} hue={0.78} />
      <Arcade p={[10.05, 0, -5.55]} hue={0.52} />
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

/** Server racks with blinking LEDs; they flash red during a server alarm. */
function ServerRack({ p, seed }: { p: V3; seed: number }) {
  const leds = useRef<(MeshBasicMaterial | null)[]>([]);
  const [still] = useState(reducedMotion);
  useFrame(({ clock }) => {
    const alarm = currentEventKind() === "server";
    const t = clock.elapsedTime;
    leds.current.forEach((m, i) => {
      if (!m) return;
      const on = still ? true : Math.sin(t * (alarm ? 12 : 3 + (i % 4)) + i * 1.7 + seed) > (alarm ? -0.2 : 0.1);
      m.color.set(alarm ? (on ? "#ef4444" : "#450a0a") : on ? (i % 3 ? "#34d399" : "#60a5fa") : "#052e16");
    });
  });
  return (
    <group position={p}>
      <B s={[0.7, 2.0, 0.9]} p={[0, 1.0, 0]} c="#111827" rough={0.4} metal={0.3} />
      {Array.from({ length: 12 }, (_, i) => (
        <mesh key={i} position={[-0.22 + (i % 3) * 0.22, 0.4 + Math.floor(i / 3) * 0.4, 0.455]}>
          <planeGeometry args={[0.12, 0.04]} />
          <meshBasicMaterial
            ref={(m) => {
              leds.current[i] = m;
            }}
            color="#34d399"
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}

function ServerRoom() {
  const tiles = useDisposable(() => tileTexture("#d6dbe1", "#b8c0c9", [4, 5]), "server-floor");
  const { x0, x1 } = SERVER;
  return (
    <group>
      <Floor x0={x0} x1={x1} z0={FLOOR.z0} z1={CORRIDOR.z0} map={tiles} />
      <ServerRack p={[13.0, 0, -5.45]} seed={1} />
      <ServerRack p={[14.0, 0, -5.45]} seed={2} />
      <ServerRack p={[15.0, 0, -5.45]} seed={3} />
      {/* cooling unit */}
      <B s={[0.5, 1.6, 0.6]} p={[15.6, 0.8, -2.0]} c="#e5e7eb" />
      <B s={[0.02, 1.2, 0.45]} p={[15.34, 0.9, -2.0]} c="#9ca3af" />
      <Art p={[x0 + 0.09, 1.45, -2.4]} r={Math.PI / 2} seed={5} w={0.6} h={0.45} />
    </group>
  );
}

/** Everything that never changes: slab, floors, walls, rooms and furniture. */
export const OfficeFloor = memo(function OfficeFloor() {
  const sky = useDisposable(skyTexture, "sky");
  const { x0, x1, z0, z1 } = FLOOR;
  return (
    <group>
      {/* building slab with a white edge, like a cut-away model */}
      <B s={[x1 - x0 + 0.3, 0.3, z1 - z0 + 0.3]} p={[(x0 + x1) / 2, -0.15, (z0 + z1) / 2]} c="#f5f5f4" />
      <Floor x0={x0} x1={x1} z0={CORRIDOR.z0} z1={CORRIDOR.z1} color={YELLOW} />

      <MeetingRoom sky={sky} />
      <Kitchen />
      <Lounge sky={sky} />
      <GameRoom />
      <ServerRoom />
      <Workspace sky={sky} />

      {/* exterior walls: full height at the back, cut low at the front */}
      <Wall a={[x0, z0]} b={[x1, z0]} h={EXT_H} />
      <Wall a={[x0, z0]} b={[x0, z1]} h={EXT_H} />
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
      {/* low partition between the corridor and the open workspace */}
      <Wall a={[x0, CORRIDOR.z1]} b={[-5.6, CORRIDOR.z1]} h={1.0} />
      <Wall a={[-4.6, CORRIDOR.z1]} b={[4.6, CORRIDOR.z1]} h={1.0} />
      <Wall a={[5.6, CORRIDOR.z1]} b={[13.4, CORRIDOR.z1]} h={1.0} />
      <Wall a={[14.4, CORRIDOR.z1]} b={[x1, CORRIDOR.z1]} h={1.0} />
    </group>
  );
});

/** Live projector screen in the meeting room showing the task list. */
export function Projector({ lines, merging }: { lines: BoardLine[]; merging: boolean }) {
  const key = JSON.stringify([lines, merging]);
  const tex = useDisposable(() => slideTexture(lines, merging), key);
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
    [-7.9, 2.2, -1.5],
    [-7.9, 2.2, 3.5],
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
    <group position={[FLOOR.x0 + 0.5, 0, 1.6]}>
      <mesh ref={lamp} position={[0.15, 0.82, 0.2]}>
        <sphereGeometry args={[0.05, 10, 10]} />
        <meshBasicMaterial color="#ef4444" toneMapped={false} />
      </mesh>
      <B s={[0.3, 0.01, 0.38]} p={[0, 0.77, 0.12]} c="#ffffff" r={0.3} />
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
  return null;
}
