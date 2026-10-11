"use client";

import { Billboard, ContactShadows, Float, OrbitControls, RoundedBox, Sparkles, Text } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useRef, useState } from "react";
import type { Group, Mesh, MeshStandardMaterial } from "three";
import type { Agent } from "@/lib/agents";

export type DeskState = { working: string[]; lastDoneAt?: number };
export type ManagerState = "idle" | "planning" | "merging";

const BODY_COLORS = ["#027f93", "#f78b04", "#a30502", "#4fc3d1", "#ff9a90", "#7bd389", "#b18cff"];

const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const FONT = "/fonts/Geist-Regular.ttf";

function clip(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** Name tag plus an optional speech bubble, always facing the camera. Drawn in WebGL (no DOM). */
function Label({ name, bubble, position }: { name: string; bubble?: string; position: [number, number, number] }) {
  const tag = clip(name, 26);
  const say = bubble ? clip(bubble, 28) : null;
  return (
    <Billboard position={position}>
      {say && (
        <group position={[0, 0.46, 0]}>
          <RoundedBox args={[say.length * 0.12 + 0.4, 0.42, 0.02]} radius={0.14}>
            <meshBasicMaterial color="#ffffff" />
          </RoundedBox>
          <mesh position={[0, -0.22, 0]} rotation-z={Math.PI / 4}>
            <planeGeometry args={[0.14, 0.14]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
          <Text font={FONT} fontSize={0.21} color="#1d1011" position={[0, 0, 0.02]} anchorX="center" anchorY="middle">
            {say}
          </Text>
        </group>
      )}
      <RoundedBox args={[tag.length * 0.105 + 0.36, 0.34, 0.02]} radius={0.12}>
        <meshBasicMaterial color="#1d1011" transparent opacity={0.8} />
      </RoundedBox>
      <Text font={FONT} fontSize={0.18} color="#ffffff" position={[0, 0, 0.02]} anchorX="center" anchorY="middle">
        {tag}
      </Text>
    </Billboard>
  );
}

/** A cute round robot. Bobs and blinks when idle, types fast when working, hops when done. */
function Bot({
  color,
  working,
  lastDoneAt,
  seed,
  scale = 1,
  pointing = false,
}: {
  color: string;
  working: boolean;
  lastDoneAt?: number;
  seed: number;
  scale?: number;
  pointing?: boolean;
}) {
  const root = useRef<Group>(null);
  const head = useRef<Group>(null);
  const leftArm = useRef<Group>(null);
  const rightArm = useRef<Group>(null);
  const eyes = useRef<Group>(null);
  const antenna = useRef<MeshStandardMaterial>(null);
  const [still] = useState(reducedMotion);

  useFrame(({ clock }) => {
    if (still || !root.current || !head.current || !leftArm.current || !rightArm.current || !eyes.current) return;
    const t = clock.elapsedTime + seed;
    const sinceDone = lastDoneAt ? (Date.now() - lastDoneAt) / 1000 : 99;
    const hop = sinceDone < 1.6 ? Math.abs(Math.sin(sinceDone * Math.PI * 2.5)) * 0.35 * (1.6 - sinceDone) : 0;

    root.current.position.y = hop + Math.sin(t * (working ? 7 : 2)) * (working ? 0.02 : 0.04);
    root.current.rotation.y = sinceDone < 1.6 ? sinceDone * Math.PI * 1.25 : 0;
    head.current.rotation.y = working ? Math.sin(t * 1.3) * 0.12 : Math.sin(t * 0.6) * 0.4;
    head.current.rotation.x = working ? 0.28 : Math.sin(t * 0.9) * 0.05;

    if (working) {
      leftArm.current.rotation.x = -1.2 + Math.sin(t * 18) * 0.25;
      rightArm.current.rotation.x = -1.2 + Math.sin(t * 18 + Math.PI) * 0.25;
    } else if (pointing) {
      leftArm.current.rotation.x = -0.15;
      rightArm.current.rotation.x = -2.4 + Math.sin(t * 3) * 0.2;
    } else {
      const wave = sinceDone < 1.6 ? -2.6 : -0.15 + Math.sin(t) * 0.06;
      leftArm.current.rotation.x = wave;
      rightArm.current.rotation.x = sinceDone < 1.6 ? -2.6 : -0.15 - Math.sin(t) * 0.06;
    }

    eyes.current.scale.y = t % 3.7 < 0.12 ? 0.1 : 1;
    if (antenna.current) antenna.current.emissiveIntensity = working ? 1.5 + Math.sin(t * 10) : 0.4;
  });

  return (
    <group scale={scale}>
      <group ref={root}>
        {/* body */}
        <mesh castShadow position={[0, 0.45, 0]}>
          <capsuleGeometry args={[0.28, 0.3, 8, 16]} />
          <meshStandardMaterial color={color} roughness={0.4} />
        </mesh>
        {/* belly screen */}
        <mesh position={[0, 0.45, 0.27]}>
          <circleGeometry args={[0.12, 24]} />
          <meshStandardMaterial color="#ffffff" emissive={working ? "#f78b04" : "#4fc3d1"} emissiveIntensity={0.6} />
        </mesh>
        {/* arms */}
        <group ref={leftArm} position={[-0.33, 0.62, 0]}>
          <mesh castShadow position={[0, -0.16, 0]}>
            <capsuleGeometry args={[0.07, 0.2, 4, 8]} />
            <meshStandardMaterial color={color} roughness={0.4} />
          </mesh>
        </group>
        <group ref={rightArm} position={[0.33, 0.62, 0]}>
          <mesh castShadow position={[0, -0.16, 0]}>
            <capsuleGeometry args={[0.07, 0.2, 4, 8]} />
            <meshStandardMaterial color={color} roughness={0.4} />
          </mesh>
        </group>
        {/* head */}
        <group ref={head} position={[0, 1.08, 0]}>
          <mesh castShadow>
            <sphereGeometry args={[0.36, 32, 32]} />
            <meshStandardMaterial color="#f4ece6" roughness={0.3} />
          </mesh>
          {/* face plate */}
          <mesh position={[0, -0.02, 0.24]} scale={[1, 0.75, 0.5]}>
            <sphereGeometry args={[0.26, 32, 32]} />
            <meshStandardMaterial color="#1d1416" roughness={0.2} />
          </mesh>
          <group ref={eyes} position={[0, 0, 0.36]}>
            <mesh position={[-0.09, 0, 0]}>
              <sphereGeometry args={[0.05, 16, 16]} />
              <meshStandardMaterial color="#4fc3d1" emissive="#4fc3d1" emissiveIntensity={1.4} />
            </mesh>
            <mesh position={[0.09, 0, 0]}>
              <sphereGeometry args={[0.05, 16, 16]} />
              <meshStandardMaterial color="#4fc3d1" emissive="#4fc3d1" emissiveIntensity={1.4} />
            </mesh>
          </group>
          {/* blush */}
          <mesh position={[-0.2, -0.1, 0.27]}>
            <circleGeometry args={[0.045, 16]} />
            <meshBasicMaterial color="#ff9a90" transparent opacity={0.8} />
          </mesh>
          <mesh position={[0.2, -0.1, 0.27]}>
            <circleGeometry args={[0.045, 16]} />
            <meshBasicMaterial color="#ff9a90" transparent opacity={0.8} />
          </mesh>
          {/* antenna */}
          <mesh position={[0, 0.42, 0]}>
            <cylinderGeometry args={[0.015, 0.015, 0.14]} />
            <meshStandardMaterial color="#888" />
          </mesh>
          <mesh position={[0, 0.52, 0]}>
            <sphereGeometry args={[0.055, 16, 16]} />
            <meshStandardMaterial ref={antenna} color="#f78b04" emissive="#f78b04" emissiveIntensity={0.4} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

/** Floating screen above a busy desk with "lines of work" scrolling by. */
function Hologram() {
  const bars = useRef<(Mesh | null)[]>([]);
  const [still] = useState(reducedMotion);
  useFrame(({ clock }) => {
    if (still) return;
    bars.current.forEach((b, i) => {
      if (b) b.scale.x = 0.35 + 0.65 * Math.abs(Math.sin(clock.elapsedTime * 2.2 + i * 1.3));
    });
  });
  return (
    <Float speed={3} floatIntensity={0.4} rotationIntensity={0}>
      <group position={[0.95, 1.55, -0.1]} rotation-y={-0.35}>
        <mesh>
          <planeGeometry args={[0.75, 0.5]} />
          <meshBasicMaterial color="#4fc3d1" transparent opacity={0.18} />
        </mesh>
        {[0, 1, 2, 3].map((i) => (
          <mesh
            key={i}
            ref={(m) => {
              bars.current[i] = m;
            }}
            position={[0, 0.17 - i * 0.11, 0.01]}
          >
            <planeGeometry args={[0.58, 0.04]} />
            <meshBasicMaterial color={i === 0 ? "#f78b04" : "#4fc3d1"} />
          </mesh>
        ))}
      </group>
    </Float>
  );
}

function Desk({ agent, state, color, seed, position }: {
  agent: Agent;
  state: DeskState;
  color: string;
  seed: number;
  position: [number, number, number];
}) {
  const working = state.working.length > 0;
  return (
    <group position={position}>
      {/* rug spot */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.005, 0.1]} receiveShadow>
        <circleGeometry args={[1, 40]} />
        <meshStandardMaterial color={working ? "#3b2324" : "#1f4a54"} />
      </mesh>
      {/* chair + bot, behind the desk, facing the camera */}
      <mesh position={[0, 0.2, -0.45]} castShadow>
        <cylinderGeometry args={[0.32, 0.32, 0.1, 24]} />
        <meshStandardMaterial color="#2b1718" />
      </mesh>
      <group position={[0, 0.25, -0.45]}>
        <Bot color={color} working={working} lastDoneAt={state.lastDoneAt} seed={seed} scale={1.15} />
      </group>
      {/* desk */}
      <RoundedBox args={[1.5, 0.08, 0.7]} radius={0.03} position={[0, 0.72, 0.15]} castShadow receiveShadow>
        <meshStandardMaterial color="#c98a4b" roughness={0.6} />
      </RoundedBox>
      {[-0.65, 0.65].map((x) => (
        <mesh key={x} position={[x, 0.36, 0.15]} castShadow>
          <boxGeometry args={[0.07, 0.72, 0.6]} />
          <meshStandardMaterial color="#a86f38" />
        </mesh>
      ))}
      {/* laptop: screen faces the bot */}
      <group position={[0, 0.77, 0.12]}>
        <mesh>
          <boxGeometry args={[0.5, 0.02, 0.32]} />
          <meshStandardMaterial color="#d0d4d8" metalness={0.5} roughness={0.3} />
        </mesh>
        <mesh position={[0, 0.16, 0.16]} rotation-x={-0.25}>
          <boxGeometry args={[0.5, 0.32, 0.02]} />
          <meshStandardMaterial
            color="#d0d4d8"
            emissive={working ? "#4fc3d1" : "#000000"}
            emissiveIntensity={working ? 0.35 : 0}
            metalness={0.5}
            roughness={0.3}
          />
        </mesh>
        {working && <pointLight position={[0, 0.25, -0.1]} color="#4fc3d1" intensity={1.2} distance={1.4} />}
      </group>
      {/* mug */}
      <mesh position={[0.5, 0.82, 0.3]} castShadow>
        <cylinderGeometry args={[0.06, 0.05, 0.12, 16]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {working && (
        <>
          <Hologram />
          <Sparkles count={14} scale={[1.4, 1.2, 1]} position={[0, 1.4, -0.3]} size={3} speed={0.6} color="#f78b04" />
        </>
      )}
      <Label name={`${agent.name} · ${agent.role}`} bubble={working ? state.working[0] : undefined} position={[0, 2.15, -0.45]} />
    </group>
  );
}

function Manager({ state, notes, sideX }: { state: ManagerState; notes: number; sideX: number }) {
  const label = state === "planning" ? "Planning the work…" : state === "merging" ? "Merging results…" : "Coffee break";
  return (
    <group position={[0, 0, -2.6]}>
      {/* whiteboard */}
      <RoundedBox args={[3.2, 1.6, 0.08]} radius={0.04} position={[0, 1.9, -0.9]} castShadow>
        <meshStandardMaterial color="#f8f6f2" />
      </RoundedBox>
      {Array.from({ length: Math.min(notes, 10) }, (_, i) => (
        <mesh key={i} position={[-1.25 + (i % 5) * 0.62, 2.3 - Math.floor(i / 5) * 0.55, -0.85]} rotation-z={(i % 3) * 0.06 - 0.06}>
          <planeGeometry args={[0.42, 0.38]} />
          <meshStandardMaterial color={BODY_COLORS[i % BODY_COLORS.length]} />
        </mesh>
      ))}
      <group position={[sideX, 0, 0.9]} rotation-y={0.6}>
        <Bot color="#f78b04" working={state === "merging"} pointing={state === "planning"} seed={42} scale={1.25} />
      </group>
      <Label name="Max · Manager" bubble={label} position={[sideX, 2.45, 0.9]} />
    </group>
  );
}

function Plant({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.25, 0]} castShadow>
        <cylinderGeometry args={[0.22, 0.17, 0.5, 20]} />
        <meshStandardMaterial color="#a30502" />
      </mesh>
      {[
        [0, 0.75, 0, 0.32],
        [0.15, 0.95, 0.05, 0.22],
        [-0.14, 0.9, -0.05, 0.24],
      ].map(([x, y, z, r], i) => (
        <mesh key={i} position={[x, y, z]} castShadow>
          <sphereGeometry args={[r, 16, 16]} />
          <meshStandardMaterial color="#3f9e5a" roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
}

function Room({ width, back, front }: { width: number; back: number; front: number }) {
  const depth = front - back;
  const cz = (front + back) / 2;
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, cz]} receiveShadow>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color="#1f5560" />
      </mesh>
      {/* checker tiles for a cosy floor */}
      {Array.from({ length: Math.ceil(width / 2) * Math.ceil(depth / 2) }, (_, i) => {
        const cols = Math.ceil(width / 2);
        const x = -width / 2 + 1 + (i % cols) * 2;
        const z = back + 1 + Math.floor(i / cols) * 2;
        if ((i % cols) % 2 === Math.floor(i / cols) % 2 || z > front - 0.5) return null;
        return (
          <mesh key={i} rotation-x={-Math.PI / 2} position={[x, 0.002, z]} receiveShadow>
            <planeGeometry args={[2, 2]} />
            <meshStandardMaterial color="#246270" />
          </mesh>
        );
      })}
      <mesh position={[0, 2, back]} receiveShadow>
        <planeGeometry args={[width, 4]} />
        <meshStandardMaterial color="#7a3f33" />
      </mesh>
      <mesh position={[-width / 2, 2, cz]} rotation-y={Math.PI / 2} receiveShadow>
        <planeGeometry args={[depth, 4]} />
        <meshStandardMaterial color="#6a352c" />
      </mesh>
      <mesh position={[width / 2, 2, cz]} rotation-y={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[depth, 4]} />
        <meshStandardMaterial color="#6a352c" />
      </mesh>
      {/* skirting */}
      <mesh position={[0, 0.08, back + 0.02]}>
        <boxGeometry args={[width, 0.16, 0.04]} />
        <meshStandardMaterial color="#f78b04" />
      </mesh>
      {/* windows */}
      {[-width / 2 + 1.8, width / 2 - 1.8].map((x) => (
        <group key={x} position={[x, 2.4, back + 0.01]}>
          <mesh>
            <planeGeometry args={[1.6, 1.2]} />
            <meshStandardMaterial color="#bff2f7" emissive="#4fc3d1" emissiveIntensity={0.6} />
          </mesh>
          <mesh position={[0, 0, 0.01]}>
            <planeGeometry args={[0.06, 1.2]} />
            <meshStandardMaterial color="#2b1718" />
          </mesh>
          <mesh position={[0, 0, 0.01]}>
            <planeGeometry args={[1.6, 0.06]} />
            <meshStandardMaterial color="#2b1718" />
          </mesh>
        </group>
      ))}
      {/* hanging lamps */}
      {[-width / 4, width / 4].map((x) => (
        <group key={x} position={[x, 3.6, cz - 1]}>
          <mesh>
            <cylinderGeometry args={[0.01, 0.01, 0.8]} />
            <meshStandardMaterial color="#222" />
          </mesh>
          <mesh position={[0, -0.45, 0]}>
            <coneGeometry args={[0.28, 0.25, 24, 1, true]} />
            <meshStandardMaterial color="#f78b04" side={2} />
          </mesh>
          <pointLight position={[0, -0.6, 0]} color="#ffd9a0" intensity={6} distance={6} />
        </group>
      ))}
      <Plant position={[-width / 2 + 0.6, 0, back + 0.6]} />
      <Plant position={[width / 2 - 0.6, 0, back + 0.6]} />
      <Plant position={[-width / 2 + 0.6, 0, front - 0.8]} />
      <Plant position={[width / 2 - 0.6, 0, front - 0.8]} />
    </group>
  );
}

export default function OfficeScene({
  agents,
  desks,
  manager,
  notes,
}: {
  agents: Agent[];
  desks: Record<string, DeskState>;
  manager: ManagerState;
  notes: number;
}) {
  const cols = Math.min(4, Math.max(3, Math.ceil(agents.length / 2)));
  const rows = Math.max(1, Math.ceil(agents.length / cols));
  const spacingX = 2.5;
  const spacingZ = 2.6;
  const width = cols * spacingX + 3;
  const back = -3.6;
  const front = (rows - 1) * spacingZ + 2;
  const centerZ = (back + front) / 2;

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [0, 5.2 + rows * 0.6, front + 4.5], fov: 45 }}
      fallback={<div className="grid h-full place-items-center text-sm text-muted">3D view needs WebGL.</div>}
    >
      <color attach="background" args={["#1d1011"]} />
      <ambientLight intensity={0.6} />
      <hemisphereLight args={["#fff4e6", "#27606b", 1.2]} />
      <directionalLight
        position={[4, 9, 7]}
        intensity={1.8}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
      />
      <Room width={width} back={back} front={front} />
      <Manager state={manager} notes={notes} sideX={-width / 2 + 1} />
      {agents.map((a, i) => {
        const row = Math.floor(i / cols);
        const inRow = Math.min(cols, agents.length - row * cols);
        const x = (i % cols - (inRow - 1) / 2) * spacingX;
        const z = row * spacingZ;
        return (
          <Desk
            key={a.id}
            agent={a}
            state={desks[a.id] ?? { working: [] }}
            color={BODY_COLORS[i % BODY_COLORS.length]}
            seed={i * 1.7}
            position={[x, 0, z]}
          />
        );
      })}
      <ContactShadows position={[0, 0.01, centerZ]} opacity={0.35} scale={20} blur={2.5} far={4} />
      <OrbitControls
        target={[0, 0.9, centerZ + 0.4]}
        enablePan={false}
        minDistance={4}
        maxDistance={16}
        minPolarAngle={0.3}
        maxPolarAngle={1.35}
        minAzimuthAngle={-0.9}
        maxAzimuthAngle={0.9}
      />
    </Canvas>
  );
}
