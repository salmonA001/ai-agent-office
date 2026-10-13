"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import {
  CanvasTexture,
  DoubleSide,
  type Group,
  type Mesh,
  type MeshBasicMaterial,
  type PointLight,
  Quaternion,
  RepeatWrapping,
  SRGBColorSpace,
  type Texture,
  Vector3,
} from "three";
import type { Phase } from "@/lib/office-custom";
import { useStill } from "@/lib/motion";
import { Beacons, Skyline } from "./city";
import { COURTYARD, isPresent, ROOF_Y, WING } from "./office-nav";
import { rgbMaterials } from "./rgb";
import { seeded, useDisposable } from "./scene-utils";
import { DYNAMIC, StaticMerge } from "./static-merge";

type V3 = [number, number, number];

/** Roof footprint (matches the building below); the garden courtyard stays open to the sky. */
const ROOF = { x0: -8, x1: 26, z0: -6, z1: 24 };
const COURT = COURTYARD;
const Y = ROOF_Y;

function B({ s, p, c, r = 0, rough = 0.7, metal = 0 }: { s: V3; p: V3; c: string; r?: number; rough?: number; metal?: number }) {
  return (
    <mesh position={p} rotation-y={r} castShadow receiveShadow>
      <boxGeometry args={s} />
      <meshStandardMaterial color={c} roughness={rough} metalness={metal} />
    </mesh>
  );
}

function Plane({ x0, x1, z0, z1, y = 0.005, color = "#ffffff", map }: { x0: number; x1: number; z0: number; z1: number; y?: number; color?: string; map?: Texture }) {
  return (
    <mesh rotation-x={-Math.PI / 2} position={[(x0 + x1) / 2, Y + y, (z0 + z1) / 2]} receiveShadow>
      <planeGeometry args={[x1 - x0, z1 - z0]} />
      <meshStandardMaterial color={color} map={map} roughness={0.85} />
    </mesh>
  );
}

function texture(draw: (g: CanvasRenderingContext2D, size: number) => void, repeat: [number, number], size = 128) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  draw(c.getContext("2d")!, size);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.repeat.set(repeat[0], repeat[1]);
  return tex;
}

const gravel = (repeat: [number, number]) =>
  texture((g, n) => {
    const rnd = seeded(5);
    g.fillStyle = "#c9c6bf";
    g.fillRect(0, 0, n, n);
    for (let i = 0; i < 900; i++) {
      g.fillStyle = ["#b7b3ab", "#d8d5ce", "#a8a49c"][i % 3];
      g.fillRect(rnd() * n, rnd() * n, 2, 2);
    }
  }, repeat);

const planks = (repeat: [number, number]) =>
  texture((g, n) => {
    const rnd = seeded(9);
    for (let i = 0; i < 8; i++) {
      g.fillStyle = `hsl(28, 40%, ${46 + rnd() * 10}%)`;
      g.fillRect(0, (i * n) / 8, n, n / 8);
      g.fillStyle = "rgba(0,0,0,0.25)";
      g.fillRect(0, (i * n) / 8, n, 1.5);
    }
  }, repeat);

const turf = (repeat: [number, number]) =>
  texture((g, n) => {
    const rnd = seeded(13);
    g.fillStyle = "#6fae5a";
    g.fillRect(0, 0, n, n);
    for (let i = 0; i < 700; i++) {
      g.fillStyle = rnd() > 0.5 ? "#7fbf68" : "#5f9a4c";
      g.fillRect(rnd() * n, rnd() * n, 1.5, 3);
    }
  }, repeat);

const solarCells = () =>
  texture((g, n) => {
    g.fillStyle = "#1e3a8a";
    g.fillRect(0, 0, n, n);
    g.strokeStyle = "#93c5fd";
    g.lineWidth = 1.5;
    for (let i = 0; i <= 8; i++) {
      g.beginPath();
      g.moveTo((i * n) / 8, 0);
      g.lineTo((i * n) / 8, n);
      g.moveTo(0, (i * n) / 4);
      g.lineTo(n, (i * n) / 4);
      g.stroke();
    }
  }, [6, 1]);

/** Glass balustrade along x (or along z), so you can see out over the edge. */
function Railing({ a, b, at, alongZ = false }: { a: number; b: number; at: number; alongZ?: boolean }) {
  const len = b - a;
  const mid = (a + b) / 2;
  const posts = Math.max(1, Math.round(len / 2));
  const P = (u: number, y: number): V3 => (alongZ ? [at, Y + y, u] : [u, Y + y, at]);
  const S = (l: number, h: number, w: number): V3 => (alongZ ? [w, h, l] : [l, h, w]);
  return (
    <group>
      <mesh position={P(mid, 0.52)}>
        <boxGeometry args={S(len, 0.9, 0.03)} />
        <meshStandardMaterial color="#cdeaf5" transparent opacity={0.25} depthWrite={false} roughness={0.05} />
      </mesh>
      <B s={S(len, 0.05, 0.08)} p={P(mid, 1.0)} c="#9aa3ab" metal={0.6} rough={0.3} />
      {Array.from({ length: posts + 1 }, (_, i) => (
        <B key={i} s={S(0.05, 1.0, 0.05)} p={P(a + (i * len) / posts, 0.5)} c="#9aa3ab" metal={0.6} rough={0.3} />
      ))}
    </group>
  );
}

function Lounger({ x, z, color }: { x: number; z: number; color: string }) {
  return (
    <group position={[x, Y, z]}>
      <B s={[0.6, 0.22, 1.6]} p={[0, 0.2, 0]} c="#f8fafc" />
      <group position={[0, 0.3, -0.6]} rotation-x={-0.6}>
        <B s={[0.6, 0.06, 0.6]} p={[0, 0, 0.2]} c={color} />
      </group>
      <B s={[0.56, 0.04, 1.0]} p={[0, 0.33, 0.25]} c={color} />
    </group>
  );
}

function PottedTree({ p, s = 1 }: { p: V3; s?: number }) {
  return (
    <group position={p} scale={s}>
      <B s={[0.7, 0.5, 0.7]} p={[0, 0.25, 0]} c="#57534e" />
      <mesh position={[0, 0.9, 0]}>
        <cylinderGeometry args={[0.06, 0.09, 0.9, 8]} />
        <meshStandardMaterial color="#7c5a3a" />
      </mesh>
      <mesh position={[0, 1.55, 0]} castShadow>
        <icosahedronGeometry args={[0.55, 1]} />
        <meshStandardMaterial color="#4c9a52" flatShading />
      </mesh>
    </group>
  );
}

function RaisedBed({ x, z, colors }: { x: number; z: number; colors: string[] }) {
  return (
    <group position={[x, Y, z]}>
      <B s={[2.0, 0.45, 0.8]} p={[0, 0.225, 0]} c="#8a5a3a" />
      <B s={[1.9, 0.02, 0.7]} p={[0, 0.455, 0]} c="#4a3426" />
      {Array.from({ length: 8 }, (_, i) => (
        <mesh key={i} position={[-0.8 + i * 0.23, 0.56 + (i % 2) * 0.04, (i % 2) * 0.16 - 0.08]}>
          <sphereGeometry args={[0.12, 8, 6]} />
          <meshStandardMaterial color={colors[i % colors.length]} />
        </mesh>
      ))}
    </group>
  );
}

function Bench({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, Y, z + 0.2]}>
      <B s={[1.4, 0.06, 0.45]} p={[0, 0.45, 0]} c="#b07a4a" />
      <B s={[1.4, 0.4, 0.06]} p={[0, 0.7, 0.21]} c="#b07a4a" />
      {[-0.6, 0.6].map((dx) => (
        <B key={dx} s={[0.06, 0.45, 0.4]} p={[dx, 0.22, 0]} c="#374151" />
      ))}
    </group>
  );
}

/** Fire pit: stone ring with flickering flames (lit after dark, embers by day). */
function FirePit({ glow }: { glow: boolean }) {
  const flames = useRef<Group>(null);
  const still = useStill();
  useFrame(({ clock }) => {
    const g = flames.current;
    if (!g || still) return;
    const t = clock.elapsedTime;
    g.children.forEach((f, i) => {
      f.scale.y = 0.8 + Math.sin(t * 9 + i * 2.1) * 0.25 + Math.sin(t * 13 + i) * 0.1;
    });
  });
  return (
    <group position={[19.5, Y, 20.5]}>
      <mesh position={[0, 0.15, 0]}>
        <cylinderGeometry args={[0.5, 0.55, 0.3, 16]} />
        <meshStandardMaterial color="#78716c" roughness={1} />
      </mesh>
      <mesh position={[0, 0.305, 0]} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[0.38, 16]} />
        <meshStandardMaterial color="#1c1917" />
      </mesh>
      <group ref={flames} position={[0, 0.3, 0]} userData={DYNAMIC}>
        {[-0.12, 0.1, 0].map((x, i) => (
          <mesh key={i} position={[x, 0.15, i === 2 ? 0.1 : -0.05]}>
            <coneGeometry args={[0.12 - i * 0.02, 0.4, 8]} />
            <meshBasicMaterial color={glow ? ["#f97316", "#fbbf24", "#ef4444"][i] : ["#fb923c", "#fcd34d", "#f87171"][i]} transparent opacity={0.9} toneMapped={false} />
          </mesh>
        ))}
      </group>
      {glow && <pointLight position={[0, 0.8, 0]} color="#ff9a3c" intensity={5} distance={5} decay={1.6} />}
      {/* stools for the two fire-side seats */}
      {[-1.1, 1.1].map((dx) => (
        <mesh key={dx} position={[dx, 0.21, 0]}>
          <cylinderGeometry args={[0.2, 0.22, 0.42, 12]} />
          <meshStandardMaterial color="#a16207" />
        </mesh>
      ))}
    </group>
  );
}

/** Red aircraft-warning light on top of the antenna. */
function Antenna() {
  const light = useRef<MeshBasicMaterial>(null);
  useFrame(({ clock }) => light.current?.color.set(clock.elapsedTime % 1.6 < 0.4 ? "#ef4444" : "#3f0d0d"));
  return (
    <group position={[25, Y, -5]}>
      <mesh position={[0, 1.6, 0]}>
        <cylinderGeometry args={[0.03, 0.06, 3.2, 6]} />
        <meshStandardMaterial color="#9ca3af" metalness={0.7} />
      </mesh>
      <mesh position={[0, 3.25, 0]} userData={DYNAMIC}>
        <sphereGeometry args={[0.08, 10, 8]} />
        <meshBasicMaterial ref={light} color="#ef4444" toneMapped={false} />
      </mesh>
    </group>
  );
}

/** HVAC unit with a spinning fan on top. */
function Hvac({ p, s }: { p: V3; s: [number, number] }) {
  const fan = useRef<Group>(null);
  const still = useStill();
  useFrame((_, dt) => {
    if (fan.current && !still) fan.current.rotation.y += dt * 6;
  });
  return (
    <group position={p}>
      <B s={[s[0], 0.9, s[1]]} p={[0, 0.45, 0]} c="#d1d5db" metal={0.3} rough={0.5} />
      {Array.from({ length: 5 }, (_, i) => (
        <B key={i} s={[s[0] + 0.01, 0.03, 0.02]} p={[0, 0.2 + i * 0.12, s[1] / 2]} c="#9ca3af" />
      ))}
      <mesh position={[0, 0.905, 0]} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[Math.min(...s) * 0.38, 20]} />
        <meshStandardMaterial color="#1f2937" />
      </mesh>
      <group ref={fan} position={[0, 0.92, 0]} userData={DYNAMIC}>
        {[0, 1, 2].map((i) => (
          <mesh key={i} rotation-y={(i * Math.PI * 2) / 3}>
            <boxGeometry args={[Math.min(...s) * 0.66, 0.01, 0.1]} />
            <meshStandardMaterial color="#6b7280" />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/** Puffy clouds drifting past the building, and a few birds circling over the courtyard. */
function Sky({ phase }: { phase: Phase }) {
  const clouds = useRef<Group>(null);
  const birds = useRef<Group>(null);
  const still = useStill();
  const color = phase === "night" ? "#8a93b8" : phase === "sunset" ? "#ffd8c2" : "#ffffff";
  useFrame(({ clock }) => {
    if (still) return;
    const t = clock.elapsedTime;
    clouds.current?.children.forEach((c, i) => {
      // clouds behind the building drift east, the ones off the west side drift south; both wrap round
      const u = (((t * (0.25 + (i % 3) * 0.06) + i * 13) % 40) + 40) % 40;
      if (i < 4) c.position.x = u - 12;
      else c.position.z = u - 10;
    });
    birds.current?.children.forEach((b, i) => {
      const a = t * 0.35 + (i * Math.PI * 2) / 3;
      b.position.set(21 + Math.cos(a) * 4, Y + 4.5 + Math.sin(t + i) * 0.3, 12.4 + Math.sin(a) * 3);
      b.rotation.y = -a;
      b.children.forEach((w, k) => (w.rotation.z = (k ? -1 : 1) * (0.3 + Math.sin(t * 8 + i) * 0.35)));
    });
  });
  const puffs: [number, number, number][] = [
    [0, 0, 0.9],
    [0.8, 0.2, 0.7],
    [-0.8, 0.1, 0.65],
    [0.3, 0.5, 0.6],
  ];
  return (
    <group userData={DYNAMIC}>
      <group ref={clouds}>
        {[
          [-9, Y + 3.5, -10],
          [5, Y + 5, -11],
          [20, Y + 4, -10.5],
          [30, Y + 3, -9],
          [-14, Y + 2.5, 2],
          [-15, Y + 4, 18],
        ].map(([x, y, z], i) => (
          <group key={i} position={[x, y, z]} scale={1 + (i % 3) * 0.35}>
            {puffs.map(([px, py, r], k) => (
              <mesh key={k} position={[px, py, 0]}>
                <sphereGeometry args={[r, 12, 10]} />
                <meshStandardMaterial color={color} roughness={1} />
              </mesh>
            ))}
          </group>
        ))}
      </group>
      <group ref={birds}>
        {[0, 1, 2].map((i) => (
          <group key={i}>
            {[0, 1].map((k) => (
              <mesh key={k} position={[k ? 0.14 : -0.14, 0, 0]}>
                <boxGeometry args={[0.28, 0.02, 0.07]} />
                <meshBasicMaterial color="#334155" />
              </mesh>
            ))}
          </group>
        ))}
      </group>
    </group>
  );
}

/** Raised rooftop pool: tiled walls with a white coping, steps on the south side, rippling water. */
function Pool() {
  const water = useRef<MeshBasicMaterial>(null);
  const still = useStill();
  const tiles = useDisposable(
    () =>
      texture((g, n) => {
        g.fillStyle = "#7dd3fc";
        g.fillRect(0, 0, n, n);
        g.strokeStyle = "#e0f2fe";
        g.lineWidth = 2;
        for (let i = 0; i <= 8; i++) {
          g.beginPath();
          g.moveTo((i * n) / 8, 0);
          g.lineTo((i * n) / 8, n);
          g.moveTo(0, (i * n) / 8);
          g.lineTo(n, (i * n) / 8);
          g.stroke();
        }
      }, [3, 2]),
    "pool-tiles",
  );
  const ripple = useDisposable(
    () =>
      texture((g, n) => {
        g.fillStyle = "#38bdf8";
        g.fillRect(0, 0, n, n);
        const rnd = seeded(3);
        g.strokeStyle = "rgba(255,255,255,0.45)";
        g.lineWidth = 2;
        for (let i = 0; i < 14; i++) {
          const x = rnd() * n;
          const y = rnd() * n;
          g.beginPath();
          g.ellipse(x, y, 10 + rnd() * 14, 3, rnd(), 0, Math.PI * 1.2);
          g.stroke();
        }
      }, [3, 2]),
    "pool-ripple",
  );
  useFrame(({ clock }) => {
    const m = water.current;
    if (!m?.map || still) return;
    m.map.offset.set(Math.sin(clock.elapsedTime * 0.3) * 0.05, clock.elapsedTime * 0.02);
  });
  const x0 = 18;
  const x1 = 24;
  const z0 = 1.5;
  const z1 = 6;
  const h = 0.6;
  const wall = (s: V3, p: V3) => <B s={s} p={p} c="#e0f2fe" rough={0.4} />;
  return (
    <group>
      {/* pool deck */}
      <Plane x0={15.8} x1={25.8} z0={0.6} z1={7.2} color="#efe9df" y={0.012} />
      <mesh rotation-x={-Math.PI / 2} position={[(x0 + x1) / 2, Y + 0.02, (z0 + z1) / 2]}>
        <planeGeometry args={[x1 - x0, z1 - z0]} />
        <meshStandardMaterial map={tiles} roughness={0.3} />
      </mesh>
      {wall([0.15, h, z1 - z0], [x0, Y + h / 2, (z0 + z1) / 2])}
      {wall([0.15, h, z1 - z0], [x1, Y + h / 2, (z0 + z1) / 2])}
      {wall([x1 - x0, h, 0.15], [(x0 + x1) / 2, Y + h / 2, z0])}
      {wall([20.6 - x0, h, 0.15], [(x0 + 20.6) / 2, Y + h / 2, z1])}
      {wall([x1 - 21.4, h, 0.15], [(21.4 + x1) / 2, Y + h / 2, z1])}
      {/* white coping round the top */}
      <B s={[x1 - x0 + 0.3, 0.05, 0.3]} p={[(x0 + x1) / 2, Y + h + 0.02, z0]} c="#ffffff" rough={0.5} />
      <B s={[0.3, 0.05, z1 - z0]} p={[x0, Y + h + 0.02, (z0 + z1) / 2]} c="#ffffff" rough={0.5} />
      <B s={[0.3, 0.05, z1 - z0]} p={[x1, Y + h + 0.02, (z0 + z1) / 2]} c="#ffffff" rough={0.5} />
      {/* steps in and out */}
      <B s={[0.8, 0.2, 0.35]} p={[21, Y + 0.1, z1 + 0.32]} c="#f1f5f9" />
      <B s={[0.8, 0.4, 0.2]} p={[21, Y + 0.2, z1 + 0.05]} c="#f1f5f9" />
      {[20.55, 21.45].map((x) => (
        <mesh key={x} position={[x, Y + 0.7, z1]}>
          <cylinderGeometry args={[0.02, 0.02, 0.6, 6]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.8} roughness={0.2} />
        </mesh>
      ))}
      <mesh rotation-x={-Math.PI / 2} position={[(x0 + x1) / 2, Y + 0.5, (z0 + z1) / 2]} userData={DYNAMIC}>
        <planeGeometry args={[x1 - x0 - 0.15, z1 - z0 - 0.15]} />
        <meshBasicMaterial ref={water} map={ripple} transparent opacity={0.6} depthWrite={false} toneMapped={false} />
      </mesh>
      <Lounger x={16.9} z={2.6} color="#22d3ee" />
      <Lounger x={16.9} z={4.4} color="#fbbf24" />
      <PottedTree p={[25.3, Y, 1.0]} s={0.85} />
    </group>
  );
}

/** Pool party extras: rings and a flamingo bobbing on the water, a beach ball tossed between the
 * swimmers, bunting over the pool and a cooler. Only there while the party is on. */
function PoolParty({ on }: { on: boolean }) {
  const floats = useRef<Group>(null);
  const ball = useRef<Group>(null);
  const still = useStill();
  useFrame(({ clock }) => {
    if (!on) return;
    const t = still ? 0 : clock.elapsedTime;
    floats.current?.children.forEach((c, i) => {
      c.position.y = Y + 0.5 + Math.sin(t * 1.6 + i * 1.7) * 0.03;
      c.rotation.y = t * 0.15 + i * 1.3;
    });
    const b = ball.current;
    if (b) {
      // swimmer to swimmer, in a high arc
      const seg = (t * 0.55) % SWIMMERS.length;
      const i = Math.floor(seg);
      const u = seg - i;
      const [ax, az] = SWIMMERS[i];
      const [bx, bz] = SWIMMERS[(i + 1) % SWIMMERS.length];
      b.position.set(ax + (bx - ax) * u, Y + 0.95 + Math.sin(u * Math.PI) * 1.3, az + (bz - az) * u);
      b.rotation.set(t * 3, 0, t * 2);
    }
  });
  const flags = 14;
  return (
    <group visible={on} userData={DYNAMIC}>
      <group ref={floats}>
        {(
          [
            [20.4, 5.0, "#f43f5e"],
            [18.9, 2.2, "#facc15"],
            [23.2, 3.6, "#22d3ee"],
          ] as const
        ).map(([x, z, c]) => (
          <group key={c} position={[x, Y + 0.5, z]}>
            <mesh rotation-x={-Math.PI / 2}>
              <torusGeometry args={[0.3, 0.1, 10, 22]} />
              <meshStandardMaterial color={c} roughness={0.35} />
            </mesh>
            <mesh rotation-x={-Math.PI / 2} rotation-z={0.8}>
              <torusGeometry args={[0.3, 0.102, 10, 22, Math.PI / 3]} />
              <meshStandardMaterial color="#ffffff" roughness={0.35} />
            </mesh>
          </group>
        ))}
        {/* an inflatable flamingo */}
        <group position={[22.6, Y + 0.5, 5.0]}>
          <mesh rotation-x={-Math.PI / 2}>
            <torusGeometry args={[0.34, 0.15, 10, 22]} />
            <meshStandardMaterial color="#f9a8d4" roughness={0.3} />
          </mesh>
          <mesh position={[0.3, 0.38, 0]} rotation-z={-0.25}>
            <cylinderGeometry args={[0.06, 0.09, 0.7, 10]} />
            <meshStandardMaterial color="#f9a8d4" roughness={0.3} />
          </mesh>
          <mesh position={[0.4, 0.76, 0]}>
            <sphereGeometry args={[0.12, 12, 10]} />
            <meshStandardMaterial color="#f9a8d4" roughness={0.3} />
          </mesh>
          <mesh position={[0.54, 0.72, 0]} rotation-z={-Math.PI / 2}>
            <coneGeometry args={[0.04, 0.14, 8]} />
            <meshStandardMaterial color="#1f2937" />
          </mesh>
        </group>
      </group>
      {/* a beach ball in four colours */}
      <group ref={ball}>
        {["#ef4444", "#ffffff", "#3b82f6", "#facc15"].map((c, i) => (
          <mesh key={c}>
            <sphereGeometry args={[0.17, 16, 12, (i * Math.PI) / 2, Math.PI / 2]} />
            <meshStandardMaterial color={c} roughness={0.4} />
          </mesh>
        ))}
      </group>
      {/* bunting across the pool */}
      {[17.6, 24.4].map((x) => (
        <mesh key={x} position={[x, Y + 1.1, 1.0]}>
          <cylinderGeometry args={[0.03, 0.03, 2.2, 6]} />
          <meshStandardMaterial color="#e5e7eb" />
        </mesh>
      ))}
      {Array.from({ length: flags }, (_, i) => {
        const u = (i + 0.5) / flags;
        return (
          <mesh key={i} position={[17.6 + u * 6.8, Y + 2.05 - Math.sin(u * Math.PI) * 0.35, 1.0]} rotation-x={Math.PI} scale={[1, 1, 0.12]}>
            <coneGeometry args={[0.13, 0.28, 3]} />
            <meshStandardMaterial color={["#f43f5e", "#facc15", "#22d3ee", "#a3e635"][i % 4]} side={DoubleSide} />
          </mesh>
        );
      })}
      {/* a cooler of cold drinks */}
      <group position={[25.2, Y, 5.4]}>
        <B s={[0.6, 0.4, 0.4]} p={[0, 0.2, 0]} c="#2563eb" />
        <B s={[0.62, 0.08, 0.42]} p={[0, 0.44, 0]} c="#f8fafc" />
      </group>
    </group>
  );
}

const SWIMMERS: [number, number][] = [
  [19.5, 3.0],
  [22.6, 2.6],
  [21.0, 4.2],
];

/** A kite looping in the wind while someone holds its string in the roof garden. */
function Kite() {
  const kite = useRef<Group>(null);
  const line = useRef<Mesh>(null);
  const still = useStill();
  const tmp = useRef({ a: new Vector3(), b: new Vector3(), up: new Vector3(0, 1, 0), q: new Quaternion() });
  useFrame(({ clock }) => {
    const k = kite.current;
    const l = line.current;
    if (!k || !l) return;
    const flying = isPresent("roof-kite");
    k.visible = l.visible = flying;
    if (!flying) return;
    const t = still ? 0 : clock.elapsedTime;
    const { a, b, up, q } = tmp.current;
    k.position.set(-9.8 + Math.sin(t * 0.7) * 1.2, Y + 5.2 + Math.sin(t * 1.4) * 0.6, 18.6 + Math.cos(t * 0.7) * 0.9);
    k.rotation.z = Math.sin(t * 1.4) * 0.35;
    // the string runs from the flyer's raised hand to the kite
    a.set(-6.15, Y + 1.45, 19.0);
    b.copy(k.position);
    l.position.copy(a).add(b).multiplyScalar(0.5);
    l.scale.set(1, a.distanceTo(b), 1);
    l.quaternion.copy(q.setFromUnitVectors(up, b.clone().sub(a).normalize()));
  });
  return (
    <group userData={DYNAMIC}>
      <group ref={kite} visible={false}>
        <mesh rotation-y={Math.PI / 2}>
          <circleGeometry args={[0.55, 4]} />
          <meshStandardMaterial color="#ef4444" side={DoubleSide} />
        </mesh>
        <mesh rotation-y={Math.PI / 2} position={[0.01, 0, 0]} scale={[0.5, 0.5, 1]}>
          <circleGeometry args={[0.55, 4]} />
          <meshStandardMaterial color="#facc15" side={DoubleSide} />
        </mesh>
        {[0, 1, 2].map((i) => (
          <mesh key={i} position={[0, -0.75 - i * 0.28, 0]} rotation-x={i * 0.5}>
            <boxGeometry args={[0.03, 0.08, 0.16]} />
            <meshStandardMaterial color={["#22d3ee", "#a78bfa", "#f472b6"][i]} />
          </mesh>
        ))}
      </group>
      <mesh ref={line} visible={false}>
        <cylinderGeometry args={[0.006, 0.006, 1, 4]} />
        <meshBasicMaterial color="#f8fafc" />
      </mesh>
    </group>
  );
}

/** DJ booth with turntables and speakers, a disco ball on a pole, and the party lights (on during the party). */
function PartyStage({ party }: { party: boolean }) {
  const ball = useRef<Group>(null);
  const lasers = useRef<Group>(null);
  const lights = useRef<(PointLight | null)[]>([]);
  const strobe = useRef<PointLight>(null);
  const still = useStill();
  const m = rgbMaterials();
  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    if (ball.current && !still) ball.current.rotation.y += dt * (party ? 1.4 : 0.3);
    if (!party) return;
    lights.current.forEach((l, i) => {
      if (!l) return;
      l.color.setHSL((t * 0.25 + i / 3) % 1, 1, 0.55);
      l.position.set(15.0 + Math.sin(t * 1.3 + i * 2) * 2.2, Y + 2.2, 22.3 + Math.cos(t * 1.1 + i * 2) * 1.2);
    });
    if (strobe.current) strobe.current.intensity = !still && t % 0.5 < 0.06 ? 14 : 0;
    lasers.current?.children.forEach((b, i) => {
      b.rotation.y = Math.sin(t * 1.6 + i * 1.3) * 0.9;
      b.rotation.z = 0.35 + Math.sin(t * 2.2 + i) * 0.2;
    });
  });
  return (
    <group>
      {/* booth */}
      <B s={[1.4, 0.9, 0.5]} p={[15.2, Y + 0.45, 21.7]} c="#111827" />
      <B s={[1.45, 0.04, 0.55]} p={[15.2, Y + 0.92, 21.7]} c="#1f2937" />
      {[14.8, 15.6].map((x) => (
        <mesh key={x} position={[x, Y + 0.96, 21.7]}>
          <cylinderGeometry args={[0.16, 0.16, 0.03, 20]} />
          <meshStandardMaterial color="#0b0d12" />
        </mesh>
      ))}
      <B s={[0.22, 0.04, 0.3]} p={[15.2, Y + 0.96, 21.7]} c="#374151" />
      <mesh position={[15.2, Y + 0.6, 21.452]} material={m.strip} userData={DYNAMIC}>
        <planeGeometry args={[1.3, 0.06]} />
      </mesh>
      {[14.3, 16.15].map((x) => (
        <group key={x} position={[x, Y, 21.75]}>
          <B s={[0.4, 1.1, 0.4]} p={[0, 0.55, 0]} c="#0b0d12" />
          {[0.35, 0.8].map((y) => (
            <mesh key={y} position={[0, y, -0.205]} rotation-y={Math.PI}>
              <circleGeometry args={[y > 0.5 ? 0.09 : 0.14, 16]} />
              <meshStandardMaterial color="#374151" />
            </mesh>
          ))}
        </group>
      ))}
      {/* disco ball hanging from a pole over the dance floor */}
      <mesh position={[12.9, Y + 1.45, 22.9]}>
        <cylinderGeometry args={[0.04, 0.05, 2.9, 8]} />
        <meshStandardMaterial color="#374151" />
      </mesh>
      <B s={[2.2, 0.05, 0.05]} p={[13.95, Y + 2.88, 22.9]} c="#374151" />
      <mesh position={[15.0, Y + 2.73, 22.9]}>
        <cylinderGeometry args={[0.005, 0.005, 0.3, 4]} />
        <meshStandardMaterial color="#9ca3af" />
      </mesh>
      <group ref={ball} position={[15.0, Y + 2.45, 22.9]} userData={DYNAMIC}>
        <mesh>
          <icosahedronGeometry args={[0.22, 1]} />
          <meshStandardMaterial color="#e5e7eb" metalness={1} roughness={0.15} flatShading />
        </mesh>
      </group>
      {party && (
        <group userData={DYNAMIC}>
          {[0, 1, 2].map((i) => (
            <pointLight
              key={i}
              ref={(l) => {
                lights.current[i] = l;
              }}
              intensity={9}
              distance={7}
              decay={1.5}
            />
          ))}
          <pointLight ref={strobe} position={[15.0, Y + 2.2, 22.6]} color="#ffffff" intensity={0} distance={8} decay={1.5} />
          <group ref={lasers} position={[15.2, Y + 1.0, 21.6]}>
            {["#22d3ee", "#f472b6", "#a3e635", "#facc15"].map((c, i) => (
              <mesh key={c} rotation-y={i}>
                <boxGeometry args={[6, 0.015, 0.015]} />
                <meshBasicMaterial color={c} transparent opacity={0.8} toneMapped={false} />
              </mesh>
            ))}
          </group>
        </group>
      )}
    </group>
  );
}

/**
 * The rooftop, one floor up: a sky deck with a fire pit, loungers, a BBQ and a telescope behind glass
 * railings, a roof garden with raised beds and a greenhouse, solar panels and HVAC units, and the
 * open courtyard over the garden below. Shown when the view switches to the roof.
 */
export function Rooftop({
  visible,
  phase,
  party = false,
  poolParty = false,
  name = "AGENT HQ",
  accent = "#34d399",
}: {
  visible: boolean;
  phase: Phase;
  party?: boolean;
  poolParty?: boolean;
  /** the office's name, for the logo on the tower */
  name?: string;
  accent?: string;
}) {
  const gravelTex = useDisposable(() => gravel([14, 12]), "roof-gravel");
  const deckTex = useDisposable(() => planks([8, 4]), "roof-deck");
  const grassTex = useDisposable(() => turf([8, 5]), "roof-turf");
  const solarTex = useDisposable(solarCells, "roof-solar");
  const glow = phase !== "day";
  const { x0, x1, z0, z1 } = ROOF;
  const slab = (a: number, b: number, c: number, d: number) => (
    <mesh position={[(a + b) / 2, Y - 0.15, (c + d) / 2]} receiveShadow castShadow>
      <boxGeometry args={[b - a + 0.3, 0.3, d - c + 0.3]} />
      <meshStandardMaterial color="#e7e5e4" roughness={0.9} />
    </mesh>
  );
  return (
    <group visible={visible}>
      <StaticMerge>
        {/* the roof slab, with the garden courtyard left open */}
        {slab(x0, COURT.x0, z0, z1)}
        {slab(COURT.x0, x1, z0, COURT.z0)}
        {slab(COURT.x0, x1, COURT.z1, z1)}
        <Plane x0={x0} x1={COURT.x0} z0={z0} z1={z1} map={gravelTex} />
        <Plane x0={COURT.x0} x1={x1} z0={z0} z1={COURT.z0} map={gravelTex} />
        <Plane x0={COURT.x0} x1={x1} z0={COURT.z1} z1={z1} map={gravelTex} />
        {/* paver walkway from the lift to the deck */}
        <Plane x0={-5.6} x1={-4.4} z0={-0.4} z1={13.6} color="#e5e1d8" y={0.01} />
        <Plane x0={-5.6} x1={10.6} z0={12.4} z1={13.6} color="#e5e1d8" y={0.01} />
        {/* sky deck and roof garden */}
        <Plane x0={10} x1={x1} z0={16.6} z1={z1} map={deckTex} y={0.012} />
        <Plane x0={x0} x1={9.6} z0={14} z1={z1} map={grassTex} y={0.012} />
        {/* the roof over the night-shift wing, with the helipad */}
        {slab(WING.x0, WING.x1, WING.z0, WING.z1)}
        <Plane x0={WING.x0} x1={WING.x1} z0={WING.z0} z1={WING.z1} map={gravelTex} />
        <Helipad />
        {/* parapets at the back, glass railings where there's a view */}
        <B s={[x1 - x0, 0.6, 0.2]} p={[(x0 + x1) / 2, Y + 0.3, z0]} c="#d6d3d1" />
        <B s={[0.2, 0.6, z1 - z0]} p={[x0, Y + 0.3, (z0 + z1) / 2]} c="#d6d3d1" />
        <Railing a={x0} b={WING.x1} at={z1} />
        <Railing a={z0} b={COURT.z0} at={x1} alongZ />
        <Railing a={COURT.z0} b={z1} at={x1} alongZ />
        <Railing a={WING.z0} b={WING.z1} at={WING.x1} alongZ />
        <Railing a={WING.x0} b={WING.x1} at={WING.z0} />
        <Railing a={COURT.x0} b={x1} at={COURT.z0} />
        <Railing a={COURT.x0} b={x1} at={COURT.z1} />
        <Railing a={COURT.z0} b={COURT.z1} at={COURT.x0} alongZ />
        {/* lift housing with its door to the roof */}
        <B s={[2.4, 2.3, 2.6]} p={[-6.8, Y + 1.15, 0.3]} c="#e7e5e4" />
        <B s={[0.04, 2.05, 1.0]} p={[-5.58, Y + 1.03, 0.3]} c="#9ca3af" metal={0.5} rough={0.3} />
        <B s={[2.5, 0.08, 2.7]} p={[-6.8, Y + 2.34, 0.3]} c="#a8a29e" />
        {/* solar panels */}
        {[-4, -2, 0, 2, 4, 6, 8].map((z) => (
          <group key={z} position={[3.5, Y, z]}>
            <mesh position={[0, 0.45, 0]} rotation-x={-0.35}>
              <boxGeometry args={[11, 0.05, 1.0]} />
              <meshStandardMaterial map={solarTex} metalness={0.4} roughness={0.25} />
            </mesh>
            {[-5, 0, 5].map((dx) => (
              <B key={dx} s={[0.06, 0.4, 0.06]} p={[dx, 0.2, 0.2]} c="#6b7280" />
            ))}
          </group>
        ))}
        <Hvac p={[12.5, Y, -3.5]} s={[1.6, 1.2]} />
        <Hvac p={[12.5, Y, 0]} s={[1.6, 1.2]} />
        <Hvac p={[19, Y, -4]} s={[1.4, 1.4]} />
        <Hvac p={[22, Y, -4]} s={[1.4, 1.4]} />
        {/* water tank and satellite dish */}
        <mesh position={[13.5, Y + 0.9, 4.5]} castShadow>
          <cylinderGeometry args={[0.9, 0.9, 1.8, 20]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.4} roughness={0.5} />
        </mesh>
        <group position={[11, Y, 8]}>
          <B s={[0.1, 0.8, 0.1]} p={[0, 0.4, 0]} c="#6b7280" />
          <mesh position={[0, 0.95, 0]} rotation-x={-0.9}>
            <sphereGeometry args={[0.5, 16, 8, 0, Math.PI * 2, 0, Math.PI / 3]} />
            <meshStandardMaterial color="#f1f5f9" side={DoubleSide} />
          </mesh>
        </group>
        <Antenna />
        <Pool />
        <PartyStage party={party} />
        {/* roof garden */}
        <RaisedBed x={-1} z={15.8} colors={["#4ade80", "#22c55e", "#16a34a"]} />
        <RaisedBed x={3} z={15.8} colors={["#ef4444", "#22c55e", "#f97316"]} />
        <RaisedBed x={7} z={15.8} colors={["#f472b6", "#facc15", "#a78bfa"]} />
        <group position={[6, Y, 21]}>
          <mesh position={[0, 0.9, 0]}>
            <boxGeometry args={[2.4, 1.8, 2.0]} />
            <meshStandardMaterial color="#d9f99d" transparent opacity={0.3} depthWrite={false} roughness={0.1} />
          </mesh>
          <B s={[2.42, 0.06, 2.02]} p={[0, 1.8, 0]} c="#e5e7eb" />
          {[-1.18, 1.18].map((dx) => (
            <B key={dx} s={[0.05, 1.8, 0.05]} p={[dx, 0.9, 0.98]} c="#e5e7eb" />
          ))}
          {[-0.6, 0, 0.6].map((dx) => (
            <mesh key={dx} position={[dx, 0.35, 0]}>
              <sphereGeometry args={[0.3, 10, 8]} />
              <meshStandardMaterial color="#65a30d" />
            </mesh>
          ))}
        </group>
        <Bench x={-4.0} z={23.0} />
        <Bench x={1.0} z={23.0} />
        <PottedTree p={[-6.8, Y, 23.0]} />
        <PottedTree p={[8.8, Y, 23.3]} s={0.9} />
        {/* sky deck */}
        <Lounger x={12.0} z={20.35} color="#38bdf8" />
        <Lounger x={13.4} z={20.35} color="#fb7185" />
        <group position={[12.7, Y, 21.4]}>
          <mesh position={[0, 1.1, 0]}>
            <cylinderGeometry args={[0.025, 0.025, 2.2, 6]} />
            <meshStandardMaterial color="#e5e7eb" />
          </mesh>
          <mesh position={[0, 2.05, 0]}>
            <coneGeometry args={[1.1, 0.35, 12, 1, true]} />
            <meshStandardMaterial color="#fef3c7" side={DoubleSide} />
          </mesh>
        </group>
        <FirePit glow={glow} />
        {/* BBQ kettle */}
        <group position={[24.6, Y, 19.0]}>
          <B s={[0.5, 0.75, 0.9]} p={[0, 0.375, 0]} c="#111827" />
          <mesh position={[0, 0.85, 0]}>
            <sphereGeometry args={[0.3, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color="#1f2937" metalness={0.5} />
          </mesh>
        </group>
        {/* telescope on a tripod */}
        <group position={[25.3, Y, 23.3]}>
          {[0, 2.1, 4.2].map((a) => (
            <mesh key={a} position={[Math.cos(a) * 0.15, 0.5, Math.sin(a) * 0.15]} rotation={[Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3]}>
              <cylinderGeometry args={[0.015, 0.015, 1.0, 5]} />
              <meshStandardMaterial color="#374151" />
            </mesh>
          ))}
          <mesh position={[0, 1.08, 0]} rotation={[0.6, 0.8, 0]}>
            <cylinderGeometry args={[0.06, 0.08, 0.7, 12]} />
            <meshStandardMaterial color="#f8fafc" />
          </mesh>
        </group>
        {[
          [10.4, 23.5, 0.6],
          [17.6, 23.5, 0.8],
          [22.3, 23.5, 0.8],
        ].map(([x, z, w]) => (
          <group key={x} position={[x, Y, z]}>
            <B s={[w, 0.45, 0.5]} p={[0, 0.225, 0]} c="#57534e" />
            {Array.from({ length: 4 }, (_, i) => (
              <mesh key={i} position={[-w / 2 + 0.1 + i * ((w - 0.2) / 3), 0.6, 0]}>
                <coneGeometry args={[0.09, 0.4, 5]} />
                <meshStandardMaterial color="#84cc16" />
              </mesh>
            ))}
          </group>
        ))}
        {/* string lights over the deck */}
        {[
          [10.2, 17.0],
          [25.8, 17.0],
          [10.2, 23.8],
          [25.8, 23.8],
        ].map(([x, z]) => (
          <mesh key={`${x},${z}`} position={[x, Y + 1.25, z]}>
            <cylinderGeometry args={[0.04, 0.04, 2.5, 6]} />
            <meshStandardMaterial color="#374151" />
          </mesh>
        ))}
        {Array.from({ length: 24 }, (_, i) => {
          const u = i / 23;
          const x = 10.2 + u * 15.6;
          return (
            <mesh key={i} position={[x, Y + 2.3 - Math.sin(u * Math.PI) * 0.35, 20.4]}>
              <sphereGeometry args={[0.05, 8, 6]} />
              <meshBasicMaterial color={glow ? "#ffd58a" : "#f5f1e6"} toneMapped={false} />
            </mesh>
          );
        })}
      </StaticMerge>
      <Sky phase={phase} />
      <Kite />
      <PoolParty on={poolParty} />
      <Skyline phase={phase} name={name} accent={accent} />
      <Beacons
        points={[
          [WING.x0 + 0.4, Y + 1.2, WING.z0 + 0.4],
          [WING.x1 - 0.4, Y + 1.2, WING.z0 + 0.4],
          [WING.x1 - 0.4, Y + 1.2, WING.z1 - 0.4],
          [-6.8, Y + 2.55, 0.3],
        ]}
      />
    </group>
  );
}

/** A helipad on the night wing's roof: H in a ring, edge lights and a windsock. */
function Helipad() {
  const cx = (WING.x0 + WING.x1) / 2;
  const cz = (WING.z0 + WING.z1) / 2;
  return (
    <group position={[cx, Y, cz]}>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, 0]}>
        <circleGeometry args={[4.2, 40]} />
        <meshStandardMaterial color="#374151" roughness={0.8} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.03, 0]}>
        <ringGeometry args={[3.5, 3.8, 40]} />
        <meshStandardMaterial color="#facc15" roughness={0.6} />
      </mesh>
      {[-0.9, 0.9].map((dx) => (
        <mesh key={dx} position={[dx, 0.035, 0]}>
          <boxGeometry args={[0.4, 0.01, 3.0]} />
          <meshStandardMaterial color="#f8fafc" />
        </mesh>
      ))}
      <mesh position={[0, 0.035, 0]}>
        <boxGeometry args={[1.8, 0.01, 0.4]} />
        <meshStandardMaterial color="#f8fafc" />
      </mesh>
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * 4.35, 0.08, Math.sin(a) * 4.35]}>
            <cylinderGeometry args={[0.08, 0.08, 0.12, 8]} />
            <meshBasicMaterial color="#86efac" toneMapped={false} />
          </mesh>
        );
      })}
      <group position={[4.3, 0, 6.6]}>
        <mesh position={[0, 1.1, 0]}>
          <cylinderGeometry args={[0.04, 0.04, 2.2, 6]} />
          <meshStandardMaterial color="#e5e7eb" />
        </mesh>
        <mesh position={[-0.45, 2.05, 0]} rotation-z={Math.PI / 2 + 0.15}>
          <coneGeometry args={[0.18, 0.9, 10, 1, true]} />
          <meshStandardMaterial color="#f97316" side={DoubleSide} />
        </mesh>
      </group>
    </group>
  );
}

/** Background colour behind the roof: the open sky. */
export const ROOF_SKY: Record<Phase, string> = { day: "#bfe3f7", sunset: "#f7b98f", night: "#141a3a" };
