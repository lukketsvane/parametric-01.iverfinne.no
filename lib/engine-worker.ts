import { buildVesselArrays } from "./vessel"
import type { Params } from "./engine"

/**
 * Meshing worker: keeps field sampling + marching cubes off the main
 * thread so slider drags stay responsive. One job in, one mesh out.
 */
export type EngineJob = { gen: number; params: Params; res: number }
export type EngineResult = {
  gen: number
  positions: Float32Array
  normals: Float32Array
  indices: Uint32Array
}

self.onmessage = (e: MessageEvent<EngineJob>) => {
  const { gen, params, res } = e.data
  const { positions, normals, indices } = buildVesselArrays(params, res)
  const msg: EngineResult = { gen, positions, normals, indices }
  ;(self as unknown as Worker).postMessage(msg, [
    positions.buffer,
    normals.buffer,
    indices.buffer,
  ])
}
