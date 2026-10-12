"use client";

import { Billboard, OrbitControls, Outlines, RoundedBox, Sparkles, Text } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { CanvasTexture, type Group, type Mesh, Object3D, type Sprite, type SpriteMaterial, SRGBColorSpace, Vector3 } from "three";
import type { Agent } from "@/lib/agents";
import {
  type BoardLine,
  EventProps,
  FLOOR,
  type FloorDecor,
  MANAGER_TV,
  OfficeChair,
  OfficeFloor,
  ZoneSigns,
  PRESENTER,
  Projector,
} from "./OfficeFloor";
import { type Key, type Lang, phrase, translate } from "@/lib/i18n";
import { phaseAt, useOfficeMinutes } from "@/lib/office-clock";
import { ACCENT_COLORS, DECOR_ITEMS, DESK_COLORS, type Phase, useOfficeCustom } from "@/lib/office-custom";
import { setAgentActivity } from "./agent-activity";
import { releaseFocus, useCameraFocus, ZONE_LOOK } from "./camera-focus";
import { currentEventKind, setAutoEvents, setEventHour, tickEvents, useGame } from "./office-events";
import {
  type Activity,
  DESK_SCALE,
  deskSlot,
  type Home,
  isPresent,
  MAX_DESKS,
  registerWalker,
  setBreakRules,
  setOfficeHour,
  SPOT_CATS,
  type WalkPhase,
  Wanderer,
} from "./office-nav";
import { useStill } from "@/lib/motion";
import { clip, hash, useDisposable } from "./scene-utils";

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

export type Species = "bear" | "bunny" | "cat" | "hamster" | "puppy" | "chick" | "owl";
type Accessory = "glasses" | "bow" | "headphones" | "flower" | "tie" | "beret" | "cap" | "beanie" | null;
type Action =
  | "idle"
  | "write"
  | "chalk"
  | "wave"
  | "walk"
  | "sip"
  | "play"
  | "read"
  | "phone"
  | "yoga"
  | "run"
  | "talk"
  | "nap"
  | "carry"
  | "lift"
  | "meditate";
type Look = { species: Species; color: string; inner: string };

const LOOKS: Look[] = [
  { species: "bear", color: "#fff6e9", inner: "#ffc7d1" },
  { species: "bunny", color: "#ffd9e4", inner: "#ff9fb8" },
  { species: "cat", color: "#e7defa", inner: "#ffc2d6" },
  { species: "hamster", color: "#ffdcb8", inner: "#ffb39a" },
  { species: "puppy", color: "#d6f3e6", inner: "#a8dcc5" },
  { species: "chick", color: "#fff1a6", inner: "#ffb347" },
  { species: "bear", color: "#f6d8bf", inner: "#ffb6a3" },
  { species: "bunny", color: "#e3dcff", inner: "#c4b5fd" },
  { species: "cat", color: "#d8f1ff", inner: "#a5d8ff" },
  { species: "hamster", color: "#fff0d6", inner: "#ffc078" },
  { species: "puppy", color: "#ffe3e3", inner: "#ffa8a8" },
];

/** More looks for bigger teams: cool pastels and owls. */
const MORE_LOOKS: Look[] = [
  { species: "owl", color: "#ddd0ff", inner: "#b8a4f0" },
  { species: "cat", color: "#cdd6ff", inner: "#a5b4fc" },
  { species: "bunny", color: "#d4e6ff", inner: "#93c5fd" },
  { species: "owl", color: "#eadfcd", inner: "#c9ab82" },
  { species: "puppy", color: "#dfe3ff", inner: "#c4b5fd" },
  { species: "hamster", color: "#ece6ff", inner: "#c4b5fd" },
];

const ACCESSORY: Record<string, Accessory> = {
  researcher: "glasses",
  writer: "bow",
  coder: "headphones",
  planner: "flower",
  designer: "beret",
  marketer: "cap",
  data: "glasses",
  qa: "headphones",
  translator: "bow",
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
  if (species === "owl") {
    return (
      <>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.27, 0.36, -0.02]} rotation-z={-s * 0.55} scale={[1, 1, 0.6]} castShadow>
            <coneGeometry args={[0.09, 0.22, 10]} />
            <Toon color={color} />
            <Ink />
          </mesh>
        ))}
        {/* pale face disc around the eyes */}
        <mesh position={[0, 0.02, 0.33]} scale={[1.25, 0.85, 0.25]}>
          <sphereGeometry args={[0.2, 20, 14]} />
          <Toon color="#fffaf2" />
        </mesh>
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
  if (kind === "beret") {
    return (
      <group position={[0.05, 0.36, -0.02]} rotation-z={-0.25}>
        <mesh scale={[1, 0.35, 1]}>
          <sphereGeometry args={[0.3, 20, 12]} />
          <Toon color="#be123c" />
          <Ink t={0.008} />
        </mesh>
        <mesh position={[0, 0.1, 0]}>
          <cylinderGeometry args={[0.015, 0.015, 0.06, 6]} />
          <Toon color="#be123c" />
        </mesh>
      </group>
    );
  }
  if (kind === "cap") {
    return (
      <group position={[0, 0.3, 0]}>
        <mesh scale={[1, 0.55, 1]}>
          <sphereGeometry args={[0.36, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <Toon color="#10b981" />
          <Ink t={0.008} />
        </mesh>
        <mesh position={[0, 0.01, 0.34]} rotation-x={0.12} scale={[1, 0.15, 1]}>
          <cylinderGeometry args={[0.24, 0.24, 0.12, 20, 1, false, -Math.PI / 2, Math.PI]} />
          <Toon color="#059669" />
        </mesh>
      </group>
    );
  }
  if (kind === "beanie") {
    return (
      <group position={[0, 0.14, -0.01]}>
        <mesh scale={[1.12, 0.78, 1.04]}>
          <sphereGeometry args={[0.4, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <Toon color="#3b4a8f" />
          <Ink t={0.008} />
        </mesh>
        <mesh position={[0, 0.02, 0]} scale={[1.12, 1, 1.04]}>
          <cylinderGeometry args={[0.405, 0.405, 0.08, 28]} />
          <Toon color="#5566b0" />
        </mesh>
        <mesh position={[0, 0.33, 0]}>
          <sphereGeometry args={[0.07, 12, 10]} />
          <Toon color="#f8fafc" />
        </mesh>
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
  const still = useStill();

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

    const walking = (action === "walk" || action === "run" || action === "carry") && !cheering;
    const pace = action === "run" ? 13 : 9;
    feet.current.forEach((f, i) => {
      if (!f) return;
      const step = walking ? Math.sin(t * pace + i * Math.PI) : 0;
      f.position.z = 0.22 + step * 0.09;
      f.position.y = 0.05 + Math.max(0, step) * 0.05;
    });

    let y: number;
    if (cheering) y = Math.abs(Math.sin(since * Math.PI * 3)) * 0.28;
    else if (walking) y = Math.abs(Math.sin(t * pace)) * (action === "run" ? 0.09 : 0.06);
    else if (action === "idle") {
      const hop = t % 7;
      y = Math.sin(t * 2) * 0.015 + (hop < 0.45 ? Math.sin((hop / 0.45) * Math.PI) * 0.1 : 0);
    } else if (action === "nap" || action === "read" || action === "yoga") y = 0;
    else if (action === "meditate") y = Math.sin(t * 0.9) * 0.012;
    else y = Math.abs(Math.sin(t * 8)) * 0.012;
    root.current.position.y = y;
    root.current.rotation.z = walking
      ? Math.sin(t * pace) * 0.07
      : action === "idle" && !cheering
        ? Math.sin(t * 1.4) * 0.05
        : action === "yoga" && !cheering
          ? Math.sin(t * 0.8) * 0.1
          : 0;

    const nod = Math.max(0, Math.sin(t * 4)) * 0.1;
    head.current.rotation.z = cheering ? 0 : action === "idle" ? Math.sin(t * 0.8) * 0.12 : action === "nap" ? 0.28 : action === "phone" ? 0.18 : 0;
    if (action === "meditate" && !cheering) head.current.rotation.z = Math.sin(t * 0.45) * 0.05;
    head.current.rotation.x = cheering
      ? 0
      : action === "write"
        ? 0.22
        : action === "read"
          ? 0.3
          : action === "nap"
            ? 0.15 + Math.sin(t * 1.2) * 0.03
            : action === "talk"
              ? nod
              : 0;

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
    } else if (walking && action !== "carry") {
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
    } else if (action === "read") {
      // holding a book, turning a page now and then
      const flip = t % 6 < 0.5 ? Math.sin(((t % 6) / 0.5) * Math.PI) * 0.4 : 0;
      L.set(-1.2, 0, 0.35);
      R.set(-1.2 - flip, 0, -0.35 + flip * 0.5);
    } else if (action === "phone") {
      L.set(-0.4 + Math.sin(t * 2) * 0.2, 0, -0.35);
      R.set(-0.3, 0, 2.7);
    } else if (action === "yoga") {
      // flow slowly between arms out and arms up
      const k = (Math.sin(t * 0.8) + 1) / 2;
      L.set(0, 0, -(1.45 + k * 1.45));
      R.set(0, 0, 1.45 + k * 1.45);
    } else if (action === "run") {
      L.set(Math.sin(t * pace) * 0.9, 0, -0.2);
      R.set(-Math.sin(t * pace) * 0.9, 0, 0.2);
    } else if (action === "talk") {
      L.set(-0.55 + Math.sin(t * 3) * 0.35, 0, -0.35);
      R.set(-0.75 + Math.sin(t * 3.6 + 1) * 0.45, 0, 0.35);
    } else if (action === "nap") {
      L.set(-0.35, 0, -0.1);
      R.set(-0.35, 0, 0.1);
    } else if (action === "carry") {
      L.set(-1.35, 0, 0.3);
      R.set(-1.35, 0, -0.3);
    } else if (action === "lift") {
      // alternating bicep curls
      L.set(-0.4 - Math.max(0, Math.sin(t * 3)) * 1.6, 0, -0.2);
      R.set(-0.4 - Math.max(0, -Math.sin(t * 3)) * 1.6, 0, 0.2);
    } else if (action === "meditate") {
      // hands resting out to the sides, rising a little with each breath
      const breath = Math.sin(t * 0.9) * 0.06;
      L.set(-0.25, 0, -(0.75 + breath));
      R.set(-0.25, 0, 0.75 + breath);
    } else {
      L.set(-0.15 + Math.sin(t * 1.5) * 0.06, 0, -0.3);
      R.set(-0.15 - Math.sin(t * 1.5) * 0.06, 0, 0.3);
    }
    eyes.current.scale.y = (action === "nap" || action === "meditate") && !cheering ? 0.12 : t % 3.7 < 0.13 ? 0.12 : 1;
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
          {action === "sip" && (
            <mesh position={[0, -0.22, 0.06]}>
              <cylinderGeometry args={[0.055, 0.045, 0.11, 12]} />
              <Toon color="#ffffff" />
              <Ink t={0.008} />
            </mesh>
          )}
          {action === "phone" && (
            <mesh position={[0, -0.2, 0.07]}>
              <boxGeometry args={[0.07, 0.15, 0.025]} />
              <meshToonMaterial color="#1f2937" />
            </mesh>
          )}
        </group>
        {action === "carry" && (
          <group position={[0, 0.5, 0.4]}>
            <mesh>
              <boxGeometry args={[0.36, 0.26, 0.26]} />
              <meshToonMaterial color="#d6b483" />
              <Ink t={0.008} />
            </mesh>
            <mesh position={[0, 0.131, 0]}>
              <boxGeometry args={[0.37, 0.01, 0.06]} />
              <meshToonMaterial color="#9a7a4c" />
            </mesh>
          </group>
        )}
        {action === "read" && (
          <group position={[0, 0.5, 0.36]} rotation-x={-0.75}>
            <mesh position={[-0.08, 0, 0]} rotation-z={0.12}>
              <boxGeometry args={[0.16, 0.012, 0.22]} />
              <meshToonMaterial color="#fffaf0" />
            </mesh>
            <mesh position={[0.08, 0, 0]} rotation-z={-0.12}>
              <boxGeometry args={[0.16, 0.012, 0.22]} />
              <meshToonMaterial color="#fffaf0" />
            </mesh>
            <mesh position={[0, -0.012, 0]}>
              <boxGeometry args={[0.34, 0.012, 0.24]} />
              <meshToonMaterial color="#c0392b" />
            </mesh>
          </group>
        )}
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
          {species === "chick" || species === "owl" ? (
            <mesh position={[0, -0.07, 0.42]} rotation-x={species === "owl" ? Math.PI / 2 + 0.5 : Math.PI / 2}>
              <coneGeometry args={[0.045, 0.08, 10]} />
              <Toon color={species === "owl" ? "#f4a259" : "#ff9f43"} />
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
const SCREEN_LABEL: Record<ScreenMode, Key> = {
  idle: "screen.idle",
  planning: "screen.planning",
  queued: "screen.queued",
  working: "screen.working",
  done: "screen.done",
  error: "screen.error",
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

function screenTexture(screen: ScreenState, name: string, lang: Lang) {
  const tr = (k: Key) => translate(lang, k);
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
  g.fillText(`${name.toLowerCase()}@office: ${tr(SCREEN_LABEL[screen.mode])}`, 80, 23);

  g.textAlign = "center";
  const title = screen.title ? clip(screen.title, 34) : "";
  switch (screen.mode) {
    case "idle":
      g.fillStyle = "#34d399";
      g.font = `700 40px ${TERM_FONT}`;
      g.fillText(tr("screen.ready"), 256, 165);
      g.fillStyle = "#6ee7b7";
      g.font = `500 18px ${TERM_FONT}`;
      g.fillText(tr("screen.waiting"), 256, 200);
      break;
    case "planning":
      g.fillStyle = "#6ee7b7";
      g.font = `600 22px ${TERM_FONT}`;
      g.fillText(tr("screen.planningBig"), 256, 250);
      g.font = `500 16px ${TERM_FONT}`;
      g.fillStyle = "#a7f3d0";
      g.fillText(tr("screen.listening"), 256, 280);
      break;
    case "queued":
      g.fillStyle = "#6ee7b7";
      g.font = `600 20px ${TERM_FONT}`;
      g.fillText(tr("screen.upNext"), 256, 240);
      g.fillStyle = "#ecfdf5";
      g.fillText(title, 256, 270);
      break;
    case "done":
      g.fillStyle = "#34d399";
      g.font = `800 52px ${TERM_FONT}`;
      g.fillText(tr("screen.doneBig"), 256, 160);
      g.fillStyle = "#a7f3d0";
      g.font = `500 18px ${TERM_FONT}`;
      g.fillText(title, 256, 200);
      break;
    case "error":
      g.fillStyle = "#fca5a5";
      g.font = `800 46px ${TERM_FONT}`;
      g.fillText(tr("screen.errorBig"), 256, 160);
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
        g.fillText(`${tr("screen.thinking")}▌`, 16, 88);
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

function Workstation({ screen, name, seed, lang }: { screen: ScreenState; name: string; seed: number; lang: Lang }) {
  // Redraw the screen texture only every ~30 streamed characters.
  const key = `${screen.mode}|${screen.title ?? ""}|${Math.floor((screen.len ?? 0) / 30)}|${name}|${lang}`;
  const tex = useDisposable(() => screenTexture(screen, name, lang), key);
  const scan = useRef<Mesh>(null);
  const spinner = useRef<Group>(null);
  const flash = useRef<Mesh>(null);
  const led = useRef<Mesh>(null);
  const still = useStill();
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

function managerTexture(state: ManagerState, done: number, total: number, lang: Lang) {
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
  g.fillText(translate(lang, "mon.title"), 16, 24);
  g.textAlign = "center";
  const title = {
    idle: translate(lang, "mon.idle"),
    planning: translate(lang, "mon.planning"),
    watching: translate(lang, "mon.watching", { done, total }),
    merging: translate(lang, "mon.merging"),
  }[state];
  g.fillStyle = "#34d399";
  g.font = `800 34px ${TERM_FONT}`;
  g.fillText(title, 256, 120);
  g.font = `500 17px ${TERM_FONT}`;
  g.fillStyle = "#6ee7b7";
  const sub = {
    idle: translate(lang, "mon.idleSub"),
    planning: translate(lang, "mon.planningSub"),
    watching: translate(lang, "mon.watchingSub"),
    merging: translate(lang, "mon.mergingSub"),
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
function ManagerMonitor({ state, done, total, lang }: { state: ManagerState; done: number; total: number; lang: Lang }) {
  const tex = useDisposable(() => managerTexture(state, done, total, lang), `${state}|${done}|${total}|${lang}`);
  const bar = useRef<Mesh>(null);
  const still = useStill();
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
  const still = useStill();
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

// ---------- Desks in the open hall ----------

const LABEL_SCALE = 1.5;
/** Mochi's seat height on the office chair, in world metres. */
const SEAT_Y = 0.5 * DESK_SCALE;

/** How every desk looks, from the office settings. */
type DeskLook = { top: string; legs: string; screen: string; lamp: boolean; items: boolean; glow: boolean };

function DeskFrame({ look }: { look: DeskLook }) {
  return (
    <>
      {/* desk with a fabric privacy screen at the back */}
      <RoundedBox args={[1.5, 0.05, 0.75]} radius={0.015} position={[0, 0.74, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={look.top} roughness={0.45} />
      </RoundedBox>
      {[-0.7, 0.7].map((x) => (
        <mesh key={x} position={[x, 0.36, 0]} castShadow>
          <boxGeometry args={[0.05, 0.72, 0.68]} />
          <meshStandardMaterial color={look.legs} />
        </mesh>
      ))}
      <mesh position={[0, 1.0, -0.39]} castShadow>
        <boxGeometry args={[1.5, 0.5, 0.04]} />
        <meshStandardMaterial color={look.screen} roughness={0.95} />
      </mesh>
    </>
  );
}

/** Little architect lamp in the back corner of the desk; lit after dark. */
function DeskLamp({ glow }: { glow: boolean }) {
  return (
    <group position={[0.62, 0.765, -0.24]}>
      <mesh position={[0, 0.01, 0]}>
        <cylinderGeometry args={[0.06, 0.07, 0.02, 16]} />
        <meshStandardMaterial color="#2b2f33" />
      </mesh>
      <mesh position={[-0.03, 0.15, 0]} rotation-z={0.35}>
        <cylinderGeometry args={[0.012, 0.012, 0.3, 6]} />
        <meshStandardMaterial color="#2b2f33" />
      </mesh>
      <mesh position={[-0.1, 0.28, 0.02]} rotation-z={-0.9}>
        <coneGeometry args={[0.06, 0.1, 16, 1, true]} />
        <meshStandardMaterial color="#f2c14e" emissive="#ffcf8a" emissiveIntensity={glow ? 0.8 : 0} />
      </mesh>
      {glow && (
        <mesh position={[-0.14, 0.25, 0.02]}>
          <sphereGeometry args={[0.03, 10, 8]} />
          <meshBasicMaterial color="#ffe2a8" toneMapped={false} />
        </mesh>
      )}
    </group>
  );
}

/** A couple of personal things on each desk, different per person. */
function DeskItems({ seed }: { seed: number }) {
  const kind = Math.floor(hash(seed + 3) * 4);
  return (
    <group position={[-0.32, 0.765, -0.2]}>
      {kind === 0 && (
        // photo frame
        <group rotation-y={0.3}>
          <mesh position={[0, 0.08, 0]} rotation-x={-0.2}>
            <boxGeometry args={[0.14, 0.16, 0.015]} />
            <meshStandardMaterial color="#5a3a2a" />
          </mesh>
          <mesh position={[0, 0.08, 0.009]} rotation-x={-0.2}>
            <planeGeometry args={[0.11, 0.13]} />
            <meshBasicMaterial color={hash(seed) > 0.5 ? "#9fd8f5" : "#ffd6a5"} />
          </mesh>
        </group>
      )}
      {kind === 1 && (
        // succulent
        <group>
          <mesh position={[0, 0.04, 0]}>
            <cylinderGeometry args={[0.05, 0.04, 0.08, 12]} />
            <meshStandardMaterial color="#e07a5f" />
          </mesh>
          <mesh position={[0, 0.11, 0]}>
            <icosahedronGeometry args={[0.055, 0]} />
            <meshStandardMaterial color="#52b788" flatShading />
          </mesh>
        </group>
      )}
      {kind === 2 && (
        // stack of books
        <group>
          <mesh position={[0, 0.02, 0]}>
            <boxGeometry args={[0.18, 0.04, 0.13]} />
            <meshStandardMaterial color="#2e86de" />
          </mesh>
          <mesh position={[0.01, 0.06, 0]} rotation-y={0.2}>
            <boxGeometry args={[0.16, 0.035, 0.12]} />
            <meshStandardMaterial color="#f39c12" />
          </mesh>
        </group>
      )}
      {kind === 3 && (
        // tiny figurine
        <group>
          <mesh position={[0, 0.05, 0]}>
            <sphereGeometry args={[0.05, 12, 10]} />
            <meshToonMaterial color="#ffb3d1" />
          </mesh>
          <mesh position={[0, 0.12, 0]}>
            <sphereGeometry args={[0.04, 12, 10]} />
            <meshToonMaterial color="#ffd9e4" />
          </mesh>
        </group>
      )}
    </group>
  );
}

type DeskProps = {
  agent: Agent;
  look: Look;
  state: DeskState;
  seed: number;
  position: V3;
  lang: Lang;
  desk: DeskLook;
};

function AgentDeskImpl({ agent, look, state, seed, position, lang, desk }: DeskProps) {
  return (
    <group position={position} scale={DESK_SCALE}>
      <DeskFrame look={desk} />
      {/* mug in the owner's colour */}
      <mesh position={[-0.55, 0.815, 0.05]} castShadow>
        <cylinderGeometry args={[0.05, 0.045, 0.1, 12]} />
        <meshStandardMaterial color={look.inner} />
      </mesh>
      {desk.items && <DeskItems seed={seed} />}
      {desk.lamp && <DeskLamp glow={desk.glow} />}
      <Workstation screen={state.screen} name={agent.name} seed={seed} lang={lang} />
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
    a.lang === b.lang &&
    a.desk === b.desk &&
    a.state.screen.mode === b.state.screen.mode &&
    a.state.screen.title === b.state.screen.title &&
    Math.floor((a.state.screen.len ?? 0) / 30) === Math.floor((b.state.screen.len ?? 0) / 30),
);

/** A monitor that is switched off. */
function DarkMonitor() {
  return (
    <group position={[0, 0.765, -0.2]} scale={1.25}>
      <mesh position={[0, 0.008, 0]}>
        <cylinderGeometry args={[0.09, 0.1, 0.016, 24]} />
        <meshStandardMaterial color="#1f2937" metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.1, -0.02]}>
        <boxGeometry args={[0.035, 0.18, 0.03]} />
        <meshStandardMaterial color="#1f2937" metalness={0.5} roughness={0.4} />
      </mesh>
      <RoundedBox args={[0.6, 0.39, 0.035]} radius={0.015} position={[0, 0.36, 0]} castShadow>
        <meshStandardMaterial color="#0b0f0d" roughness={0.25} metalness={0.2} />
      </RoundedBox>
    </group>
  );
}

/** A free desk waiting for a new hire: monitor off, chair tucked in. */
const EmptyDesk = memo(
  function EmptyDesk({ position, desk }: { position: V3; desk: DeskLook }) {
    return (
      <group position={position} scale={DESK_SCALE}>
        <DeskFrame look={desk} />
        <DarkMonitor />
        <OfficeChair p={[0, 0, 0.45]} />
      </group>
    );
  },
  (a, b) => a.position.join() === b.position.join() && a.desk === b.desk,
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
  level: number;
  lang: Lang;
  selected: boolean;
  onSelect?: (id: string) => void;
};

const ACTIVITY_ACTION: Record<Activity, Action> = {
  look: "idle",
  sip: "sip",
  play: "play",
  rest: "idle",
  read: "read",
  call: "phone",
  yoga: "yoga",
  run: "run",
  chat: "talk",
  talk: "talk",
  nap: "nap",
  type: "write",
  draw: "chalk",
  lift: "lift",
  meditate: "meditate",
};

// ---------- Floating emoji emotes ----------

const emojiTextures = new Map<string, CanvasTexture>();

function emojiTexture(emoji: string) {
  let tex = emojiTextures.get(emoji);
  if (!tex) {
    const c = document.createElement("canvas");
    c.width = 128;
    c.height = 128;
    const g = c.getContext("2d")!;
    g.font = '92px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(emoji, 64, 70);
    tex = new CanvasTexture(c);
    tex.colorSpace = SRGBColorSpace;
    emojiTextures.set(emoji, tex);
  }
  return tex;
}

/** Every few seconds an emoji from `pool` pops up beside the head, floats and fades. */
function Emote({ pool, seed, y = 1.25 }: { pool: string[]; seed: number; y?: number }) {
  const sprite = useRef<Sprite>(null);
  const material = useRef<SpriteMaterial>(null);
  const live = useRef(pool);
  useEffect(() => {
    live.current = pool;
  });
  const timing = useRef({ next: 2 + (seed % 5), shownAt: -99 });
  const still = useStill();
  useFrame(({ clock }) => {
    const spr = sprite.current;
    const mat = material.current;
    if (!spr || !mat || still) return;
    const t = clock.elapsedTime;
    const s = timing.current;
    if (t > s.next && live.current.length) {
      mat.map = emojiTexture(live.current[Math.floor(Math.random() * live.current.length)]);
      mat.needsUpdate = true;
      s.shownAt = t;
      s.next = t + 5 + Math.random() * 7;
    }
    const k = (t - s.shownAt) / 2.2;
    spr.visible = k < 1;
    if (k < 1) {
      spr.position.y = y + k * 0.45;
      mat.opacity = k < 0.15 ? k / 0.15 : 1 - Math.max(0, (k - 0.6) / 0.4);
      const size = 0.42 * (k < 0.15 ? 0.6 + (k / 0.15) * 0.4 : 1);
      spr.scale.set(size, size, 1);
    }
  });
  return (
    <sprite ref={sprite} position={[0.5, y, 0]} visible={false}>
      <spriteMaterial ref={material} transparent depthWrite={false} />
    </sprite>
  );
}

function describe(lang: Lang, phase: WalkPhase, working: boolean, attentive: boolean, task?: string) {
  if (phase.kind === "seated") {
    if (working) return task ? translate(lang, "act.typingOn", { title: task }) : translate(lang, "act.typing");
    if (attentive) return translate(lang, "act.watching");
    return translate(lang, "act.free");
  }
  if (phase.kind === "walking") return translate(lang, phase.rushing ? "act.rushing" : "act.strolling");
  return `${phrase(lang, phase.spot.say)} ${phrase(lang, phase.spot.where)}`;
}

function emotePool(phase: WalkPhase, working: boolean, attentive: boolean) {
  if (phase.kind === "spot") return phase.spot.emoji;
  if (phase.kind === "walking") return phase.rushing ? ["❗", "🏃"] : ["🎵", "🙂"];
  if (working) return ["💡", "⌨️", "🤓", "🧠"];
  if (attentive) return ["👂", "📝", "🤔"];
  return ["🙂", "🎵", "😊"];
}

function AgentAvatarImpl(props: AvatarProps) {
  const { agent, look, home, working, attentive, bubble, lastDoneAt, seed, lift, selected, onSelect } = props;
  const group = useRef<Group>(null);
  const ring = useRef<Mesh>(null);
  const live = useRef(props);
  useEffect(() => {
    live.current = props;
  });
  const [walker] = useState(() => new Wanderer(agent.id, home, SEAT_Y, 2 + ((seed * 7) % 5)));
  const [phase, setPhase] = useState<WalkPhase>(walker.phase);
  // whether the person across the table has arrived, for chats
  const [partnerHere, setPartnerHere] = useState(false);
  useEffect(() => {
    registerWalker(walker);
    return () => walker.dispose();
  }, [walker]);

  useFrame((_, delta) => {
    const g = group.current;
    if (!g) return;
    const p = live.current;
    if (walker.update(delta, p.home, p.busy, p.canWander)) setPhase(walker.phase);
    g.position.set(walker.x + walker.offX, walker.y, walker.z + walker.offZ);
    g.rotation.y = walker.yaw;
    if (ring.current) ring.current.position.y = -walker.y / DESK_SCALE + 0.02;
    const pair = walker.phase.kind === "spot" ? walker.phase.spot.pair : undefined;
    const here = pair ? isPresent(pair) : false;
    if (here !== partnerHere) setPartnerHere(here);
  });

  // the parcel changes together with the phase, which re-renders this component
  const holding = walker.holding;
  const seated = phase.kind === "seated";
  const facing = seated && (working || attentive) ? "back" : "front";
  const chatAlone = phase.kind === "spot" && phase.spot.activity === "chat" && !partnerHere;
  const action: Action = seated
    ? working
      ? "write"
      : "idle"
    : phase.kind === "walking"
      ? holding
        ? "carry"
        : "walk"
      : chatAlone
        ? "sip"
        : ACTIVITY_ACTION[phase.spot.activity];
  const say = seated
    ? working
      ? bubble
      : undefined
    : phase.kind === "walking"
      ? phase.rushing
        ? translate(props.lang, "bubble.onMyWay")
        : holding
          ? translate(props.lang, "bubble.parcel")
          : undefined
      : chatAlone
        ? translate(props.lang, "bubble.saving")
        : phrase(props.lang, phase.spot.say);

  const status = describe(props.lang, phase, working, attentive, bubble);
  useEffect(() => {
    setAgentActivity(agent.id, status);
  }, [agent.id, status]);

  return (
    <group
      ref={group}
      position={[home.seat[0], SEAT_Y, home.seat[1]]}
      scale={DESK_SCALE}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.(agent.id);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        document.body.style.cursor = "";
      }}
    >
      {selected && (
        <mesh ref={ring} rotation-x={-Math.PI / 2} position={[0, 0.02, 0]}>
          <ringGeometry args={[0.42, 0.52, 40]} />
          <meshBasicMaterial color="#34d399" toneMapped={false} />
        </mesh>
      )}
      <Emote pool={emotePool(phase, working, attentive)} seed={seed} />
      <Mochi
        look={look}
        accessory={ACCESSORY[agent.id] ?? null}
        facing={facing}
        action={action}
        lastDoneAt={lastDoneAt}
        seed={seed}
      />
      <Label name={`${agent.name} · Lv${props.level}`} bubble={say} position={[0, 1.55, 0]} scale={LABEL_SCALE} lift={lift} />
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
    a.home.row === b.home.row &&
    a.busy === b.busy &&
    a.working === b.working &&
    a.attentive === b.attentive &&
    a.bubble === b.bubble &&
    a.lastDoneAt === b.lastDoneAt &&
    a.seed === b.seed &&
    a.lift === b.lift &&
    a.canWander === b.canWander &&
    a.level === b.level &&
    a.lang === b.lang &&
    a.selected === b.selected &&
    a.onSelect === b.onSelect,
);

/** The ping-pong ball rallies whenever someone is standing at the table. */
function PingPongBall() {
  const ball = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    const b = ball.current;
    if (!b) return;
    const playing = isPresent("pong-a") || isPresent("pong-b");
    if (!playing) {
      b.position.set(14.1, 0.8, 7.2);
      return;
    }
    const t = clock.elapsedTime * 0.9;
    const leg = t % 1; // one crossing of the table
    const forward = Math.floor(t) % 2 === 0;
    const k = forward ? leg : 1 - leg;
    b.position.set(14.4 + Math.sin(t * 2.3) * 0.35, 0.8 + Math.abs(Math.sin(leg * Math.PI * 2)) * 0.3, 6.7 + k * 2.3);
  });
  return (
    <mesh ref={ball} position={[14.1, 0.8, 7.2]} castShadow>
      <sphereGeometry args={[0.04, 10, 10]} />
      <meshStandardMaterial color="#f97316" />
    </mesh>
  );
}

const IDLE_DESK: DeskState = { working: [], screen: { mode: "idle" } };
const MANAGER_LOOK: Look = { species: "chick", color: "#fff1a6", inner: "#ffb347" };

/** Max presents at the projector in the meeting room. */
function Presenter({ state, board, lang }: { state: ManagerState; board: BoardLine[]; lang: Lang }) {
  const label = translate(lang, `max.${state}` as Key);
  const done = board.filter((l) => l.status === "done").length;
  return (
    <group>
      <group position={[MANAGER_TV.x, -0.03, MANAGER_TV.z]} rotation-y={Math.PI / 2}>
        <ManagerMonitor state={state} done={done} total={board.length} lang={lang} />
      </group>
      <Pacer pacing={state === "watching"}>
        <Mochi
          look={MANAGER_LOOK}
          accessory="tie"
          facing={state === "planning" ? "back" : "front"}
          action={state === "planning" ? "chalk" : state === "merging" ? "wave" : state === "watching" ? "walk" : "idle"}
          seed={42}
          scale={1.7}
        />
        <ThinkingOrbs active={state === "planning" || state === "merging"} />
        <Emote
          pool={state === "planning" ? ["📋", "🤔", "💡"] : state === "merging" ? ["🧩", "✍️"] : state === "watching" ? ["👀", "👍"] : ["☕", "🙂"]}
          seed={9}
          y={1.9}
        />
        <Label name={translate(lang, "max.label")} bubble={label} position={[0, 2.75, 0]} scale={LABEL_SCALE * 1.3} />
      </Pacer>
    </group>
  );
}

/** Walks Max back and forth in front of the projector while `pacing`, otherwise stands at his spot. */
function Pacer({ pacing, children }: { pacing: boolean; children: React.ReactNode }) {
  const ref = useRef<Group>(null);
  const still = useStill();
  useFrame(({ clock }, delta) => {
    const g = ref.current;
    if (!g) return;
    const t = clock.elapsedTime * 0.45;
    const targetX = pacing && !still ? PRESENTER.x - 0.9 + Math.sin(t) * 0.9 : PRESENTER.x;
    const dx = targetX - g.position.x;
    g.position.x += dx * Math.min(1, delta * 4);
    const yaw = pacing && !still ? (Math.cos(t) > 0 ? Math.PI / 2 : -Math.PI / 2) : 0;
    const diff = Math.atan2(Math.sin(yaw - g.rotation.y), Math.cos(yaw - g.rotation.y));
    g.rotation.y += diff * Math.min(1, delta * 6);
  });
  return (
    <group ref={ref} position={[PRESENTER.x, 0, PRESENTER.z]}>
      {children}
    </group>
  );
}

/** Where the camera looks: the middle of the floor. */
const TARGET: V3 = [9, 0.6, 9];

type LightSet = { ambient: [string, number]; hemi: [string, string, number]; sun: [string, number, V3]; lamps: number };

/** Daylight, golden hour or night, with warm room lights after dark. */
const LIGHTS: Record<Phase, LightSet> = {
  day: { ambient: ["#ffffff", 0.85], hemi: ["#ffffff", "#c9c2b8", 1.0], sun: ["#ffffff", 1.6, [7, 15, 12]], lamps: 0 },
  sunset: { ambient: ["#ffe2c6", 0.6], hemi: ["#ffd2a6", "#8f7468", 0.72], sun: ["#ffad6b", 1.35, [15, 7, 5]], lamps: 6 },
  night: { ambient: ["#aab6ff", 0.42], hemi: ["#6575b5", "#2a2633", 0.5], sun: ["#b7c4ff", 0.4, [-6, 14, 8]], lamps: 14 },
};

const ROOM_LIGHTS: V3[] = [
  [21, 2.6, -2.5],
  [21, 2.6, 5],
  [21, 2.4, 12.5],
  [1.5, 2.6, 5.5],
  [8.5, 2.6, 5.5],
  [1.5, 2.6, 10.5],
  [8.5, 2.6, 10.5],
  [4.5, 2.4, 14.6],
  [-5.6, 2.4, 3.2],
  [0.2, 2.4, -2.6],
  [5.5, 2.4, -3.2],
  [-3.5, 2.4, 20.6],
  [4.7, 2.4, 20.6],
  [12.8, 2.4, 20.6],
  [21.5, 2.4, 20.6],
];

/** Power cut: almost dark, red emergency lights. */
const OUTAGE: LightSet = { ambient: ["#8090c0", 0.16], hemi: ["#33405f", "#151320", 0.18], sun: ["#9fb0ff", 0.12, [-6, 14, 8]], lamps: 0 };

function Lights({ phase }: { phase: Phase }) {
  const game = useGame();
  const outage = game.event?.kind === "outage";
  const set = outage ? OUTAGE : LIGHTS[phase];
  // the sun aims at the middle of the floor; the target has to be in the scene for that
  const [target] = useState(() => new Object3D());
  const sun: V3 = [TARGET[0] + set.sun[2][0], set.sun[2][1], TARGET[2] + set.sun[2][2]];
  return (
    <>
      <ambientLight color={set.ambient[0]} intensity={set.ambient[1]} />
      <hemisphereLight args={[set.hemi[0], set.hemi[1], set.hemi[2]]} />
      <primitive object={target} position={[TARGET[0], 0, TARGET[2]]} />
      <directionalLight
        position={sun}
        target={target}
        color={set.sun[0]}
        intensity={set.sun[1]}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-24}
        shadow-camera-right={24}
        shadow-camera-top={24}
        shadow-camera-bottom={-24}
        shadow-camera-far={80}
        shadow-bias={-0.0005}
      />
      {set.lamps > 0 &&
        ROOM_LIGHTS.map((p) => <pointLight key={p.join()} position={p} color="#ffd59a" intensity={set.lamps} distance={9} decay={1.6} />)}
      {outage &&
        [
          [-5, 2.2, 0.3],
          [5, 2.2, 0.3],
          [4.5, 2.4, 9],
        ].map((p) => <pointLight key={p.join()} position={p as V3} color="#ff3b3b" intensity={5} distance={8} decay={1.6} />)}
    </>
  );
}

/** Runs the office-event clock with the scene and shows each event's props. */
function EventDirector() {
  const game = useGame();
  useFrame(({ clock }) => tickEvents(clock.elapsedTime));
  return <EventProps kind={game.event?.kind ?? currentEventKind()} />;
}

/** Robo, the robot receptionist behind the lobby desk; looks around and waves now and then. */
function Receptionist({ lang }: { lang: Lang }) {
  const arm = useRef<Group>(null);
  const head = useRef<Group>(null);
  const eyes = useRef<Group>(null);
  const still = useStill();
  useFrame(({ clock }) => {
    if (still) return;
    const t = clock.elapsedTime;
    const waving = t % 8 < 1.6;
    if (arm.current) arm.current.rotation.z = waving ? 2.5 + Math.sin(t * 10) * 0.35 : 0.15;
    if (head.current) head.current.rotation.y = Math.sin(t * 0.6) * 0.35;
    if (eyes.current) eyes.current.scale.y = t % 4 < 0.12 ? 0.15 : 1;
  });
  return (
    <group position={[20.5, 0, -3.5]}>
      <mesh position={[0, 0.12, 0]}>
        <cylinderGeometry args={[0.24, 0.3, 0.24, 24]} />
        <meshStandardMaterial color="#9ca3af" metalness={0.5} roughness={0.4} />
      </mesh>
      <RoundedBox args={[0.52, 0.6, 0.4]} radius={0.1} position={[0, 0.6, 0]} castShadow>
        <meshStandardMaterial color="#e5e7eb" roughness={0.35} />
      </RoundedBox>
      <mesh position={[0, 0.66, 0.205]}>
        <circleGeometry args={[0.07, 20]} />
        <meshBasicMaterial color="#34d399" toneMapped={false} />
      </mesh>
      <mesh position={[-0.32, 0.62, 0]} rotation-z={-0.15}>
        <capsuleGeometry args={[0.055, 0.28, 6, 12]} />
        <meshStandardMaterial color="#cbd5e1" />
      </mesh>
      <group ref={arm} position={[0.31, 0.8, 0]}>
        <mesh position={[0, -0.18, 0]}>
          <capsuleGeometry args={[0.055, 0.28, 6, 12]} />
          <meshStandardMaterial color="#cbd5e1" />
        </mesh>
      </group>
      <group ref={head} position={[0, 1.13, 0]}>
        <RoundedBox args={[0.56, 0.4, 0.38]} radius={0.1} castShadow>
          <meshStandardMaterial color="#f8fafc" roughness={0.3} />
        </RoundedBox>
        <mesh position={[0, 0, 0.191]}>
          <planeGeometry args={[0.44, 0.27]} />
          <meshBasicMaterial color="#111827" />
        </mesh>
        <group ref={eyes}>
          {[-0.1, 0.1].map((x) => (
            <mesh key={x} position={[x, 0.02, 0.195]}>
              <circleGeometry args={[0.045, 16]} />
              <meshBasicMaterial color="#5eead4" toneMapped={false} />
            </mesh>
          ))}
        </group>
        <mesh position={[0, 0.3, 0]}>
          <cylinderGeometry args={[0.012, 0.012, 0.2, 6]} />
          <meshStandardMaterial color="#6b7280" />
        </mesh>
        <mesh position={[0, 0.42, 0]}>
          <sphereGeometry args={[0.045, 12, 10]} />
          <meshBasicMaterial color="#f472b6" toneMapped={false} />
        </mesh>
      </group>
      <Label name={translate(lang, "robo.label")} position={[0, 1.95, 0]} scale={LABEL_SCALE} />
    </group>
  );
}

function townHallTexture(lang: Lang, allHands: boolean) {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 400;
  const g = c.getContext("2d")!;
  const font = 'system-ui, "Segoe UI", "Leelawadee UI", "Noto Sans Thai", sans-serif';
  const bg = g.createLinearGradient(0, 0, 1024, 400);
  bg.addColorStop(0, allHands ? "#4c1d95" : "#064e3b");
  bg.addColorStop(1, allHands ? "#be185d" : "#0f766e");
  g.fillStyle = bg;
  g.fillRect(0, 0, 1024, 400);
  g.fillStyle = "rgba(255,255,255,0.16)";
  g.fillRect(0, 0, 1024, 70);
  g.fillStyle = "#ffffff";
  g.font = `800 40px ${font}`;
  g.fillText(translate(lang, allHands ? "th.allhands" : "th.talk"), 40, 48);
  g.font = `700 56px ${font}`;
  g.fillText(translate(lang, allHands ? "th.allhandsTitle" : "th.talkTitle"), 40, 160);
  // a little bar chart and bullet lines
  [0.45, 0.7, 0.55, 0.9].forEach((h, i) => {
    g.fillStyle = ["#fde68a", "#a7f3d0", "#bae6fd", "#fbcfe8"][i];
    g.fillRect(700 + i * 70, 360 - h * 150, 48, h * 150);
  });
  g.fillStyle = "rgba(255,255,255,0.85)";
  [230, 280, 330].forEach((y, i) => g.fillRect(40, y, 520 - i * 90, 16));
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** The big screen above the town hall stage: a tech talk, or the all-hands slides during that event. */
function TownHallScreen({ lang }: { lang: Lang }) {
  const game = useGame();
  const allHands = game.event?.kind === "allhands";
  const tex = useDisposable(() => townHallTexture(lang, allHands), `th-${allHands}-${lang}`);
  return (
    <mesh position={[21, 1.75, 1.43]}>
      <planeGeometry args={[4.1, 1.6]} />
      <meshBasicMaterial map={tex} toneMapped={false} />
    </mesh>
  );
}

/** The zoom that shows the whole floor, for flying back out from a zone. */
let fitZoom = 20;

/** Fly the camera to the zone picked on the overlay; grabbing the view cancels the flight. */
function CameraFly() {
  const get = useThree((s) => s.get);
  const hasControls = useThree((s) => Boolean(s.controls));
  const focus = useCameraFocus();
  const still = useStill();
  const goal = useRef<{ target: Vector3; zoom: number } | null>(null);
  useEffect(() => {
    if (!focus.n || focus.id === null) return;
    const look = focus.id === "all" ? null : ZONE_LOOK[focus.id];
    goal.current = {
      target: look ? new Vector3(look[0], TARGET[1], look[1]) : new Vector3(...TARGET),
      zoom: look ? fitZoom * 2.3 : fitZoom,
    };
  }, [focus.n, focus.id]);
  useEffect(() => {
    const controls = get().controls as unknown as { addEventListener(e: string, f: () => void): void; removeEventListener(e: string, f: () => void): void } | null;
    if (!controls) return;
    const stop = () => {
      goal.current = null;
      releaseFocus();
    };
    controls.addEventListener("start", stop);
    return () => controls.removeEventListener("start", stop);
  }, [get, hasControls]);
  useFrame((_, delta) => {
    const g = goal.current;
    if (!g) return;
    const { camera, controls } = get();
    const orbit = controls as unknown as { target: Vector3; update(): void } | null;
    if (!orbit) return;
    const k = still ? 1 : 1 - Math.exp(-delta * 4);
    const offset = camera.position.clone().sub(orbit.target);
    orbit.target.lerp(g.target, k);
    camera.position.copy(orbit.target).add(offset);
    camera.zoom += (g.zoom - camera.zoom) * k;
    camera.updateProjectionMatrix();
    orbit.update();
    if (orbit.target.distanceTo(g.target) < 0.01 && Math.abs(camera.zoom - g.zoom) < g.zoom * 0.002) goal.current = null;
  });
  return null;
}

/** Fit the orthographic camera to the whole floor whenever the canvas is resized. */
function CameraFit() {
  const get = useThree((s) => s.get);
  const width = useThree((s) => s.size.width);
  const height = useThree((s) => s.size.height);
  // Re-run once OrbitControls registers itself as the default controls.
  const hasControls = useThree((s) => Boolean(s.controls));
  useEffect(() => {
    const { camera, controls } = get();
    // project the floor's corners onto the screen axes of the current view
    const forward = new Vector3(...TARGET).sub(camera.position).normalize();
    const right = new Vector3().crossVectors(forward, new Vector3(0, 1, 0)).normalize();
    const up = new Vector3().crossVectors(right, forward);
    let [minX, maxX, minY, maxY] = [Infinity, -Infinity, Infinity, -Infinity];
    const p = new Vector3();
    for (const x of [FLOOR.x0, FLOOR.x1])
      for (const z of [FLOOR.z0, FLOOR.z1])
        for (const y of [0, 2.4]) {
          p.set(x, y, z);
          minX = Math.min(minX, p.dot(right));
          maxX = Math.max(maxX, p.dot(right));
          minY = Math.min(minY, p.dot(up));
          maxY = Math.max(maxY, p.dot(up));
        }
    // narrow screens crop the side corners a little so the desks stay readable
    const crop = width < 500 ? 0.66 : 1;
    const zoom = Math.min(width / ((maxX - minX) * crop * 1.02), height / ((maxY - minY) * 1.04));
    fitZoom = zoom;
    camera.zoom = zoom;
    camera.updateProjectionMatrix();
    const orbit = controls as unknown as { minZoom: number; maxZoom: number } | null;
    if (orbit) {
      orbit.minZoom = zoom * 0.7;
      orbit.maxZoom = zoom * 5;
    }
  }, [get, width, height, hasControls]);
  return null;
}

export default function OfficeScene({
  agents,
  desks,
  manager,
  board,
  selectedId,
  onSelectAgent,
  levels = {},
  lang = "en",
}: {
  agents: Agent[];
  desks: Record<string, DeskState>;
  manager: ManagerState;
  board: BoardLine[];
  selectedId?: string | null;
  onSelectAgent?: (id: string) => void;
  levels?: Record<string, number>;
  lang?: Lang;
}) {
  const custom = useOfficeCustom();
  // office clock: real time, time-lapse or a fixed time of day
  const minutes = useOfficeMinutes(custom.lighting, true) ?? 600;
  const minute = Math.floor(minutes);
  const phase = phaseAt(minutes);
  useEffect(() => {
    setOfficeHour(minute / 60);
    setEventHour(minute / 60);
  }, [minute]);
  const decor = useMemo<FloorDecor>(
    () => ({ floor: custom.floor, accent: ACCENT_COLORS[custom.accent], items: custom.items, sign: custom.sign, phase }),
    [custom.floor, custom.accent, custom.items, custom.sign, phase],
  );
  const deskLook = useMemo<DeskLook>(
    () => ({
      ...DESK_COLORS[custom.desk],
      screen: ACCENT_COLORS[custom.accent],
      lamp: custom.items.lamps,
      items: custom.items.deskItems,
      glow: phase !== "day",
    }),
    [custom.desk, custom.accent, custom.items, phase],
  );
  useEffect(() => {
    setBreakRules({
      cats: SPOT_CATS.filter((c) => custom.activities[c]),
      decor: DECOR_ITEMS.filter((i) => custom.items[i]),
      breaks: custom.breaks,
    });
  }, [custom.activities, custom.items, custom.breaks]);
  useEffect(() => setAutoEvents(custom.events), [custom.events]);

  const still = useStill();
  const seated = agents.slice(0, MAX_DESKS);
  const looks = [...LOOKS, ...MORE_LOOKS];

  return (
    <Canvas
      shadows
      orthographic
      dpr={[1, 1.5]}
      gl={{ powerPreference: "high-performance", alpha: true }}
      camera={{ position: [TARGET[0] + 13, 17, TARGET[2] + 15.9], zoom: 20, near: -100, far: 200 }}
      fallback={<div className="grid h-full place-items-center text-sm text-muted">3D view needs WebGL.</div>}
    >
      <Lights phase={phase} />
      <OfficeFloor decor={decor} />
      <ZoneSigns lang={lang} accent={decor.accent} />
      <EventDirector />
      <Projector lines={board} merging={manager === "merging"} lang={lang} />
      <group position={[-2.6 + 0.1, 1.5, -4.3]} rotation-y={Math.PI / 2}>
        <Clock position={[0, 0, 0]} />
      </group>
      <Presenter state={manager} board={board} lang={lang} />
      <PingPongBall />
      <Receptionist lang={lang} />
      <TownHallScreen lang={lang} />
      {Array.from({ length: MAX_DESKS - seated.length }, (_, k) => {
        const d = deskSlot(seated.length + k);
        return <EmptyDesk key={`free-${d.index}`} position={[d.x, 0, d.z]} desk={deskLook} />;
      })}
      {seated.map((a, i) => {
        const d = deskSlot(i);
        const state = desks[a.id] ?? IDLE_DESK;
        const attentive = manager === "planning";
        const look = looks[i % looks.length];
        return (
          <group key={a.id}>
            <AgentDesk agent={a} look={look} state={state} seed={i * 1.7} position={[d.x, 0, d.z]} lang={lang} desk={deskLook} />
            <AgentAvatar
              agent={a}
              look={look}
              home={{ seat: d.seat, aisleZ: d.aisleZ, row: d.row }}
              busy={attentive || state.screen.mode === "working" || state.screen.mode === "queued"}
              working={state.working.length > 0}
              attentive={attentive}
              bubble={state.working[0]}
              lastDoneAt={state.lastDoneAt}
              seed={i * 1.7}
              lift={d.col % 2 ? 0.45 : 0}
              level={levels[a.id] ?? 1}
              lang={lang}
              canWander={!still}
              selected={selectedId === a.id}
              onSelect={onSelectAgent}
            />
          </group>
        );
      })}
      <OrbitControls
        makeDefault
        target={TARGET}
        enablePan
        screenSpacePanning
        minPolarAngle={0.35}
        maxPolarAngle={1.2}
        minAzimuthAngle={-0.2}
        maxAzimuthAngle={1.6}
      />
      <CameraFit />
      <CameraFly />
    </Canvas>
  );
}
