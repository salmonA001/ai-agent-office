"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { BoxGeometry, type BufferGeometry, CanvasTexture, DoubleSide, type Group, PlaneGeometry, RepeatWrapping, SRGBColorSpace } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Phase } from "@/lib/office-custom";
import { COURTYARD, ROOF_Y, WING } from "./office-nav";
import { seeded } from "./scene-utils";
import { DYNAMIC, StaticMerge } from "./static-merge";

/**
 * The office is the top floor of a tower: tall curtain walls drop to a street far below, with
 * traffic going round the block and a city of towers around it (lit windows at night). Only
 * drawn in the roof view.
 */

/** Storeys below the office, and the street level. */
const STOREY = ROOF_Y;
const FLOORS = 14;
export const STREET_Y = ROOF_Y - FLOORS * STOREY;

/** One texture tile = 4 windows across, 4 storeys up. */
const TILE_W = 6.8;
const TILE_H = 4 * STOREY;

type Glass = { map: CanvasTexture; lit: CanvasTexture };

/** Window grid for a curtain wall: a daytime look and a map of which windows are lit at night. */
function glassTextures(frame: string, glass: [string, string], seed: number): Glass {
  const n = 256;
  const cell = n / 4;
  const day = document.createElement("canvas");
  const night = document.createElement("canvas");
  day.width = day.height = night.width = night.height = n;
  const g = day.getContext("2d")!;
  const k = night.getContext("2d")!;
  g.fillStyle = frame;
  g.fillRect(0, 0, n, n);
  k.fillStyle = "#000000";
  k.fillRect(0, 0, n, n);
  const rnd = seeded(seed);
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 4; c++) {
      const x = c * cell + 6;
      const y = r * cell + 8;
      const w = cell - 12;
      const h = cell - 22;
      const sky = g.createLinearGradient(x, y, x + w, y + h);
      sky.addColorStop(0, glass[0]);
      sky.addColorStop(1, glass[1]);
      g.fillStyle = sky;
      g.fillRect(x, y, w, h);
      g.fillStyle = "rgba(255,255,255,0.18)";
      g.fillRect(x + 4, y + 3, w * 0.35, h - 6);
      // about a third of the windows have the lights on at night
      const on = rnd();
      if (on < 0.38) {
        k.fillStyle = on < 0.1 ? "#cfe6ff" : on < 0.3 ? "#ffd38c" : "#ffb86b";
        k.fillRect(x, y, w, h);
      }
    }
  const make = (c: HTMLCanvasElement, srgb: boolean) => {
    const t = new CanvasTexture(c);
    if (srgb) t.colorSpace = SRGBColorSpace;
    t.wrapS = t.wrapT = RepeatWrapping;
    t.anisotropy = 4;
    return t;
  };
  return { map: make(day, true), lit: make(night, true) };
}

function useGlass(frame: string, a: string, b: string, seed: number) {
  const glass = useMemo(() => glassTextures(frame, [a, b], seed), [frame, a, b, seed]);
  useEffect(
    () => () => {
      glass.map.dispose();
      glass.lit.dispose();
    },
    [glass],
  );
  return glass;
}

/** Scales a face's UVs so the window tiles keep their real size whatever the wall's size. */
function tileUv(geo: BufferGeometry, faces: [number, number][]) {
  const uv = geo.getAttribute("uv");
  const per = uv.count / faces.length;
  for (let f = 0; f < faces.length; f++) {
    const [w, h] = faces[f];
    for (let i = f * per; i < (f + 1) * per; i++) {
      if (w === 0) uv.setXY(i, 0.01, 0.01);
      else uv.setXY(i, (uv.getX(i) * w) / TILE_W, (uv.getY(i) * h) / TILE_H);
    }
  }
  uv.needsUpdate = true;
}

/** Built (merged) geometry, disposed when it is replaced or unmounted. */
function useGeometry<T extends BufferGeometry | BufferGeometry[]>(make: () => T, key: string) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const geo = useMemo(() => make(), [key]);
  useEffect(() => () => [geo].flat().forEach((g) => g.dispose()), [geo]);
  return geo;
}

const glowOf = (phase: Phase) => (phase === "night" ? 1.25 : phase === "sunset" ? 0.55 : 0);

/** The tower's own outer walls, from the street up to the roof edge. */
function TowerWalls({ phase }: { phase: Phase }) {
  const glass = useGlass("#4b5d6b", "#a9cde0", "#5f87a0", 7);
  const top = ROOF_Y - 0.3;
  const h = top - STREET_Y;
  const geo = useGeometry(() => {
    const W = WING;
    // [from, to, at, alongZ]
    const walls: [number, number, number, boolean][] = [
      [-8, W.x1, 24.16, false], // south, main building and night wing
      [-6, W.z0, 26.16, true], // east of the main building, north of the wing
      [W.z0, 24, W.x1 + 0.16, true], // east of the night wing
      [26, W.x1, W.z0 - 0.16, false], // north of the night wing
      [-8, 26, -6.16, false], // north
      [-6, 24, -8.16, true], // west
    ];
    const parts = walls.map(([a, b, at, alongZ]) => {
      const len = b - a;
      const p = new PlaneGeometry(len, h);
      tileUv(p, [[len, h]]);
      if (alongZ) p.rotateY(Math.PI / 2);
      const mid = (a + b) / 2;
      if (alongZ) p.translate(at, STREET_Y + h / 2, mid);
      else p.translate(mid, STREET_Y + h / 2, at);
      return p;
    });
    const merged = mergeGeometries(parts)!;
    parts.forEach((p) => p.dispose());
    return merged;
  }, "tower-walls");
  const glow = glowOf(phase);
  return (
    <group>
      <mesh geometry={geo}>
        <meshStandardMaterial
          map={glass.map}
          emissiveMap={glass.lit}
          emissive="#ffffff"
          emissiveIntensity={glow}
          roughness={0.2}
          metalness={0.35}
          side={DoubleSide}
        />
      </mesh>
      {/* the night wing's glass wall to the open courtyard */}
      <mesh position={[WING.x0 + 0.02, (ROOF_Y - 0.3) / 2, (COURTYARD.z0 + COURTYARD.z1) / 2]} rotation-y={Math.PI / 2}>
        <planeGeometry args={[COURTYARD.z1 - COURTYARD.z0, ROOF_Y - 0.3]} />
        <meshStandardMaterial color="#bfe3f2" transparent opacity={0.35} depthWrite={false} roughness={0.05} side={DoubleSide} />
      </mesh>
      {/* the lobby canopy and the building's name over the entrance, down at the street */}
      <StaticMerge>
        <mesh position={[14, STREET_Y + 3.6, 25.3]}>
          <boxGeometry args={[9, 0.25, 2.4]} />
          <meshStandardMaterial color="#1f2937" metalness={0.5} roughness={0.35} />
        </mesh>
        {[9.8, 18.2].map((x) => (
          <mesh key={x} position={[x, STREET_Y + 1.8, 26.3]}>
            <cylinderGeometry args={[0.1, 0.1, 3.6, 8]} />
            <meshStandardMaterial color="#9ca3af" metalness={0.6} roughness={0.3} />
          </mesh>
        ))}
        <mesh position={[14, STREET_Y + 0.06, 24.2 + 7]}>
          <boxGeometry args={[60, 0.12, 14]} />
          <meshStandardMaterial color="#d6d3cd" roughness={0.9} />
        </mesh>
      </StaticMerge>
    </group>
  );
}

/** Road grid lines (centres) round the block; our tower sits in the middle block. */
const X_ROADS = [-92, -56, -20, 48, 84, 120];
const Z_ROADS = [-88, -52, -16, 36, 72, 108];
const ROAD = 7;
/** Building centre and the camera's direction over the ground, to keep towers out of the way. */
const CENTRE: [number, number] = [14, 9];
const VIEW: [number, number] = [0.633, 0.774];

type Tower = { x: number; z: number; w: number; d: number; h: number; kind: number };

function planCity(): Tower[] {
  const rnd = seeded(2024);
  const towers: Tower[] = [];
  for (let i = 0; i < X_ROADS.length - 1; i++)
    for (let j = 0; j < Z_ROADS.length - 1; j++) {
      const bx0 = X_ROADS[i] + ROAD / 2 + 1.5;
      const bx1 = X_ROADS[i + 1] - ROAD / 2 - 1.5;
      const bz0 = Z_ROADS[j] + ROAD / 2 + 1.5;
      const bz1 = Z_ROADS[j + 1] - ROAD / 2 - 1.5;
      if (X_ROADS[i] === -20 && Z_ROADS[j] === -16) continue; // our block
      // two lots across, two deep
      for (const u of [0.25, 0.75])
        for (const v of [0.25, 0.75]) {
          if (rnd() < 0.12) continue;
          const lotW = (bx1 - bx0) / 2 - 1.2;
          const lotD = (bz1 - bz0) / 2 - 1.2;
          const w = lotW * (0.62 + rnd() * 0.38);
          const d = lotD * (0.62 + rnd() * 0.38);
          const x = bx0 + (bx1 - bx0) * u;
          const z = bz0 + (bz1 - bz0) * v;
          // in front of the camera's view of our tower stay low; behind it, the skyline
          const dx = x - CENTRE[0];
          const dz = z - CENTRE[1];
          const ahead = dx * VIEW[0] + dz * VIEW[1];
          const side = Math.abs(dx * VIEW[1] - dz * VIEW[0]);
          // nearby towers stay below our roof so there's open sky; the far ones make the skyline
          const tall = FLOORS * STOREY;
          const far = Math.hypot(dx, dz) > 75;
          const h =
            ahead > 20 && side < 50
              ? 5 + rnd() * 9
              : ahead > 0
                ? 10 + rnd() * tall * 0.45
                : far
                  ? tall * (0.7 + rnd() * 0.9)
                  : tall * (0.3 + rnd() * 0.5);
          towers.push({ x, z, w, d, h, kind: Math.floor(rnd() * 3) });
        }
    }
  return towers;
}

const KINDS: [string, string, string, number][] = [
  ["#3f4a57", "#9cc4dc", "#4f7790", 11],
  ["#2f4f4f", "#8fd3cf", "#3d7f7a", 23],
  ["#8b7d6b", "#c9d6df", "#7c8e9b", 37],
];

/** The towers around us, merged into one draw per facade style. */
function Towers({ phase }: { phase: Phase }) {
  const towers = useMemo(planCity, []);
  const g0 = useGlass(...KINDS[0]);
  const g1 = useGlass(...KINDS[1]);
  const g2 = useGlass(...KINDS[2]);
  const geos = useGeometry(
    () =>
      [0, 1, 2].map((kind) => {
        const parts = towers
          .filter((t) => t.kind === kind)
          .map((t) => {
            const b = new BoxGeometry(t.w, t.h, t.d);
            // box faces: +x, -x, +y, -y, +z, -z (roofs get the plain frame colour)
            tileUv(b, [
              [t.d, t.h],
              [t.d, t.h],
              [0, 0],
              [0, 0],
              [t.w, t.h],
              [t.w, t.h],
            ]);
            b.translate(t.x, STREET_Y + t.h / 2, t.z);
            return b;
          });
        const merged = mergeGeometries(parts)!;
        parts.forEach((p) => p.dispose());
        return merged;
      }),
    "city-towers",
  );
  const glow = glowOf(phase);
  const spires = [...towers].sort((a, b) => b.h - a.h).slice(0, 5);
  return (
    <group>
      {[g0, g1, g2].map((glass, i) => (
        <mesh key={i} geometry={geos[i]} receiveShadow={false}>
          <meshStandardMaterial map={glass.map} emissiveMap={glass.lit} emissive="#ffffff" emissiveIntensity={glow} roughness={0.35} metalness={0.25} />
        </mesh>
      ))}
      <StaticMerge>
        {spires.map((t) => (
          <group key={`${t.x},${t.z}`} position={[t.x, STREET_Y + t.h, t.z]}>
            <mesh position={[0, 0.6, 0]}>
              <boxGeometry args={[t.w * 0.5, 1.2, t.d * 0.5]} />
              <meshStandardMaterial color="#6b7280" />
            </mesh>
            <mesh position={[0, 4.2, 0]}>
              <cylinderGeometry args={[0.08, 0.16, 6, 6]} />
              <meshStandardMaterial color="#d1d5db" metalness={0.6} roughness={0.3} />
            </mesh>
          </group>
        ))}
      </StaticMerge>
      <Beacons points={spires.map((t) => [t.x, STREET_Y + t.h + 7.3, t.z])} />
    </group>
  );
}

/** Red aircraft-warning lights blinking on top of the tallest towers (and ours). */
export function Beacons({ points }: { points: [number, number, number][] }) {
  const group = useRef<Group>(null);
  useFrame(({ clock }) => {
    const on = clock.elapsedTime % 1.6 < 0.35;
    group.current?.children.forEach((c) => (c.visible = on));
  });
  return (
    <group ref={group} userData={DYNAMIC}>
      {points.map((p) => (
        <mesh key={p.join(",")} position={p}>
          <sphereGeometry args={[0.22, 8, 6]} />
          <meshBasicMaterial color="#ff2a2a" toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

/** Street level: pavement, the road grid with lane markings, and plazas with trees. */
function Streets({ phase }: { phase: Phase }) {
  const night = phase === "night";
  const span = 520;
  return (
    <StaticMerge>
      <mesh position={[14, STREET_Y - 0.05, 9]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[span, span]} />
        <meshStandardMaterial color={night ? "#3b3f47" : "#a8a49c"} roughness={0.95} />
      </mesh>
      {X_ROADS.map((x) => (
        <group key={`x${x}`}>
          <mesh position={[x, STREET_Y, 9]} rotation-x={-Math.PI / 2}>
            <planeGeometry args={[ROAD, span]} />
            <meshStandardMaterial color="#3a3d42" roughness={0.9} />
          </mesh>
          <mesh position={[x, STREET_Y + 0.02, 9]} rotation-x={-Math.PI / 2}>
            <planeGeometry args={[0.18, span]} />
            <meshStandardMaterial color="#facc15" roughness={0.6} />
          </mesh>
        </group>
      ))}
      {Z_ROADS.map((z) => (
        <group key={`z${z}`}>
          <mesh position={[14, STREET_Y + 0.01, z]} rotation-x={-Math.PI / 2}>
            <planeGeometry args={[span, ROAD]} />
            <meshStandardMaterial color="#3a3d42" roughness={0.9} />
          </mesh>
          <mesh position={[14, STREET_Y + 0.03, z]} rotation-x={-Math.PI / 2}>
            <planeGeometry args={[span, 0.18]} />
            <meshStandardMaterial color="#facc15" roughness={0.6} />
          </mesh>
        </group>
      ))}
      {/* street trees along the plaza in front of the tower */}
      {[-14, -6, 2, 26, 34, 42].map((x) => (
        <group key={x} position={[x, STREET_Y, 30]}>
          <mesh position={[0, 1, 0]}>
            <cylinderGeometry args={[0.15, 0.2, 2, 6]} />
            <meshStandardMaterial color="#6b4f3a" />
          </mesh>
          <mesh position={[0, 2.7, 0]}>
            <sphereGeometry args={[1.3, 10, 8]} />
            <meshStandardMaterial color="#4d8f3c" />
          </mesh>
        </group>
      ))}
    </StaticMerge>
  );
}

const CAR_COLORS = ["#ef4444", "#f8fafc", "#0ea5e9", "#facc15", "#111827", "#22c55e", "#a855f7", "#f97316"];
/** The loop round our block, on the road centre lines. */
const LOOP = { x0: -20, x1: 48, z0: -16, z1: 36 };

/** Cars driving round the block (and lighting up at night). */
function Traffic({ phase }: { phase: Phase }) {
  const cars = useRef<(Group | null)[]>([]);
  const glow = phase !== "day";
  const { x0, x1, z0, z1 } = LOOP;
  const w = x1 - x0;
  const d = z1 - z0;
  const perim = 2 * (w + d);
  const list = useMemo(
    () => CAR_COLORS.concat(CAR_COLORS).map((c, i) => ({ c, start: (i / 16) * perim, speed: 7 + (i % 5), lane: i % 2 ? 1 : -1 })),
    [perim],
  );
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    list.forEach((car, i) => {
      const g = cars.current[i];
      if (!g) return;
      // clockwise or anticlockwise by lane, on its side of the road
      let s = (car.start + t * car.speed * car.lane) % perim;
      if (s < 0) s += perim;
      let x: number;
      let z: number;
      let yaw: number;
      const off = 1.6 * car.lane;
      if (s < w) [x, z, yaw] = [x0 + s, z0 - off, Math.PI / 2];
      else if (s < w + d) [x, z, yaw] = [x1 + off, z0 + (s - w), 0];
      else if (s < 2 * w + d) [x, z, yaw] = [x1 - (s - w - d), z1 + off, -Math.PI / 2];
      else [x, z, yaw] = [x0 - off, z1 - (s - 2 * w - d), Math.PI];
      g.position.set(x, STREET_Y, z);
      g.rotation.y = car.lane > 0 ? yaw : yaw + Math.PI;
    });
  });
  return (
    <group userData={DYNAMIC}>
      {list.map((car, i) => (
        <group key={i} ref={(g) => void (cars.current[i] = g)}>
          <mesh position={[0, 0.45, 0]}>
            <boxGeometry args={[1.5, 0.6, 3.2]} />
            <meshStandardMaterial color={car.c} metalness={0.4} roughness={0.35} />
          </mesh>
          <mesh position={[0, 0.95, -0.2]}>
            <boxGeometry args={[1.3, 0.45, 1.7]} />
            <meshStandardMaterial color="#1e293b" metalness={0.3} roughness={0.2} />
          </mesh>
          {[-0.5, 0.5].map((dx) => (
            <mesh key={dx} position={[dx, 0.5, 1.61]}>
              <boxGeometry args={[0.3, 0.14, 0.02]} />
              <meshBasicMaterial color={glow ? "#fff7d6" : "#e5e7eb"} toneMapped={false} />
            </mesh>
          ))}
          {[-0.5, 0.5].map((dx) => (
            <mesh key={`r${dx}`} position={[dx, 0.5, -1.61]}>
              <boxGeometry args={[0.3, 0.14, 0.02]} />
              <meshBasicMaterial color={glow ? "#ff3b3b" : "#991b1b"} toneMapped={false} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

/** Everything below and around the roof: our tower's walls, the street and the city. */
export function Skyline({ phase }: { phase: Phase }) {
  return (
    <group>
      <TowerWalls phase={phase} />
      <Streets phase={phase} />
      <Traffic phase={phase} />
      <Towers phase={phase} />
    </group>
  );
}
