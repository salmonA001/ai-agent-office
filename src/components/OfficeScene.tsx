"use client";

import { Billboard, OrbitControls, Outlines, RoundedBox, Sparkles, Text } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { memo, useEffect, useRef, useState } from "react";
import { CanvasTexture, type Group, type Mesh, SRGBColorSpace } from "three";
import type { Agent } from "@/lib/agents";
import {
  type BoardLine,
  FLOOR,
  MANAGER_TV,
  OfficeChair,
  OfficeFloor,
  Planter,
  PRESENTER,
  Projector,
} from "./OfficeFloor";
import { type Home, type P2, type Spot, type WalkPhase, Wanderer } from "./office-nav";
import { clip, hash, reducedMotion, useDisposable } from "./scene-utils";

export type { BoardLine } from "./OfficeFloor";
export type DeskState = { working: string[]; lastDoneAt?: number; screen: ScreenState };
export type ManagerState = "idle" | "planning" | "watching" | "merging";
type V3 = [number, number, number];

const FONT = "/fonts/Geist-Regular.ttf";
const INK = "#4a3535";

// ---------- Labels ----------

/** Name tag plus an optional speech bubble, always facing the camera. Drawn in WebGL (no DOM). */
function Label({
  name,
  bubble,
  position,
  scale = 1,
  lift = 0,
}: {
  name: string;
  bubble?: string;
  position: V3;
  scale?: number;
  lift?: number;
}) {
  const tag = clip(name, 26);
  const say = bubble ? clip(bubble, 24) : null;
  return (
    <Billboard position={position} scale={scale}>
      {say && (
        <group position={[0, 0.34 + lift, 0]}>
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
type Action = "idle" | "write" | "chalk" | "wave" | "walk" | "sip" | "play";
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
  const feet = useRef<(Mesh | null)[]>([]);
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

    const walking = action === "walk" && !cheering;
    feet.current.forEach((f, i) => {
      if (!f) return;
      const step = walking ? Math.sin(t * 9 + i * Math.PI) : 0;
      f.position.z = 0.22 + step * 0.09;
      f.position.y = 0.05 + Math.max(0, step) * 0.05;
    });

    let y: number;
    if (cheering) y = Math.abs(Math.sin(since * Math.PI * 3)) * 0.28;
    else if (walking) y = Math.abs(Math.sin(t * 9)) * 0.06;
    else if (action === "idle") {
      const hop = t % 7;
      y = Math.sin(t * 2) * 0.015 + (hop < 0.45 ? Math.sin((hop / 0.45) * Math.PI) * 0.1 : 0);
    } else y = Math.abs(Math.sin(t * 8)) * 0.012;
    root.current.position.y = y;
    root.current.rotation.z = walking
      ? Math.sin(t * 9) * 0.07
      : action === "idle" && !cheering
        ? Math.sin(t * 1.4) * 0.05
        : 0;

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
    } else if (walking) {
      L.set(Math.sin(t * 9) * 0.65, 0, -0.25);
      R.set(-Math.sin(t * 9) * 0.65, 0, 0.25);
    } else if (action === "sip") {
      // cup to mouth every few seconds
      const lift = Math.sin(t * 1.2) > 0.3 ? 1 : 0;
      L.set(-0.15, 0, -0.3);
      R.set(-0.9 - lift * 1.1, 0, -0.35 * lift);
    } else if (action === "play") {
      L.set(-0.3, 0, -0.3);
      R.set(-1.2 + Math.sin(t * 10) * 0.8, 0, 0.35);
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
        {[-1, 1].map((s, i) => (
          <mesh
            key={s}
            ref={(m) => {
              feet.current[i] = m;
            }}
            position={[s * 0.15, 0.05, 0.22]}
            scale={[1, 0.65, 1.3]}
            castShadow
          >
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

// ---------- Workstations (3D PCs with live screens) ----------

export type ScreenMode = "idle" | "planning" | "queued" | "working" | "done" | "error";
export type ScreenState = { mode: ScreenMode; title?: string; text?: string; len?: number };

const TERM_FONT = 'ui-monospace, "Cascadia Mono", Consolas, "Courier New", monospace';
const SCREEN_LABEL: Record<ScreenMode, string> = {
  idle: "idle",
  planning: "standing by",
  queued: "queued",
  working: "working",
  done: "done",
  error: "error",
};

/** Plain-text lines for the monitor: Markdown symbols stripped, hard-wrapped to the screen width. */
function terminalLines(text: string, width: number) {
  const out: string[] = [];
  for (const raw of text.replace(/\r/g, "").split("\n")) {
    const line = raw.replace(/[#*`_>|]/g, "").trimEnd();
    if (!line) {
      if (out.at(-1) !== "") out.push("");
      continue;
    }
    for (let i = 0; i < line.length; i += width) out.push(line.slice(i, i + width));
  }
  return out;
}

function screenTexture(screen: ScreenState, name: string) {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 320;
  const g = c.getContext("2d")!;
  const bg = g.createLinearGradient(0, 0, 0, 320);
  bg.addColorStop(0, "#071a11");
  bg.addColorStop(1, "#020805");
  g.fillStyle = bg;
  g.fillRect(0, 0, 512, 320);
  g.strokeStyle = "rgba(52,211,153,0.07)";
  for (let x = 0; x <= 512; x += 32) g.strokeRect(x, 0, 0, 320);
  for (let y = 0; y <= 320; y += 32) g.strokeRect(0, y, 512, 0);

  // window title bar
  g.fillStyle = "rgba(16,185,129,0.2)";
  g.fillRect(0, 0, 512, 34);
  ["#f87171", "#fbbf24", "#34d399"].forEach((col, i) => {
    g.fillStyle = col;
    g.beginPath();
    g.arc(18 + i * 18, 17, 6, 0, Math.PI * 2);
    g.fill();
  });
  g.font = `600 16px ${TERM_FONT}`;
  g.fillStyle = "#a7f3d0";
  g.fillText(`${name.toLowerCase()}@office: ${SCREEN_LABEL[screen.mode]}`, 80, 23);

  g.textAlign = "center";
  const title = screen.title ? clip(screen.title, 34) : "";
  switch (screen.mode) {
    case "idle":
      g.fillStyle = "#34d399";
      g.font = `700 40px ${TERM_FONT}`;
      g.fillText("READY", 256, 165);
      g.fillStyle = "#6ee7b7";
      g.font = `500 18px ${TERM_FONT}`;
      g.fillText("waiting for a task_", 256, 200);
      break;
    case "planning":
      g.fillStyle = "#6ee7b7";
      g.font = `600 22px ${TERM_FONT}`;
      g.fillText("Manager is planning…", 256, 250);
      g.font = `500 16px ${TERM_FONT}`;
      g.fillStyle = "#a7f3d0";
      g.fillText("listening for my assignment", 256, 280);
      break;
    case "queued":
      g.fillStyle = "#6ee7b7";
      g.font = `600 20px ${TERM_FONT}`;
      g.fillText("Up next:", 256, 240);
      g.fillStyle = "#ecfdf5";
      g.fillText(title, 256, 270);
      break;
    case "done":
      g.fillStyle = "#34d399";
      g.font = `800 52px ${TERM_FONT}`;
      g.fillText("✓ DONE", 256, 160);
      g.fillStyle = "#a7f3d0";
      g.font = `500 18px ${TERM_FONT}`;
      g.fillText(title, 256, 200);
      break;
    case "error":
      g.fillStyle = "#fca5a5";
      g.font = `800 46px ${TERM_FONT}`;
      g.fillText("✗ ERROR", 256, 160);
      g.font = `500 18px ${TERM_FONT}`;
      g.fillText(title, 256, 200);
      break;
    case "working": {
      g.textAlign = "left";
      g.fillStyle = "#34d399";
      g.font = `700 17px ${TERM_FONT}`;
      g.fillText(`> ${title}`, 16, 60);
      const lines = terminalLines(screen.text ?? "", 44).slice(-10);
      g.font = `500 16px ${TERM_FONT}`;
      if (lines.length === 0) {
        g.fillStyle = "#6ee7b7";
        g.fillText("thinking…▌", 16, 88);
      }
      lines.forEach((l, i) => {
        const last = i === lines.length - 1;
        g.fillStyle = last ? "#ecfdf5" : "#6ee7b7";
        g.fillText(last ? `${l}▌` : l, 16, 88 + i * 22);
      });
      break;
    }
  }
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function Workstation({ screen, name, seed }: { screen: ScreenState; name: string; seed: number }) {
  // Redraw the screen texture only every ~30 streamed characters.
  const key = `${screen.mode}|${screen.title ?? ""}|${Math.floor((screen.len ?? 0) / 30)}|${name}`;
  const tex = useDisposable(() => screenTexture(screen, name), key);
  const scan = useRef<Mesh>(null);
  const spinner = useRef<Group>(null);
  const flash = useRef<Mesh>(null);
  const led = useRef<Mesh>(null);
  const [still] = useState(reducedMotion);
  const working = screen.mode === "working";
  const waiting = screen.mode === "planning" || screen.mode === "queued";

  useFrame(({ clock }) => {
    const t = clock.elapsedTime + seed;
    if (scan.current) {
      scan.current.visible = working && !still;
      scan.current.position.y = 0.155 - ((t * 0.35) % 1) * 0.31;
    }
    if (spinner.current) {
      spinner.current.visible = waiting;
      if (!still) spinner.current.rotation.z = -t * 4;
    }
    if (flash.current) {
      flash.current.visible = working && !still;
      const step = Math.floor(t * 14) + seed * 1000;
      flash.current.position.set(-0.17 + hash(step) * 0.34, 0.012, -0.045 + hash(step + 0.5) * 0.09);
    }
    if (led.current) led.current.visible = !working || Math.floor(t * 6) % 2 === 0;
  });

  return (
    <group>
      {/* monitor at the back of the desk; the high camera sees it over the worker */}
      <group position={[0, 0.765, -0.2]} scale={1.25}>
        <mesh position={[0, 0.008, 0]} castShadow>
          <cylinderGeometry args={[0.09, 0.1, 0.016, 24]} />
          <meshStandardMaterial color="#1f2937" metalness={0.5} roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.1, -0.02]} castShadow>
          <boxGeometry args={[0.035, 0.18, 0.03]} />
          <meshStandardMaterial color="#1f2937" metalness={0.5} roughness={0.4} />
        </mesh>
        <group position={[0, 0.36, 0]}>
          <RoundedBox args={[0.6, 0.39, 0.035]} radius={0.015} castShadow>
            <meshStandardMaterial color="#0b0f0d" roughness={0.35} />
          </RoundedBox>
          <mesh position={[0, 0.005, 0.0185]}>
            <planeGeometry args={[0.56, 0.35]} />
            <meshBasicMaterial map={tex} toneMapped={false} />
          </mesh>
          {/* scanline sweeping down while typing */}
          <mesh ref={scan} position={[0, 0, 0.02]} visible={false}>
            <planeGeometry args={[0.56, 0.012]} />
            <meshBasicMaterial color="#34d399" transparent opacity={0.35} toneMapped={false} />
          </mesh>
          {/* loading spinner while planning / queued */}
          <group ref={spinner} position={[0, 0.04, 0.021]} visible={false}>
            <mesh>
              <torusGeometry args={[0.055, 0.008, 8, 32, Math.PI * 1.4]} />
              <meshBasicMaterial color="#34d399" toneMapped={false} />
            </mesh>
          </group>
          <mesh ref={led} position={[0.26, -0.18, 0.019]}>
            <circleGeometry args={[0.006, 8]} />
            <meshBasicMaterial color="#34d399" toneMapped={false} />
          </mesh>
        </group>
      </group>
      {/* keyboard + mouse in front of the worker */}
      <group position={[0, 0.765, 0.1]}>
        <RoundedBox args={[0.42, 0.018, 0.13]} radius={0.006} position={[0, 0.009, 0]} castShadow>
          <meshStandardMaterial color="#111827" roughness={0.5} />
        </RoundedBox>
        {[-0.035, 0, 0.035].map((z) => (
          <mesh key={z} position={[0, 0.0185, z]} rotation-x={-Math.PI / 2}>
            <planeGeometry args={[0.38, 0.026]} />
            <meshStandardMaterial color="#374151" roughness={0.7} />
          </mesh>
        ))}
        <mesh ref={flash} rotation-x={-Math.PI / 2} visible={false}>
          <planeGeometry args={[0.03, 0.026]} />
          <meshBasicMaterial color="#6ee7b7" toneMapped={false} />
        </mesh>
        <mesh position={[0.29, 0.012, 0.01]} scale={[1, 0.5, 1.4]} castShadow>
          <sphereGeometry args={[0.03, 12, 12]} />
          <meshStandardMaterial color="#e5e7eb" />
        </mesh>
      </group>
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

function managerTexture(state: ManagerState, done: number, total: number) {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 300;
  const g = c.getContext("2d")!;
  const bg = g.createLinearGradient(0, 0, 0, 300);
  bg.addColorStop(0, "#071a11");
  bg.addColorStop(1, "#020805");
  g.fillStyle = bg;
  g.fillRect(0, 0, 512, 300);
  g.fillStyle = "rgba(16,185,129,0.2)";
  g.fillRect(0, 0, 512, 36);
  g.font = `700 18px ${TERM_FONT}`;
  g.fillStyle = "#a7f3d0";
  g.fillText("MAX // MISSION CONTROL", 16, 24);
  g.textAlign = "center";
  const title = {
    idle: "Ready for a task",
    planning: "Planning the work",
    watching: `Team progress ${done}/${total}`,
    merging: "Merging results",
  }[state];
  g.fillStyle = "#34d399";
  g.font = `800 34px ${TERM_FONT}`;
  g.fillText(title, 256, 120);
  g.font = `500 17px ${TERM_FONT}`;
  g.fillStyle = "#6ee7b7";
  const sub = {
    idle: "assign one from the panel below",
    planning: "splitting into subtasks…",
    watching: "agents are working in parallel",
    merging: "writing the final answer…",
  }[state];
  g.fillText(sub, 256, 155);
  // progress track (the moving bar is a separate mesh)
  g.fillStyle = "rgba(52,211,153,0.15)";
  g.fillRect(56, 210, 400, 18);
  if (state === "watching" && total > 0) {
    g.fillStyle = "#34d399";
    g.fillRect(56, 210, (400 * done) / total, 18);
  }
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Big monitor on the teacher's desk facing the class, with a sweeping bar while the manager thinks. */
function ManagerMonitor({ state, done, total }: { state: ManagerState; done: number; total: number }) {
  const tex = useDisposable(() => managerTexture(state, done, total), `${state}|${done}|${total}`);
  const bar = useRef<Mesh>(null);
  const [still] = useState(reducedMotion);
  const busy = state === "planning" || state === "merging";
  useFrame(({ clock }) => {
    if (!bar.current) return;
    bar.current.visible = busy;
    const p = still ? 0.5 : (clock.elapsedTime * 0.6) % 1;
    // The texture's 400px track spans 0.797 world units starting at x = -0.398.
    bar.current.position.x = -0.398 + 0.12 + p * (0.797 - 0.24);
  });
  return (
    <group position={[0.05, 0.805, -0.05]}>
      <mesh position={[0, 0.01, 0]} castShadow>
        <boxGeometry args={[0.3, 0.02, 0.18]} />
        <meshStandardMaterial color="#1f2937" metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.15, -0.03]} castShadow>
        <boxGeometry args={[0.05, 0.28, 0.04]} />
        <meshStandardMaterial color="#1f2937" metalness={0.5} roughness={0.4} />
      </mesh>
      <group position={[0, 0.5, 0]}>
        <RoundedBox args={[1.08, 0.66, 0.04]} radius={0.02} castShadow>
          <meshStandardMaterial color="#0b0f0d" roughness={0.35} />
        </RoundedBox>
        <mesh position={[0, 0, 0.021]}>
          <planeGeometry args={[1.02, 0.6]} />
          <meshBasicMaterial map={tex} toneMapped={false} />
        </mesh>
        <mesh ref={bar} position={[0, -0.6 * (219 / 300) + 0.3, 0.024]} visible={false}>
          <planeGeometry args={[0.24, 0.036]} />
          <meshBasicMaterial color="#34d399" toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}

/** Little glowing orbs circling the manager's head while it thinks. */
function ThinkingOrbs({ active }: { active: boolean }) {
  const ref = useRef<Group>(null);
  const [still] = useState(reducedMotion);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.visible = active;
    if (!still) {
      ref.current.rotation.y = clock.elapsedTime * 2.2;
      ref.current.position.y = 2.4 + Math.sin(clock.elapsedTime * 3) * 0.05;
    }
  });
  return (
    <group ref={ref} position={[0, 2.4, 0]} visible={false}>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[Math.cos((i / 4) * Math.PI * 2) * 0.75, 0, Math.sin((i / 4) * Math.PI * 2) * 0.75]}>
          <sphereGeometry args={[0.05, 12, 12]} />
          <meshBasicMaterial color={i % 2 ? "#34d399" : "#a7f3d0"} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

// ---------- Agent desks in the open workspace ----------

const LABEL_SCALE = 1.5;
/** Chibi scale: workers and their desks are drawn larger than the room furniture so they read at a glance. */
const DESK_SCALE = 1.35;
/** Mochi's seat height on the office chair, in world metres. */
const SEAT_Y = 0.5 * DESK_SCALE;
/** Chair offset from the desk centre, in world metres. */
const CHAIR_Z = 0.62 * DESK_SCALE;

type DeskProps = {
  agent: Agent;
  look: Look;
  state: DeskState;
  seed: number;
  position: V3;
};

function AgentDeskImpl({ agent, look, state, seed, position }: DeskProps) {
  return (
    <group position={position} scale={DESK_SCALE}>
      {/* desk with a fabric privacy screen at the back */}
      <RoundedBox args={[1.5, 0.05, 0.75]} radius={0.015} position={[0, 0.74, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#f4f4f2" roughness={0.45} />
      </RoundedBox>
      {[-0.7, 0.7].map((x) => (
        <mesh key={x} position={[x, 0.36, 0]} castShadow>
          <boxGeometry args={[0.05, 0.72, 0.68]} />
          <meshStandardMaterial color="#374151" />
        </mesh>
      ))}
      <mesh position={[0, 1.0, -0.39]} castShadow>
        <boxGeometry args={[1.5, 0.5, 0.04]} />
        <meshStandardMaterial color="#8f9aa1" roughness={0.95} />
      </mesh>
      <mesh position={[-0.55, 0.815, 0.05]} castShadow>
        <cylinderGeometry args={[0.05, 0.045, 0.1, 12]} />
        <meshStandardMaterial color={look.inner} />
      </mesh>
      <Workstation screen={state.screen} name={agent.name} seed={seed} />
      <OfficeChair p={[0, 0, 0.62]} />
    </group>
  );
}

/** Re-render a desk only when what it shows changes (streamed text is bucketed like the screen). */
const AgentDesk = memo(
  AgentDeskImpl,
  (a, b) =>
    a.agent === b.agent &&
    a.look === b.look &&
    a.seed === b.seed &&
    a.position.join() === b.position.join() &&
    a.state.screen.mode === b.state.screen.mode &&
    a.state.screen.title === b.state.screen.title &&
    Math.floor((a.state.screen.len ?? 0) / 30) === Math.floor((b.state.screen.len ?? 0) / 30),
);

// ---------- Agents that wander the office when idle ----------

type AvatarProps = {
  agent: Agent;
  look: Look;
  home: Home;
  /** working, queued, or listening to the plan: stay at (or rush back to) the desk */
  busy: boolean;
  working: boolean;
  attentive: boolean;
  bubble?: string;
  lastDoneAt?: number;
  seed: number;
  lift: number;
  canWander: boolean;
};

const ACTIVITY_ACTION: Record<Spot["activity"], Action> = { look: "idle", sip: "sip", play: "play", rest: "idle" };

function AgentAvatarImpl(props: AvatarProps) {
  const { agent, look, home, working, attentive, bubble, lastDoneAt, seed, lift } = props;
  const group = useRef<Group>(null);
  const live = useRef(props);
  useEffect(() => {
    live.current = props;
  });
  const [walker] = useState(() => new Wanderer(agent.id, home, SEAT_Y, 4 + ((seed * 7) % 8)));
  const [phase, setPhase] = useState<WalkPhase>(walker.phase);
  useEffect(() => () => walker.dispose(), [walker]);

  useFrame((_, delta) => {
    const g = group.current;
    if (!g) return;
    const p = live.current;
    if (walker.update(delta, p.home, p.busy, p.canWander)) setPhase(walker.phase);
    g.position.set(walker.x, walker.y, walker.z);
    g.rotation.y = walker.yaw;
  });

  const seated = phase.kind === "seated";
  const facing = seated && (working || attentive) ? "back" : "front";
  const action: Action = seated
    ? working
      ? "write"
      : "idle"
    : phase.kind === "walking"
      ? "walk"
      : ACTIVITY_ACTION[phase.spot.activity];
  const say = seated
    ? working
      ? bubble
      : undefined
    : phase.kind === "walking"
      ? phase.rushing
        ? "On my way!"
        : undefined
      : phase.spot.say;

  return (
    <group ref={group} position={[home.seat[0], SEAT_Y, home.seat[1]]} scale={DESK_SCALE}>
      <Mochi
        look={look}
        accessory={ACCESSORY[agent.id] ?? null}
        facing={facing}
        action={action}
        lastDoneAt={lastDoneAt}
        seed={seed}
      />
      <Label name={agent.name} bubble={say} position={[0, 1.55, 0]} scale={LABEL_SCALE} lift={lift} />
    </group>
  );
}

const AgentAvatar = memo(
  AgentAvatarImpl,
  (a, b) =>
    a.agent === b.agent &&
    a.look === b.look &&
    a.home.seat.join() === b.home.seat.join() &&
    a.home.aisleZ === b.home.aisleZ &&
    a.home.sideX === b.home.sideX &&
    a.busy === b.busy &&
    a.working === b.working &&
    a.attentive === b.attentive &&
    a.bubble === b.bubble &&
    a.lastDoneAt === b.lastDoneAt &&
    a.seed === b.seed &&
    a.lift === b.lift &&
    a.canWander === b.canWander,
);

const IDLE_DESK: DeskState = { working: [], screen: { mode: "idle" } };
const MANAGER_LOOK: Look = { species: "chick", color: "#fff1a6", inner: "#ffb347" };

/** Max presents at the projector in the meeting room. */
function Presenter({ state, board }: { state: ManagerState; board: BoardLine[] }) {
  const label = {
    idle: "Waiting for tasks",
    planning: "Planning the work…",
    watching: "Watching the team…",
    merging: "Merging results…",
  }[state];
  const done = board.filter((l) => l.status === "done").length;
  return (
    <group>
      <group position={[MANAGER_TV.x, -0.03, MANAGER_TV.z]} rotation-y={Math.PI / 2}>
        <ManagerMonitor state={state} done={done} total={board.length} />
      </group>
      <group position={[PRESENTER.x, 0, PRESENTER.z]}>
        <Mochi
          look={MANAGER_LOOK}
          accessory="tie"
          facing={state === "planning" ? "back" : "front"}
          action={state === "planning" ? "chalk" : state === "merging" ? "wave" : "idle"}
          seed={42}
          scale={1.7}
        />
        <ThinkingOrbs active={state === "planning" || state === "merging"} />
      </group>
      <Label name="Max · Manager" bubble={label} position={[PRESENTER.x, 2.75, PRESENTER.z]} scale={LABEL_SCALE * 1.3} />
    </group>
  );
}

/** Fit the orthographic camera to the floor whenever the canvas is resized. */
function CameraFit() {
  const get = useThree((s) => s.get);
  const width = useThree((s) => s.size.width);
  const height = useThree((s) => s.size.height);
  // Re-run once OrbitControls registers itself as the default controls.
  const hasControls = useThree((s) => Boolean(s.controls));
  useEffect(() => {
    const { camera, controls } = get();
    // Narrow screens crop the side walls a little so the desks stay readable.
    const zoom = Math.min(width / (width < 500 ? 16 : 20), height / 13);
    camera.zoom = zoom;
    camera.updateProjectionMatrix();
    const orbit = controls as unknown as { minZoom: number; maxZoom: number } | null;
    if (orbit) {
      orbit.minZoom = zoom * 0.7;
      orbit.maxZoom = zoom * 4;
    }
  }, [get, width, height, hasControls]);
  return null;
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
  // One row of desks for up to 4 agents, otherwise two rows facing the meeting rooms.
  const perRow = agents.length <= 4 ? Math.max(1, agents.length) : Math.ceil(agents.length / 2);
  const rows = Math.ceil(agents.length / perRow);
  const spacing = Math.min(2.4, 14 / perRow);
  const rowZ = rows === 1 ? [3.0] : [2.0, 4.2];
  const rowHalf = (perRow * spacing) / 2;
  // Agents walk out along the aisle behind their row to a side column, then into the office.
  const sideX = Math.max(4.6, rowHalf + 0.95);
  const [still] = useState(reducedMotion);
  const canWander = !still && sideX <= 7.2;

  return (
    <Canvas
      shadows
      orthographic
      dpr={[1, 1.5]}
      gl={{ powerPreference: "high-performance" }}
      camera={{ position: [13, 17, 15], zoom: 30, near: -100, far: 200 }}
      fallback={<div className="grid h-full place-items-center text-sm text-muted">3D view needs WebGL.</div>}
    >
      <color attach="background" args={["#030504"]} />
      <ambientLight intensity={0.85} />
      <hemisphereLight args={["#ffffff", "#c9c2b8", 1.0]} />
      {/* sun from the camera side so the workers' faces are lit */}
      <directionalLight
        position={[7, 15, 12]}
        intensity={1.6}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
        shadow-bias={-0.0005}
      />
      <OfficeFloor />
      <Projector lines={board} merging={manager === "merging"} />
      <group position={[-2.6 + 0.1, 1.5, -4.3]} rotation-y={Math.PI / 2}>
        <Clock position={[0, 0, 0]} />
      </group>
      <Presenter state={manager} board={board} />
      {rowZ.slice(0, rows).map((z) => (
        <group key={z}>
          <Planter p={[-rowHalf - 0.45, 0, z + 0.1]} len={0.9} r={Math.PI / 2} />
          <Planter p={[rowHalf + 0.45, 0, z + 0.1]} len={0.9} r={Math.PI / 2} />
        </group>
      ))}
      {agents.map((a, i) => {
        const row = Math.floor(i / perRow);
        const inRow = Math.min(perRow, agents.length - row * perRow);
        const col = i % perRow;
        const x = (col - (inRow - 1) / 2) * spacing;
        const z = rowZ[row] ?? FLOOR.z1 - 1;
        const state = desks[a.id] ?? IDLE_DESK;
        const attentive = manager === "planning";
        const seat: P2 = [x, z + CHAIR_Z];
        return (
          <group key={a.id}>
            <AgentDesk agent={a} look={LOOKS[i % LOOKS.length]} state={state} seed={i * 1.7} position={[x, 0, z]} />
            <AgentAvatar
              agent={a}
              look={LOOKS[i % LOOKS.length]}
              home={{ seat, aisleZ: seat[1] + 0.62, sideX: x <= 0 ? -sideX : sideX }}
              busy={attentive || state.screen.mode === "working" || state.screen.mode === "queued"}
              working={state.working.length > 0}
              attentive={attentive}
              bubble={state.working[0]}
              lastDoneAt={state.lastDoneAt}
              seed={i * 1.7}
              lift={col % 2 ? 0.45 : 0}
              canWander={canWander}
            />
          </group>
        );
      })}
      <OrbitControls
        makeDefault
        target={[0, 0.6, -0.9]}
        enablePan
        screenSpacePanning
        minPolarAngle={0.35}
        maxPolarAngle={1.2}
        minAzimuthAngle={-0.2}
        maxAzimuthAngle={1.6}
      />
      <CameraFit />
    </Canvas>
  );
}
