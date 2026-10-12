"use client";

import { rgbMaterials } from "./rgb";
import { DYNAMIC } from "./static-merge";

type V3 = [number, number, number];
const NOT_DYNAMIC = {};

/**
 * A custom-built PC tower: black case, tempered-glass side (+x) showing RGB fans and the
 * graphics card, and an RGB strip down the front (+z). Switched off it's just a dark case.
 */
export function PcTower({ p, on, s = 1 }: { p: V3; on: boolean; s?: number }) {
  const m = rgbMaterials();
  return (
    <group position={p} scale={s} userData={on ? DYNAMIC : NOT_DYNAMIC}>
      <mesh position={[0, 0.18, 0]} castShadow>
        <boxGeometry args={[0.16, 0.36, 0.34]} />
        <meshStandardMaterial color="#0b0d12" roughness={0.35} metalness={0.4} />
      </mesh>
      <mesh position={[0.0805, 0.185, 0]} rotation-y={Math.PI / 2} material={on ? m.fans : m.fansOff}>
        <planeGeometry args={[0.3, 0.31]} />
      </mesh>
      <mesh position={[0, 0.18, 0.1705]} material={on ? m.strip : m.off}>
        <planeGeometry args={[0.018, 0.3]} />
      </mesh>
      {/* top vent */}
      <mesh position={[0, 0.3605, 0]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[0.12, 0.26]} />
        <meshStandardMaterial color="#1f2328" roughness={0.9} />
      </mesh>
    </group>
  );
}
