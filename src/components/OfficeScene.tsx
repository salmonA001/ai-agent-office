"use client";

import { Billboard, ContactShadows, OrbitControls, Outlines, RoundedBox, Sparkles, Text } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import { CanvasTexture, type Group, RepeatWrapping, SRGBColorSpace } from "three";
import type { Agent } from "@/lib/agents";

export type DeskState = { working: string[]; lastDoneAt?: number };
export type ManagerState = "idle" | "planning" | "watching" | "merging";
export type BoardLine = { text: string; status: "queued" | "working" | "done" | "error" };

const FONT = "/fonts/Geist-Regular.ttf";
const INK = "#4a3535";
const CHALK_FONT = '"Segoe Print", "Comic Sans MS", "Chalkboard SE", "Marker Felt", cursive';

const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function clip(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** Deterministic noise so textures look the same on every render. */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// ---------- Procedural textures ----------

function woodTexture(repeatX: number, repeatY: number) {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 512;
  const g = c.getContext("2d")!;
  const rnd = seeded(7);
  const plank = 64;
  for (let x = 0; x < 512; x += plank) {
    const offset = (x / plank) % 2 ? 128 : 0;
    for (let y = -256; y < 512; y += 256) {
      g.fillStyle = `hsl(${26 + rnd() * 6}, ${55 + rnd() * 10}%, ${48 + rnd() * 10}%)`;
      g.fillRect(x, y + offset, plank, 256);
      g.fillStyle = "rgba(60,30,10,0.55)";
      g.fillRect(x, y + offset, plank, 2);
    }
    g.fillStyle = "rgba(60,30,10,0.6)";
    g.fillRect(x, 0, 2, 512);
    for (let i = 0; i < 6; i++) {
      g.fillStyle = `rgba(90,50,20,${0.08 + rnd() * 0.1})`;
      g.fillRect(x + 6 + rnd() * (plank - 12), 0, 1, 512);
    }
  }
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = 8;
  return tex;
}

function skyTexture() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const g = c.getContext("2d")!;
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, "#8fd0f2");
  grad.addColorStop(0.55, "#fff1cc");
  grad.addColorStop(1, "#ffcf8a");
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  const rnd = seeded(3);
  for (let i = 0; i < 18; i++) {
    g.fillStyle = `hsl(${105 + rnd() * 30}, 45%, ${38 + rnd() * 15}%)`;
    g.beginPath();
    g.arc(rnd() * 256, 210 + rnd() * 50, 22 + rnd() * 26, 0, Math.PI * 2);
    g.fill();
  }
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

function boardTexture(lines: BoardLine[], manager: ManagerState) {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 400;
  const g = c.getContext("2d")!;
  g.fillStyle = "#2f5a4b";
  g.fillRect(0, 0, 1024, 400);
  const rnd = seeded(11);
  for (let i = 0; i < 45; i++) {
    g.fillStyle = `rgba(255,255,255,${rnd() * 0.05})`;
    g.beginPath();
    g.ellipse(rnd() * 1024, rnd() * 400, 40 + rnd() * 140, 8 + rnd() * 30, rnd() * 3, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = "#fffbe6";
  g.font = `700 42px ${CHALK_FONT}`;
  g.fillText(manager === "merging" ? "Putting it all together!" : "Today's tasks", 40, 66);
  g.fillRect(40, 80, 300, 3);
  if (lines.length === 0) {
    g.fillStyle = "#ffd6e7";
    g.font = `700 46px ${CHALK_FONT}`;
    g.fillText("Give the class a task!  ♪", 210, 230);
  }
  lines.slice(0, 6).forEach((l, i) => {
    g.font = `600 31px ${CHALK_FONT}`;
    g.fillStyle =
      l.status === "done" ? "#ffe27a" : l.status === "working" ? "#ffffff" : l.status === "error" ? "#ff9a90" : "#bfe6ff";
    const mark = l.status === "done" ? "✓" : l.status === "working" ? "✎" : l.status === "error" ? "✗" : "・";
    g.fillText(`${mark}  ${clip(l.text, 44)}`, 52, 130 + i * 44);
  });
  g.fillStyle = "#fffbe6";
  g.font = `600 24px ${CHALK_FONT}`;
  g.fillText("On duty: Max", 850, 370);
  g.fillStyle = "#ffb3cf";
  g.fillText("✿", 960, 66);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/** Builds a texture once per key and disposes it when the key changes or the scene unmounts. */
function useDisposable<T extends { dispose(): void }>(factory: () => T, key: string) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const value = useMemo(() => factory(), [key]);
  useEffect(() => () => value.dispose(), [value]);
  return value;
}

// ---------- Labels ----------

/** Name tag plus an optional speech bubble, always facing the camera. Drawn in WebGL (no DOM). */
function Label({ name, bubble, position }: { name: string; bubble?: string; position: [number, number, number] }) {
  const tag = clip(name, 26);
  const say = bubble ? clip(bubble, 28) : null;
  return (
    <Billboard position={position}>
      {say && (
        <group position={[0, 0.34, 0]}>
          <RoundedBox args={[say.length * 0.085 + 0.32, 0.3, 0.02]} radius={0.12}>
            <meshBasicMaterial color="#fffdf7" />
          </RoundedBox>
          <mesh position={[0, -0.16, 0]} rotation-z={Math.PI / 4}>
            <planeGeometry args={[0.1, 0.1]} />
            <meshBasicMaterial color="#fffdf7" />
          </mesh>
          <Text font={FONT} fontSize={0.145} color="#3a2a2a" position={[0, 0, 0.02]} anchorX="center" anchorY="middle">
            {say}
          </Text>
        </group>
      )}
      <RoundedBox args={[tag.length * 0.075 + 0.28, 0.23, 0.02]} radius={0.1}>
        <meshBasicMaterial color="#4a3535" transparent opacity={0.85} />
      </RoundedBox>
      <Text font={FONT} fontSize={0.125} color="#ffffff" position={[0, 0, 0.02]} anchorX="center" anchorY="middle">
        {tag}
      </Text>
    </Billboard>
  );
}

// ---------- Kawaii workers ----------

export type Species = "bear" | "bunny" | "cat" | "hamster" | "puppy" | "chick";
type Accessory = "glasses" | "bow" | "headphones" | "flower" | "tie" | null;
type Action = "idle" | "write" | "chalk" | "wave";
type Look = { species: Species; color: string; inner: string };

const LOOKS: Look[] = [
  { species: "bear", color: "#fff6e9", inner: "#ffc7d1" },
  { species: "bunny", color: "#ffd9e4", inner: "#ff9fb8" },
  { species: "cat", color: "#e7defa", inner: "#ffc2d6" },
  { species: "hamster", color: "#ffdcb8", inner: "#ffb39a" },
  { species: "puppy", color: "#d6f3e6", inner: "#a8dcc5" },
  { species: "chick", color: "#fff1a6", inner: "#ffb347" },
];

const ACCESSORY: Record<string, Accessory> = {
  researcher: "glasses",
  writer: "bow",
  coder: "headphones",
  planner: "flower",
};

function Toon({ color }: { color: string }) {
  return <meshToonMaterial color={color} />;
}

/** Hand-drawn style outline. */
function Ink({ t = 0.012 }: { t?: number }) {
  return <Outlines thickness={t} color={INK} />;
}

function Ears({ species, color, inner }: Look) {
  if (species === "bunny") {
    return (
      <>
        {[-1, 1].map((s) => (
          <group key={s} position={[s * 0.14, 0.5, -0.04]} rotation-z={-s * 0.14}>
            <mesh castShadow>
              <capsuleGeometry args={[0.075, 0.32, 6, 12]} />
              <Toon color={color} />
              <Ink />
            </mesh>
            <mesh position={[0, 0, 0.05]} scale={[0.55, 0.8, 0.4]}>
              <capsuleGeometry args={[0.075, 0.32, 6, 12]} />
              <Toon color={inner} />
            </mesh>
          </group>
        ))}
      </>
    );
  }
  if (species === "cat") {
    return (
      <>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.25, 0.33, 0]} rotation-z={-s * 0.4} castShadow>
            <coneGeometry args={[0.12, 0.22, 12]} />
            <Toon color={color} />
            <Ink />
          </mesh>
        ))}
      </>
    );
  }
  if (species === "puppy") {
    return (
      <>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.42, 0.04, 0]} rotation-z={s * 0.35} scale={[0.5, 1.15, 0.8]} castShadow>
            <sphereGeometry args={[0.14, 16, 16]} />
            <Toon color={inner} />
            <Ink />
          </mesh>
        ))}
      </>
    );
  }
  if (species === "chick") {
    return (
      <>
        {[-0.06, 0, 0.06].map((x) => (
          <mesh key={x} position={[x, 0.43, 0]} rotation-z={-x * 4} scale={[1, x === 0 ? 1.3 : 1, 1]}>
            <coneGeometry args={[0.035, 0.14, 8]} />
            <Toon color={color} />
            <Ink t={0.008} />
          </mesh>
        ))}
      </>
    );
  }
  const hamster = species === "hamster";
  const r = hamster ? 0.085 : 0.11;
  return (
    <>
      {[-1, 1].map((s) => (
        <group key={s} position={[s * (hamster ? 0.3 : 0.27), hamster ? 0.27 : 0.31, -0.02]}>
          <mesh scale={[1, 1, 0.7]} castShadow>
            <sphereGeometry args={[r, 16, 16]} />
            <Toon color={color} />
            <Ink />
          </mesh>
          <mesh position={[0, 0, 0.05]} scale={[1, 1, 0.4]}>
            <sphereGeometry args={[r * 0.55, 12, 12]} />
            <Toon color={inner} />
          </mesh>
        </group>
      ))}
    </>
  );
}

function AccessoryMesh({ kind }: { kind: Accessory }) {
  if (kind === "glasses") {
    return (
      <group position={[0, 0.02, 0.425]}>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.14, 0, 0]}>
            <torusGeometry args={[0.075, 0.012, 8, 24]} />
            <meshToonMaterial color="#6b4434" />
          </mesh>
        ))}
        <mesh>
          <boxGeometry args={[0.12, 0.015, 0.015]} />
          <meshToonMaterial color="#6b4434" />
        </mesh>
      </group>
    );
  }
  if (kind === "bow") {
    return (
      <group position={[-0.22, 0.3, 0.16]} rotation-z={0.3}>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.07, 0, 0]} rotation-z={s * (Math.PI / 2)}>
            <coneGeometry args={[0.06, 0.12, 12]} />
            <Toon color="#ff7aa2" />
            <Ink t={0.008} />
          </mesh>
        ))}
        <mesh>
          <sphereGeometry args={[0.035, 12, 12]} />
          <Toon color="#ff5c8d" />
        </mesh>
      </group>
    );
  }
  if (kind === "headphones") {
    return (
      <group>
        <mesh position={[0, 0.05, 0]}>
          <torusGeometry args={[0.47, 0.03, 8, 32, Math.PI]} />
          <Toon color="#4fc3d1" />
          <Ink t={0.008} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.46, 0.02, 0]} rotation-z={Math.PI / 2}>
            <cylinderGeometry args={[0.11, 0.11, 0.08, 20]} />
            <Toon color="#4fc3d1" />
            <Ink t={0.008} />
          </mesh>
        ))}
      </group>
    );
  }
  if (kind === "flower") {
    return (
      <group position={[0.24, 0.33, 0.12]} rotation-x={-0.4}>
        {Array.from({ length: 5 }, (_, i) => (
          <mesh key={i} position={[Math.cos((i / 5) * Math.PI * 2) * 0.05, Math.sin((i / 5) * Math.PI * 2) * 0.05, 0]}>
            <sphereGeometry args={[0.035, 10, 10]} />
            <Toon color="#ffd166" />
          </mesh>
        ))}
        <mesh position={[0, 0, 0.02]}>
          <sphereGeometry args={[0.03, 10, 10]} />
          <Toon color="#ff8c42" />
        </mesh>
      </group>
    );
  }
  return null;
}

function PomPom({ color }: { color: string }) {
  return (
    <group position={[0, -0.2, 0]} visible={false}>
      {Array.from({ length: 7 }, (_, i) => {
        const a = (i / 7) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * 0.06, Math.sin(a) * 0.06, (i % 2) * 0.04 - 0.02]}>
            <icosahedronGeometry args={[0.065, 0]} />
            <meshToonMaterial color={color} />
          </mesh>
        );
      })}
    </group>
  );
}

/**
 * A soft round chibi animal. Idle: turned toward you, swaying and blinking.
 * Working: faces its desk and scribbles. Done: jumps and cheers with pom-poms.
 */
function Mochi({
  look,
  accessory,
  facing,
  action,
  lastDoneAt,
  seed,
  scale = 1,
}: {
  look: Look;
  accessory: Accessory;
  facing: "front" | "back";
  action: Action;
  lastDoneAt?: number;
  seed: number;
  scale?: number;
}) {
  const { species, color, inner } = look;
  const root = useRef<Group>(null);
  const head = useRef<Group>(null);
  const left = useRef<Group>(null);
  const right = useRef<Group>(null);
  const eyes = useRef<Group>(null);
  const party = useRef<Group>(null);
  const [still] = useState(reducedMotion);

  useFrame(({ clock }, delta) => {
    if (!root.current || !head.current || !left.current || !right.current || !eyes.current || !party.current) return;
    const t = clock.elapsedTime + seed;
    const since = lastDoneAt ? (Date.now() - lastDoneAt) / 1000 : 99;
    const cheering = since < 2.6;
    const target = cheering || facing === "front" ? 0 : Math.PI;
    party.current.visible = cheering;
    left.current.children[1].visible = cheering;
    right.current.children[1].visible = cheering;
    if (still) {
      root.current.rotation.y = target;
      return;
    }
    root.current.rotation.y += (target - root.current.rotation.y) * Math.min(1, delta * 6);

    let y: number;
    if (cheering) y = Math.abs(Math.sin(since * Math.PI * 3)) * 0.28;
    else if (action === "idle") {
      const hop = t % 7;
      y = Math.sin(t * 2) * 0.015 + (hop < 0.45 ? Math.sin((hop / 0.45) * Math.PI) * 0.1 : 0);
    } else y = Math.abs(Math.sin(t * 8)) * 0.012;
    root.current.position.y = y;
    root.current.rotation.z = action === "idle" && !cheering ? Math.sin(t * 1.4) * 0.05 : 0;

    head.current.rotation.z = action === "idle" && !cheering ? Math.sin(t * 0.8) * 0.12 : 0;
    head.current.rotation.x = action === "write" && !cheering ? 0.22 : 0;

    const L = left.current.rotation;
    const R = right.current.rotation;
    if (cheering) {
      L.set(-2.7 + Math.sin(t * 16) * 0.3, 0, -0.45);
      R.set(-2.7 + Math.sin(t * 16 + 2) * 0.3, 0, 0.45);
    } else if (action === "write") {
      L.set(-0.95, 0, 0.1);
      R.set(-1.15 + Math.sin(t * 14) * 0.15, 0, -0.1 + Math.sin(t * 7) * 0.1);
    } else if (action === "chalk") {
      L.set(-0.2, 0, -0.25);
      R.set(-2.4 + Math.sin(t * 6) * 0.25, 0, Math.sin(t * 3) * 0.3);
    } else if (action === "wave") {
      L.set(-0.2, 0, -0.25);
      R.set(-2.6, 0, 0.5 + Math.sin(t * 8) * 0.4);
    } else {
      L.set(-0.15 + Math.sin(t * 1.5) * 0.06, 0, -0.3);
      R.set(-0.15 - Math.sin(t * 1.5) * 0.06, 0, 0.3);
    }
    eyes.current.scale.y = t % 3.7 < 0.13 ? 0.12 : 1;
  });

  return (
    <group scale={scale}>
      <group ref={root}>
        {/* body */}
        <mesh position={[0, 0.27, 0]} scale={[1.05, 0.82, 0.95]} castShadow>
          <sphereGeometry args={[0.33, 32, 32]} />
          <Toon color={color} />
          <Ink />
        </mesh>
        {accessory === "tie" && (
          <mesh position={[0, 0.3, 0.3]} rotation-x={0.25}>
            <coneGeometry args={[0.06, 0.2, 4]} />
            <Toon color="#027f93" />
          </mesh>
        )}
        {/* feet */}
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.15, 0.05, 0.22]} scale={[1, 0.65, 1.3]} castShadow>
            <sphereGeometry args={[0.09, 16, 16]} />
            <Toon color={color} />
            <Ink />
          </mesh>
        ))}
        {/* arms: the second child is a pom-pom, shown while cheering */}
        <group ref={left} position={[-0.33, 0.43, 0.03]}>
          <mesh position={[0, -0.1, 0]} castShadow>
            <capsuleGeometry args={[0.075, 0.1, 6, 12]} />
            <Toon color={color} />
            <Ink />
          </mesh>
          <PomPom color="#9fd8ff" />
        </group>
        <group ref={right} position={[0.33, 0.43, 0.03]}>
          <mesh position={[0, -0.1, 0]} castShadow>
            <capsuleGeometry args={[0.075, 0.1, 6, 12]} />
            <Toon color={color} />
            <Ink />
          </mesh>
          <PomPom color="#ffb3d1" />
        </group>
        {/* head */}
        <group ref={head} position={[0, 0.78, 0]}>
          <mesh scale={[1.1, 0.92, 1]} castShadow>
            <sphereGeometry args={[0.42, 40, 40]} />
            <Toon color={color} />
            <Ink />
          </mesh>
          <Ears species={species} color={color} inner={inner} />
          <group ref={eyes}>
            {[-1, 1].map((s) => (
              <group key={s} position={[s * 0.14, 0.02, 0.392]}>
                <mesh scale={[0.85, 1.15, 0.6]}>
                  <sphereGeometry args={[0.045, 16, 16]} />
                  <meshBasicMaterial color="#2a1d1d" />
                </mesh>
                <mesh position={[0.013, 0.02, 0.025]}>
                  <sphereGeometry args={[0.014, 8, 8]} />
                  <meshBasicMaterial color="#ffffff" />
                </mesh>
              </group>
            ))}
          </group>
          {species === "chick" ? (
            <mesh position={[0, -0.07, 0.42]} rotation-x={Math.PI / 2}>
              <coneGeometry args={[0.045, 0.08, 10]} />
              <Toon color="#ff9f43" />
            </mesh>
          ) : (
            [-1, 1].map((s) => (
              <mesh key={s} position={[s * 0.028, -0.075, 0.41]} rotation-z={Math.PI}>
                <torusGeometry args={[0.028, 0.0075, 6, 16, Math.PI]} />
                <meshBasicMaterial color="#2a1d1d" />
              </mesh>
            ))
          )}
          {/* blush */}
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.27, -0.08, 0.32]} rotation-y={s * 0.6} scale={[1, 0.6, 0.25]}>
              <sphereGeometry args={[species === "hamster" ? 0.08 : 0.065, 16, 16]} />
              <meshBasicMaterial color="#ffa9bb" />
            </mesh>
          ))}
          <AccessoryMesh kind={accessory === "tie" ? "glasses" : accessory} />
        </group>
        <group ref={party} visible={false}>
          <Sparkles count={18} scale={[1.6, 1.4, 1.6]} position={[0, 1.2, 0]} size={7} speed={1.4} color="#ff9ec4" />
          <Sparkles count={18} scale={[1.6, 1.4, 1.6]} position={[0, 1.2, 0]} size={7} speed={1.4} color="#ffd166" />
          <Sparkles count={12} scale={[1.6, 1.4, 1.6]} position={[0, 1.2, 0]} size={6} speed={1.4} color="#9fd8ff" />
        </group>
      </group>
    </group>
  );
}

// ---------- Classroom furniture ----------

const METAL = "#a3a9ae";
const DESK_WOOD = "#e2ad70";

function Legs({ w, d, h }: { w: number; d: number; h: number }) {
  return (
    <>
      {[
        [-w / 2, -d / 2],
        [w / 2, -d / 2],
        [-w / 2, d / 2],
        [w / 2, d / 2],
      ].map(([x, z]) => (
        <mesh key={`${x}:${z}`} position={[x, h / 2, z]} castShadow>
          <cylinderGeometry args={[0.018, 0.018, h, 8]} />
          <meshStandardMaterial color={METAL} metalness={0.6} roughness={0.4} />
        </mesh>
      ))}
    </>
  );
}

function SchoolDesk({
  agent,
  look,
  state,
  seed,
  position,
}: {
  agent: Agent;
  look: Look;
  state: DeskState;
  seed: number;
  position: [number, number, number];
}) {
  const working = state.working.length > 0;
  return (
    <group position={position}>
      {/* desk */}
      <RoundedBox args={[1.0, 0.04, 0.55]} radius={0.015} position={[0, 0.74, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={DESK_WOOD} roughness={0.55} />
      </RoundedBox>
      <mesh position={[0, 0.63, -0.02]} castShadow>
        <boxGeometry args={[0.9, 0.12, 0.45]} />
        <meshStandardMaterial color="#8e959b" metalness={0.4} roughness={0.5} />
      </mesh>
      <Legs w={0.9} d={0.45} h={0.72} />
      {/* notebook + pencil case */}
      <mesh position={[-0.12, 0.765, 0.05]} rotation-y={0.15} receiveShadow>
        <boxGeometry args={[0.3, 0.01, 0.22]} />
        <meshStandardMaterial color={working ? "#ffffff" : "#f3eee2"} />
      </mesh>
      <mesh position={[0.3, 0.79, -0.12]} rotation-z={Math.PI / 2} castShadow>
        <capsuleGeometry args={[0.035, 0.18, 4, 8]} />
        <meshStandardMaterial color={look.inner} />
      </mesh>
      {/* chair, on the camera side of the desk */}
      <group position={[0, 0, 0.62]}>
        <RoundedBox args={[0.46, 0.035, 0.42]} radius={0.012} position={[0, 0.44, 0]} castShadow receiveShadow>
          <meshStandardMaterial color={DESK_WOOD} roughness={0.55} />
        </RoundedBox>
        <RoundedBox args={[0.46, 0.26, 0.03]} radius={0.012} position={[0, 0.8, 0.2]} castShadow>
          <meshStandardMaterial color={DESK_WOOD} roughness={0.55} />
        </RoundedBox>
        <Legs w={0.4} d={0.36} h={0.43} />
        {[-0.2, 0.2].map((x) => (
          <mesh key={x} position={[x, 0.64, 0.2]}>
            <cylinderGeometry args={[0.014, 0.014, 0.4, 8]} />
            <meshStandardMaterial color={METAL} metalness={0.6} roughness={0.4} />
          </mesh>
        ))}
        <group position={[0, 0.46, 0]}>
          <Mochi
            look={look}
            accessory={ACCESSORY[agent.id] ?? null}
            facing={working ? "back" : "front"}
            action={working ? "write" : "idle"}
            lastDoneAt={state.lastDoneAt}
            seed={seed}
          />
        </group>
      </group>
      <Label
        name={`${agent.name} · ${agent.role}`}
        bubble={working ? state.working[0] : undefined}
        position={[0, 1.95, 0.62]}
      />
    </group>
  );
}

function ClockHand({ len, w, color, z, unit }: { len: number; w: number; color: string; z: number; unit: "h" | "m" | "s" }) {
  const ref = useRef<Group>(null);
  useFrame(() => {
    if (!ref.current) return;
    const d = new Date();
    const s = d.getSeconds() + d.getMilliseconds() / 1000;
    const m = d.getMinutes() + s / 60;
    const h = (d.getHours() % 12) + m / 60;
    const turn = unit === "h" ? h / 12 : unit === "m" ? m / 60 : s / 60;
    ref.current.rotation.z = -turn * Math.PI * 2;
  });
  return (
    <group ref={ref} position={[0, 0, z]}>
      <mesh position={[0, len / 2 - 0.02, 0]}>
        <planeGeometry args={[w, len]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  );
}

/** Wall clock showing the viewer's real time. */
function Clock({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[0.28, 0.28, 0.05, 32]} />
        <meshStandardMaterial color="#5a3a2a" />
      </mesh>
      <mesh position={[0, 0, 0.03]}>
        <circleGeometry args={[0.24, 32]} />
        <meshBasicMaterial color="#fffdf5" />
      </mesh>
      {Array.from({ length: 12 }, (_, i) => (
        <mesh key={i} position={[Math.sin((i / 12) * Math.PI * 2) * 0.2, Math.cos((i / 12) * Math.PI * 2) * 0.2, 0.035]}>
          <circleGeometry args={[i % 3 ? 0.008 : 0.016, 8]} />
          <meshBasicMaterial color="#3a2a2a" />
        </mesh>
      ))}
      <ClockHand unit="h" len={0.13} w={0.022} color="#2a1d1d" z={0.04} />
      <ClockHand unit="m" len={0.19} w={0.014} color="#2a1d1d" z={0.045} />
      <ClockHand unit="s" len={0.2} w={0.006} color="#d33333" z={0.05} />
      <mesh position={[0, 0, 0.055]}>
        <circleGeometry args={[0.015, 12]} />
        <meshBasicMaterial color="#2a1d1d" />
      </mesh>
    </group>
  );
}

/** The chalkboard lists the live subtasks in chalk. */
function Chalkboard({ lines, manager, z }: { lines: BoardLine[]; manager: ManagerState; z: number }) {
  const key = JSON.stringify([lines, manager]);
  const tex = useDisposable(() => {
    const [l, m] = JSON.parse(key) as [BoardLine[], ManagerState];
    return boardTexture(l, m);
  }, key);
  return (
    <group position={[0, 1.95, z]}>
      <mesh position={[0, 0, -0.02]}>
        <boxGeometry args={[4.2, 1.75, 0.05]} />
        <meshStandardMaterial color="#b07a45" />
      </mesh>
      <mesh position={[0, 0, 0.01]}>
        <planeGeometry args={[4.0, 1.56]} />
        <meshStandardMaterial map={tex} roughness={0.95} />
      </mesh>
      <mesh position={[0, -0.86, 0.06]}>
        <boxGeometry args={[4.2, 0.04, 0.12]} />
        <meshStandardMaterial color="#9a6a3c" />
      </mesh>
      {["#ffffff", "#ffd166", "#ff9ec4"].map((c, i) => (
        <mesh key={c} position={[1.2 + i * 0.12, -0.83, 0.07]} rotation-z={Math.PI / 2}>
          <cylinderGeometry args={[0.012, 0.012, 0.09, 8]} />
          <meshStandardMaterial color={c} />
        </mesh>
      ))}
    </group>
  );
}

function NoticeBoard({ x, z, seed }: { x: number; z: number; seed: number }) {
  const notes = useMemo(() => {
    const rnd = seeded(seed);
    return Array.from({ length: 5 }, (_, i) => ({
      x: -0.35 + (i % 3) * 0.35 + rnd() * 0.06,
      y: 0.35 - Math.floor(i / 3) * 0.55 - rnd() * 0.1,
      r: (rnd() - 0.5) * 0.3,
      c: ["#fffaf0", "#ffe4ec", "#e3f6ff", "#fff3c4", "#e9ffe9"][i],
      h: 0.32 + rnd() * 0.12,
    }));
  }, [seed]);
  return (
    <group position={[x, 1.95, z]}>
      <mesh position={[0, 0, -0.02]}>
        <boxGeometry args={[1.2, 1.4, 0.05]} />
        <meshStandardMaterial color="#9a6a3c" />
      </mesh>
      <mesh position={[0, 0, 0.01]}>
        <planeGeometry args={[1.1, 1.3]} />
        <meshStandardMaterial color="#d7a36a" roughness={1} />
      </mesh>
      {notes.map((n, i) => (
        <group key={i} position={[n.x, n.y, 0.02 + i * 0.002]} rotation-z={n.r}>
          <mesh>
            <planeGeometry args={[0.26, n.h]} />
            <meshStandardMaterial color={n.c} />
          </mesh>
          {[0, 1, 2].map((k) => (
            <mesh key={k} position={[0, n.h / 2 - 0.08 - k * 0.06, 0.001]}>
              <planeGeometry args={[0.18 - k * 0.03, 0.012]} />
              <meshBasicMaterial color="#9aa3b5" />
            </mesh>
          ))}
          <mesh position={[0, n.h / 2 - 0.03, 0.01]}>
            <sphereGeometry args={[0.018, 8, 8]} />
            <meshStandardMaterial color={["#e74c3c", "#3498db", "#f1c40f"][i % 3]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Cabinet({ position }: { position: [number, number, number] }) {
  const books = useMemo(() => {
    const rnd = seeded(5);
    return Array.from({ length: 14 }, (_, i) => ({
      x: -0.38 + i * 0.058,
      h: 0.2 + rnd() * 0.08,
      c: ["#c0392b", "#2e86c1", "#27ae60", "#f39c12", "#8e44ad", "#16a085"][i % 6],
    }));
  }, []);
  return (
    <group position={position}>
      <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.95, 1.0, 0.4]} />
        <meshStandardMaterial color="#b07a45" />
      </mesh>
      {[0.3, 0.72].map((y) => (
        <group key={y}>
          <mesh position={[0, y + 0.12, 0.15]}>
            <boxGeometry args={[0.85, 0.32, 0.12]} />
            <meshStandardMaterial color="#5b3a22" />
          </mesh>
          {books.map((b, i) => (
            <mesh key={i} position={[b.x, y + b.h / 2 - 0.02, 0.19]}>
              <boxGeometry args={[0.05, b.h, 0.06]} />
              <meshStandardMaterial color={b.c} />
            </mesh>
          ))}
        </group>
      ))}
      <mesh position={[0, 1.27, 0]} castShadow>
        <boxGeometry args={[0.7, 0.5, 0.15]} />
        <meshStandardMaterial color="#222222" />
      </mesh>
      <mesh position={[0, 1.27, 0.08]}>
        <planeGeometry args={[0.62, 0.42]} />
        <meshStandardMaterial color="#1b2a33" emissive="#4fc3d1" emissiveIntensity={0.15} />
      </mesh>
    </group>
  );
}

function Plant({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.2, 0]} castShadow>
        <cylinderGeometry args={[0.18, 0.14, 0.4, 20]} />
        <meshToonMaterial color="#e07a5f" />
      </mesh>
      {[
        [0, 0.6, 0, 0.26],
        [0.12, 0.78, 0.04, 0.18],
        [-0.12, 0.74, -0.04, 0.2],
      ].map(([x, y, z, r], i) => (
        <mesh key={i} position={[x, y, z]} castShadow>
          <sphereGeometry args={[r, 16, 16]} />
          <meshToonMaterial color="#5cb85c" />
        </mesh>
      ))}
    </group>
  );
}

function Classroom({ width, back, front }: { width: number; back: number; front: number }) {
  const depth = front - back;
  const cz = (front + back) / 2;
  const H = 4;
  const floor = useDisposable(() => woodTexture(width / 2.5, depth / 2.5), `${width}:${depth}`);
  const sky = useDisposable(skyTexture, "sky");
  const windowCount = Math.max(2, Math.floor((depth - 1.2) / 1.8));
  const paneW = (depth - 1.2) / windowCount;

  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, cz]} receiveShadow>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial map={floor} roughness={0.5} />
      </mesh>
      {/* ceiling + fluorescent lights */}
      <mesh rotation-x={Math.PI / 2} position={[0, H, cz]}>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color="#f3ecdc" />
      </mesh>
      {[-width / 4, width / 4].flatMap((x) =>
        [back + depth * 0.3, back + depth * 0.7].map((z) => (
          <group key={`${x}:${z}`} position={[x, H - 0.05, z]}>
            <mesh>
              <boxGeometry args={[0.2, 0.06, 1.5]} />
              <meshStandardMaterial color="#d9d9d9" />
            </mesh>
            <mesh position={[0, -0.035, 0]}>
              <boxGeometry args={[0.08, 0.03, 1.4]} />
              <meshBasicMaterial color="#ffffff" toneMapped={false} />
            </mesh>
          </group>
        )),
      )}
      {/* back wall: cream with a darker lower band */}
      <mesh position={[0, H / 2, back]} receiveShadow>
        <planeGeometry args={[width, H]} />
        <meshStandardMaterial color="#ecd6a6" />
      </mesh>
      <mesh position={[0, 0.45, back + 0.01]}>
        <planeGeometry args={[width, 0.9]} />
        <meshStandardMaterial color="#d9b47c" />
      </mesh>
      <mesh position={[-width / 2, H / 2, cz]} rotation-y={Math.PI / 2} receiveShadow>
        <planeGeometry args={[depth, H]} />
        <meshStandardMaterial color="#f1e4c6" />
      </mesh>
      <mesh position={[width / 2, H / 2, cz]} rotation-y={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[depth, H]} />
        <meshStandardMaterial color="#f1e4c6" />
      </mesh>
      {(
        [
          [0, back + 0.02, 0, width],
          [-width / 2 + 0.02, cz, Math.PI / 2, depth],
          [width / 2 - 0.02, cz, -Math.PI / 2, depth],
        ] as const
      ).map(([x, z, r, len], i) => (
        <mesh key={i} position={[x, 0.07, z]} rotation-y={r}>
          <planeGeometry args={[len, 0.14]} />
          <meshStandardMaterial color="#8a5a32" />
        </mesh>
      ))}

      {/* left wall: big sunny windows with curtains */}
      {Array.from({ length: windowCount }, (_, i) => (
        <group key={i} position={[-width / 2 + 0.02, 2.15, back + 0.6 + paneW * (i + 0.5)]} rotation-y={Math.PI / 2}>
          <mesh>
            <planeGeometry args={[paneW - 0.12, 2.1]} />
            <meshBasicMaterial map={sky} toneMapped={false} />
          </mesh>
          <mesh position={[0, 0, 0.01]}>
            <planeGeometry args={[paneW - 0.12, 0.05]} />
            <meshStandardMaterial color="#5f6b70" />
          </mesh>
          <mesh position={[0, 0, 0.01]}>
            <planeGeometry args={[0.05, 2.1]} />
            <meshStandardMaterial color="#5f6b70" />
          </mesh>
          <mesh position={[0, -1.08, 0.04]}>
            <boxGeometry args={[paneW, 0.06, 0.12]} />
            <meshStandardMaterial color="#c9cfd2" />
          </mesh>
        </group>
      ))}
      {[back + 0.4, front - 0.5].map((z) => (
        <group key={z} position={[-width / 2 + 0.12, 2.1, z]}>
          {[-0.12, 0, 0.12].map((dz) => (
            <mesh key={dz} position={[(dz + 0.12) * 0.3, 0, dz]} castShadow>
              <cylinderGeometry args={[0.07, 0.08, 2.8, 12]} />
              <meshToonMaterial color="#d9546e" />
            </mesh>
          ))}
        </group>
      ))}

      {/* right wall: sliding doors */}
      {[back + 1.1, front - 1.3].map((z) => (
        <group key={z} position={[width / 2 - 0.02, 0, z]} rotation-y={-Math.PI / 2}>
          <mesh position={[0, 1.1, 0]}>
            <boxGeometry args={[1.1, 2.2, 0.05]} />
            <meshStandardMaterial color="#a0693b" />
          </mesh>
          <mesh position={[0, 1.6, 0.03]}>
            <planeGeometry args={[0.6, 0.55]} />
            <meshBasicMaterial map={sky} toneMapped={false} />
          </mesh>
          <mesh position={[0.4, 1.0, 0.04]}>
            <boxGeometry args={[0.04, 0.2, 0.03]} />
            <meshStandardMaterial color="#555555" />
          </mesh>
        </group>
      ))}

      <Plant position={[-width / 2 + 0.5, 0, front - 1.2]} />
      <Plant position={[width / 2 - 0.5, 0, back + 2.3]} />
    </group>
  );
}

const MANAGER_LOOK: Look = { species: "chick", color: "#fff1a6", inner: "#ffb347" };

function Teacher({ state, x, z }: { state: ManagerState; x: number; z: number }) {
  const label = {
    idle: "Waiting for tasks",
    planning: "Planning the work…",
    watching: "Watching the class…",
    merging: "Merging results…",
  }[state];
  return (
    <group>
      {/* teacher's desk */}
      <group position={[-0.5, 0, z + 0.2]}>
        <RoundedBox args={[1.5, 0.05, 0.7]} radius={0.015} position={[0, 0.78, 0]} castShadow receiveShadow>
          <meshStandardMaterial color="#c58a50" />
        </RoundedBox>
        <mesh position={[0, 0.39, -0.1]} castShadow>
          <boxGeometry args={[1.4, 0.76, 0.45]} />
          <meshStandardMaterial color="#b07a45" />
        </mesh>
        <mesh position={[0.45, 0.86, 0]}>
          <boxGeometry args={[0.32, 0.1, 0.24]} />
          <meshStandardMaterial color="#e3dccf" />
        </mesh>
        <mesh position={[-0.4, 0.88, 0.05]} castShadow>
          <cylinderGeometry args={[0.07, 0.06, 0.14, 16]} />
          <meshToonMaterial color="#9fd8ff" />
        </mesh>
      </group>
      <group position={[x, 0, z]}>
        <Mochi
          look={MANAGER_LOOK}
          accessory="tie"
          facing={state === "planning" ? "back" : "front"}
          action={state === "planning" ? "chalk" : state === "merging" ? "wave" : "idle"}
          seed={42}
          scale={1.3}
        />
      </group>
      <Label name="Max · Manager" bubble={label} position={[x, 2.3, z]} />
    </group>
  );
}

export default function OfficeScene({
  agents,
  desks,
  manager,
  board,
}: {
  agents: Agent[];
  desks: Record<string, DeskState>;
  manager: ManagerState;
  board: BoardLine[];
}) {
  const cols = agents.length <= 3 ? Math.max(1, agents.length) : agents.length <= 6 ? 3 : 4;
  const rows = Math.max(1, Math.ceil(agents.length / cols));
  const spacingX = 2.1;
  const spacingZ = 2.15;
  const width = Math.max(8.6, cols * spacingX + 3.6);
  const back = -4;
  const firstRow = -1;
  const front = firstRow + (rows - 1) * spacingZ + 3.2;

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [0.5, 3.4, front + 1.6], fov: 50 }}
      fallback={<div className="grid h-full place-items-center text-sm text-muted">3D view needs WebGL.</div>}
    >
      <color attach="background" args={["#2b1718"]} />
      <ambientLight intensity={0.55} color="#fff2e0" />
      <hemisphereLight args={["#fff6e5", "#c9955c", 0.8]} />
      {/* warm afternoon sun through the left windows */}
      <directionalLight
        position={[-width / 2 - 4, 6, (back + front) / 2 + 1.5]}
        intensity={2.3}
        color="#ffd29a"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-9}
        shadow-camera-right={9}
        shadow-camera-top={9}
        shadow-camera-bottom={-9}
        shadow-bias={-0.0005}
      />
      <Classroom width={width} back={back} front={front} />
      <Chalkboard lines={board} manager={manager} z={back + 0.03} />
      <NoticeBoard x={-2.85} z={back + 0.03} seed={21} />
      <NoticeBoard x={2.85} z={back + 0.03} seed={34} />
      <Clock position={[0, 3.3, back + 0.04]} />
      {[-1.1, 1.1].map((x) => (
        <group key={x} position={[x, 3.3, back + 0.03]}>
          <mesh>
            <boxGeometry args={[0.5, 0.36, 0.03]} />
            <meshStandardMaterial color="#5a3a2a" />
          </mesh>
          <mesh position={[0, 0, 0.02]}>
            <planeGeometry args={[0.42, 0.28]} />
            <meshStandardMaterial color="#f7f1e3" />
          </mesh>
        </group>
      ))}
      <Cabinet position={[width / 2 - 0.6, 0, back + 0.35]} />
      <Teacher state={manager} x={1.3} z={back + 1.1} />
      {agents.map((a, i) => {
        const row = Math.floor(i / cols);
        const inRow = Math.min(cols, agents.length - row * cols);
        const x = ((i % cols) - (inRow - 1) / 2) * spacingX;
        const z = firstRow + row * spacingZ;
        return (
          <SchoolDesk
            key={a.id}
            agent={a}
            look={LOOKS[i % LOOKS.length]}
            state={desks[a.id] ?? { working: [] }}
            seed={i * 1.7}
            position={[x, 0, z]}
          />
        );
      })}
      <ContactShadows position={[0, 0.005, (back + front) / 2]} opacity={0.3} scale={22} blur={2.4} far={3} />
      <OrbitControls
        target={[0, 1.3, back + 2.2]}
        enablePan={false}
        minDistance={2.5}
        maxDistance={front - back + 3}
        minPolarAngle={0.6}
        maxPolarAngle={1.5}
        minAzimuthAngle={-0.8}
        maxAzimuthAngle={0.8}
      />
    </Canvas>
  );
}
