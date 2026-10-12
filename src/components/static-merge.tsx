"use client";

import { type ReactNode, useEffect, useLayoutEffect, useRef } from "react";
import { type BufferGeometry, type Group, type Material, Matrix4, Mesh, type MeshStandardMaterial, type Object3D } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/** Put on the root of anything that animates (useFrame) so it is never merged. */
export const DYNAMIC = { dynamic: true } as const;

type Std = MeshStandardMaterial & { map?: { uuid: string } | null; emissive?: { getHexString(): string } };

/** Meshes that look the same (material and shadow flags) can share one draw call. */
function keyOf(mesh: Mesh) {
  const m = mesh.material as Std;
  const g = mesh.geometry as BufferGeometry;
  const attrs = Object.keys(g.attributes).sort().join(",");
  return [
    m.type,
    m.color?.getHexString(),
    m.roughness,
    m.metalness,
    m.map?.uuid,
    m.emissive?.getHexString(),
    m.emissiveIntensity,
    m.side,
    m.toneMapped,
    m.flatShading,
    m.vertexColors,
    mesh.castShadow,
    mesh.receiveShadow,
    attrs,
    g.index ? "i" : "n",
  ].join("|");
}

function mergeable(obj: Object3D): obj is Mesh {
  const mesh = obj as Mesh & { isInstancedMesh?: boolean; isSkinnedMesh?: boolean };
  if (!mesh.isMesh || mesh.isInstancedMesh || mesh.isSkinnedMesh || Array.isArray(mesh.material)) return false;
  const m = mesh.material as Material;
  // transparent things need their own depth sorting
  return !m.transparent && m.depthWrite !== false && mesh.geometry.morphAttributes.position === undefined;
}

/**
 * Static scenery as a handful of big meshes: after every render, the meshes inside are grouped by
 * material, merged into one geometry per group and drawn once (with shadows), and the originals
 * are hidden. Thousands of little boxes become a few dozen draw calls. Anything under an object
 * with `userData.dynamic` (see DYNAMIC) is left alone.
 */
export function StaticMerge({ children }: { children: ReactNode }) {
  const root = useRef<Group>(null);
  const merged = useRef<Group>(null);
  const hidden = useRef(new WeakSet<Object3D>());

  useLayoutEffect(() => {
    const g = root.current;
    const out = merged.current;
    if (!g || !out) return;
    for (const m of out.children as Mesh[]) {
      m.geometry.dispose();
      (m.material as Material).dispose();
    }
    out.clear();

    const groups = new Map<string, Mesh[]>();
    const walk = (obj: Object3D) => {
      if (obj === out || obj.userData.dynamic) return;
      if (mergeable(obj) && (obj.visible || hidden.current.has(obj))) {
        const key = keyOf(obj);
        const list = groups.get(key);
        if (list) list.push(obj);
        else groups.set(key, [obj]);
      }
      for (const child of obj.children) walk(child);
    };
    walk(g);

    g.updateWorldMatrix(true, true);
    const toLocal = new Matrix4().copy(g.matrixWorld).invert();
    const rel = new Matrix4();
    for (const list of groups.values()) {
      if (list.length < 2) {
        list[0].visible = true;
        continue;
      }
      const geometries = list.map((mesh) => mesh.geometry.clone().applyMatrix4(rel.multiplyMatrices(toLocal, mesh.matrixWorld)));
      const geometry = mergeGeometries(geometries, false);
      geometries.forEach((x) => x.dispose());
      if (!geometry) {
        list.forEach((mesh) => (mesh.visible = true));
        continue;
      }
      const first = list[0];
      const mesh = new Mesh(geometry, (first.material as Material).clone());
      mesh.castShadow = first.castShadow;
      mesh.receiveShadow = first.receiveShadow;
      mesh.matrixAutoUpdate = false;
      out.add(mesh);
      for (const original of list) {
        original.visible = false;
        hidden.current.add(original);
      }
    }
  });

  useEffect(() => {
    const out = merged.current;
    return () => {
      for (const m of (out?.children ?? []) as Mesh[]) {
        m.geometry.dispose();
        (m.material as Material).dispose();
      }
    };
  }, []);

  return (
    <group ref={root}>
      {children}
      <group ref={merged} />
    </group>
  );
}
