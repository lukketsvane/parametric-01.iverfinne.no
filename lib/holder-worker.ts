import { buildHolderArrays, type HolderParams } from "./candle-holder"

/**
 * Meshing worker: keeps the SDF sampling + marching cubes off the main
 * thread so slider drags stay responsive. One job in, one mesh out.
 */
export type HolderJob = { gen: number; params: HolderParams; cellsPerTube: number }
export type HolderResult = {
  gen: number
  positions: Float32Array
  normals: Float32Array
  indices: Uint32Array
}

self.onmessage = (e: MessageEvent<HolderJob>) => {
  const { gen, params, cellsPerTube } = e.data
  const { positions, normals, indices } = buildHolderArrays(params, cellsPerTube)
  const msg: HolderResult = { gen, positions, normals, indices }
  ;(self as unknown as Worker).postMessage(msg, [
    positions.buffer,
    normals.buffer,
    indices.buffer,
  ])
}
