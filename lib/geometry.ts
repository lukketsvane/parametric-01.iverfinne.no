import * as THREE from "three"
import type { HolderMeshArrays } from "./candle-holder"

/** Wrap raw builder arrays (with SDF-gradient normals) in a geometry. */
export function arraysToGeometry({
  positions,
  normals,
  indices,
}: HolderMeshArrays): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry()
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3))
  geo.setAttribute("normal", new THREE.BufferAttribute(normals, 3))
  geo.setIndex(new THREE.BufferAttribute(indices, 1))
  return geo
}
