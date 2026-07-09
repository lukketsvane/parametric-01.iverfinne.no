import { marchGrid, type Grid } from "./marching-cubes"
import type { Params } from "./engine"

/**
 * The vessel motor: parameters → scalar field → watertight mesh.
 *
 * Everything is one signed-distance-ish field in cylindrical coordinates
 * around the y axis:
 *
 *   1. profile  R(h): foot → belly → neck → trumpet mouth, with pagoda
 *      skirts added as a sawtooth that flares and snaps back `tiers` times
 *   2. core     a hollow solid of revolution at R(h)·core, open at the
 *      mouth, with a floor above the foot
 *   3. fins     n thin half-planes through the axis, clipped to the
 *      profile + finDepth envelope, optionally twisted
 *   4. shelves  m thin horizontal annuli, clipped to profile + ringDepth
 *   5. skin     a smooth outer shell wrapping everything below skin·H,
 *      with a torn upper edge
 *   6. edges    every free edge is displaced by periodic ruffle harmonics
 *      and eroded by seeded tear noise; fin × shelf crossings grow spikes
 *
 * The parts are fused with smooth booleans and the interior cavity is
 * carved last, so the result reads as one slip-cast piece.
 */

export type VesselMeshArrays = {
  positions: Float32Array
  normals: Float32Array
  indices: Uint32Array
}

const TAU = Math.PI * 2

/* ---------------------------------- noise --------------------------------- */

// integer lattice hash → [0,1)
function ih(x: number, y: number, z: number, s: number): number {
  let n =
    Math.imul(x, 374761393) ^
    Math.imul(y, 668265263) ^
    Math.imul(z, 1274126177) ^
    Math.imul(s, 39916801)
  n = Math.imul(n ^ (n >>> 13), 1274126177)
  n ^= n >>> 16
  return (n >>> 0) / 4294967296
}

// trilinear value noise, ~[0,1]
function vnoise3(x: number, y: number, z: number, s: number): number {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const zi = Math.floor(z)
  const xf = x - xi
  const yf = y - yi
  const zf = z - zi
  const u = xf * xf * (3 - 2 * xf)
  const v = yf * yf * (3 - 2 * yf)
  const w = zf * zf * (3 - 2 * zf)
  const c000 = ih(xi, yi, zi, s)
  const c100 = ih(xi + 1, yi, zi, s)
  const c010 = ih(xi, yi + 1, zi, s)
  const c110 = ih(xi + 1, yi + 1, zi, s)
  const c001 = ih(xi, yi, zi + 1, s)
  const c101 = ih(xi + 1, yi, zi + 1, s)
  const c011 = ih(xi, yi + 1, zi + 1, s)
  const c111 = ih(xi + 1, yi + 1, zi + 1, s)
  const x00 = c000 + (c100 - c000) * u
  const x10 = c010 + (c110 - c010) * u
  const x01 = c001 + (c101 - c001) * u
  const x11 = c011 + (c111 - c011) * u
  const y0 = x00 + (x10 - x00) * v
  const y1 = x01 + (x11 - x01) * v
  return y0 + (y1 - y0) * w
}

/* ------------------------------- profile ---------------------------------- */

const PROFILE_N = 512

function fract(x: number): number {
  return x - Math.floor(x)
}

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

// cosine ease between two radii
function ease(a: number, b: number, t: number): number {
  return a + (b - a) * (0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, t))))
}

/**
 * Rotation-symmetric part of the profile, sampled over h ∈ [0,1], plus a
 * slope factor per sample: s = cos(surface tilt), used to turn radial
 * differences into approximate true distances so near-horizontal parts
 * (flat collars, skirt undersides) keep their real thickness.
 */
function buildProfileTable(p: Params, H: number): { R: Float32Array; S: Float32Array } {
  const R = new Float32Array(PROFILE_N + 1)
  const tierLo = 0.12
  const skirtPow = 1.2 + p.droop * 3
  for (let i = 0; i <= PROFILE_N; i++) {
    const h = i / PROFILE_N
    let r: number
    if (h <= p.bellyY) {
      r = ease(p.foot, p.belly, h / p.bellyY)
    } else if (h <= p.neckY) {
      r = ease(p.belly, p.neck, (h - p.bellyY) / (p.neckY - p.bellyY))
    } else {
      const t = (h - p.neckY) / (1 - p.neckY)
      r = p.neck + p.flare * Math.pow(t, 1 + p.lip * 4)
    }
    // pagoda skirts: tiers stack downward from the neck, each hanging like
    // an umbrella — widest at its bottom edge over an overhung cliff
    if (p.tiers >= 1 && p.tierDepth > 0 && h > tierLo && h < p.neckY) {
      const u = (p.neckY - h) / (p.neckY - tierLo)
      const t = fract(u * p.tiers)
      const cut = smoothstep(1, 0.96, t) // resolvable overhang, not a step
      const w = Math.min(1, Math.max(0.5, r / Math.max(p.belly, p.foot)))
      r += p.tierDepth * Math.pow(t, skirtPow) * cut * w
    }
    R[i] = r
  }
  const S = new Float32Array(PROFILE_N + 1)
  for (let i = 0; i <= PROFILE_N; i++) {
    const a = R[Math.max(0, i - 1)]
    const b = R[Math.min(PROFILE_N, i + 1)]
    const dRdy = (b - a) / (((2 / PROFILE_N) * H) || 1)
    // clamp: dead-flat spots would flatten the field's gradient entirely
    S[i] = Math.max(0.3, 1 / Math.hypot(1, dRdy))
  }
  return { R, S }
}

function sampleTable(tab: Float32Array, h: number): number {
  const x = Math.min(1, Math.max(0, h)) * PROFILE_N
  const i = Math.min(PROFILE_N - 1, Math.floor(x))
  return tab[i] + (tab[i + 1] - tab[i]) * (x - i)
}

/* --------------------------------- field ----------------------------------- */

function smin(a: number, b: number, k: number): number {
  const h = Math.min(1, Math.max(0, 0.5 + (0.5 * (b - a)) / k))
  return b + (a - b) * h - k * h * (1 - h)
}

/**
 * Sample the vessel field on a regular grid and extract the surface.
 * `res` is the target cell count along the largest axis; structure
 * thinner than the grid can resolve is thickened to stay printable
 * on screen, so coarse previews stay watertight.
 */
export function buildVesselArrays(p: Params, res: number): VesselMeshArrays {
  const H = p.height
  const seed = (p.seed | 0) || 1

  const { R: prof, S: slope } = buildProfileTable(p, H)
  let maxProf = 0
  for (let i = 0; i <= PROFILE_N; i++) maxProf = Math.max(maxProf, prof[i])

  const fins = p.fins > 0 ? Math.max(3, Math.round(p.fins)) : 0
  const rings = p.rings > 0 ? Math.max(1, Math.round(p.rings)) : 0

  const maxOut =
    maxProf +
    Math.max(
      fins ? p.finDepth : 0,
      rings ? p.ringDepth : 0,
      p.skin > 0 ? p.finDepth * 0.5 + 0.06 : 0,
    ) +
    p.ruffle +
    p.mouthAmp +
    0.22 * p.spikes +
    0.08

  const spanXZ = 2 * maxOut + 0.12
  const spanY = H + 0.12
  const cell = Math.max(spanXZ, spanY) / Math.max(32, Math.min(288, res))
  const nx = Math.ceil(spanXZ / cell) + 1
  const ny = Math.ceil(spanY / cell) + 1
  const nz = nx
  const ox = (-(nx - 1) * cell) / 2
  const oy = -0.06
  const oz = (-(nz - 1) * cell) / 2

  // structure the grid can actually resolve
  const ft = Math.max(p.finThick, cell * 1.9)
  const rt = Math.max(p.ringThick, cell * 1.9)
  const shellT = Math.max(0.06, ft * 1.15)
  const wall = Math.max(p.wall, cell * 2.6)
  const floorT = Math.max(0.09, wall * 1.2)

  // seeded phases for the periodic edge harmonics
  const ph1 = ih(seed, 11, 7, 5) * TAU
  const ph2 = ih(seed, 23, 3, 9) * TAU
  const ph3 = ih(seed, 5, 31, 13) * TAU
  const F = Math.max(2, Math.round(p.ruffleFreq))
  const ruffleAt = (theta: number, h: number): number =>
    0.62 * Math.cos(F * theta + ph1 + 1.8 * Math.sin(3.4 * h + ph2)) +
    0.38 * Math.cos((2 * F + 1) * theta + ph3 + 2.2 * h)

  const W = fins ? TAU / fins : 0
  const twistRate = p.twist * 2.4 // radians of fin rotation across full height
  const ringLo = Math.max(0.05, p.skin > 0 ? p.skin + 0.03 : 0.05)
  const ringHi = Math.max(ringLo + 0.05, p.neckY)
  const ringStep = ((ringHi - ringLo) * H) / Math.max(1, rings)
  const coreLo = p.neckY - 0.08
  const coreHi = p.neckY + 0.12
  const skinTop = p.skin * H
  const mouthW = Math.round(p.mouthWave)

  // trig per vertical column, reused across every y
  const radCol = new Float32Array(nx * nz)
  const thCol = new Float32Array(nx * nz)
  for (let z = 0; z < nz; z++) {
    const pz = oz + z * cell
    for (let x = 0; x < nx; x++) {
      const px = ox + x * cell
      radCol[x + nx * z] = Math.hypot(px, pz)
      thCol[x + nx * z] = Math.atan2(pz, px)
    }
  }

  const field = new Float32Array(nx * ny * nz)
  const nxy = nx * ny
  const noiseF = 7
  const tearAmp = p.rough * 0.1

  for (let z = 0; z < nz; z++) {
    const pz = oz + z * cell
    for (let y = 0; y < ny; y++) {
      const py = oy + y * cell
      const h = py / H
      const R0 = sampleTable(prof, h)
      const s = sampleTable(slope, h)
      const row = nx * (y + ny * z)
      const inBody = py > -0.02 && py < H + 0.1
      for (let x = 0; x < nx; x++) {
        const px = ox + x * cell
        const rad = radCol[x + nx * z]
        const theta = thCol[x + nx * z]

        if (!inBody) {
          field[row + x] = Math.max(-py, py - H, rad - maxOut)
          continue
        }

        // θ-dependent profile: squared/waved mouths grow above the neck
        let Rp = R0
        if (p.mouthAmp > 0 && mouthW > 0 && h > p.neckY) {
          const wgt = smoothstep(p.neckY, 1, h)
          Rp += p.mouthAmp * Math.cos(mouthW * theta) * wgt * wgt
        }

        const coreS = p.core + (1 - p.core) * smoothstep(coreLo, coreHi, h)
        const Rc = Rp * coreS

        // shared edge displacement: ruffle waves + two octaves of tear
        // erosion, only computed near the band where free edges live
        let edgeN = 0
        if (rad > Rc - 0.15 && (p.ruffle > 0 || tearAmp > 0)) {
          if (p.ruffle > 0) edgeN += p.ruffle * ruffleAt(theta, py)
          if (tearAmp > 0)
            edgeN +=
              tearAmp *
              (vnoise3(px * noiseF, py * noiseF, pz * noiseF, seed) +
                0.5 * vnoise3(px * 2.6 * noiseF, py * 2.6 * noiseF, pz * 2.6 * noiseF, seed ^ 77) -
                0.95)
        }

        // every top edge tears and ruffles instead of ending in a flat cut
        const topCut = H + edgeN * 0.9

        // core: hollow solid of revolution, open mouth. Radial differences
        // are scaled by the profile slope so flat collars and skirt
        // undersides measure ~true distance, and the cavity is the same
        // surface offset inward along its normal — walls stay walls.
        const fCore = (rad - Rc) * s
        const dCore = Math.max(fCore, -py, py - topCut)
        const dCav = Math.max(fCore + wall, floorT - py)

        let u = dCore

        // spikes want the raw plane distances of both lattices
        let dPlaneF = Infinity
        let dPlaneR = Infinity
        if (fins) {
          const thT = theta + twistRate * h + W / 2
          const a = ((thT % W) + W) % W - W / 2
          dPlaneF = rad * Math.sin(Math.abs(a))
        }
        if (rings) {
          // shelves drape: their plane undulates vertically with droop
          const drape =
            p.droop > 0 && p.ruffle > 0
              ? p.droop * p.ruffle * 0.9 * ruffleAt(theta + 2.1, py * 0.37 + 5)
              : 0
          const yy = py - ringLo * H + drape
          if (yy > -ringStep && yy < (ringHi - ringLo) * H + ringStep) {
            const m = ((yy % ringStep) + ringStep) % ringStep - ringStep / 2
            dPlaneR = Math.abs(m)
          }
        }

        let spike = 0
        if (p.spikes > 0 && fins && rings && dPlaneF < 0.16 && dPlaneR < 0.16) {
          const sF = 1 - dPlaneF / 0.16
          const sR = 1 - dPlaneR / 0.16
          spike = p.spikes * 0.26 * Math.pow(sF * sR, 1.6)
        }

        if (fins) {
          const env = Rp + p.finDepth + edgeN + spike
          const dFin = Math.max(dPlaneF - ft / 2, rad - env, -py, py - topCut)
          u = smin(u, dFin, 0.04)
        }

        if (rings && dPlaneR < Infinity) {
          const env = Rp + p.ringDepth + edgeN + spike
          const dRing = Math.max(
            dPlaneR - rt / 2,
            rad - env,
            ringLo * H - py,
            py - ringHi * H,
          )
          u = smin(u, dRing, 0.04)
        }

        // solid outer skin over the lower body, torn along its top edge
        if (p.skin > 0) {
          const mid = Rp + p.finDepth * 0.5
          const cutY = skinTop * (1 + 0.9 * edgeN)
          const dSkin = Math.max(
            Math.abs(rad - mid) - shellT / 2,
            py - cutY,
            0.02 - py,
          )
          u = smin(u, dSkin, 0.05)
        }

        // carve the interior last so every part shares one cavity
        field[row + x] = Math.max(u, -dCav)
      }
    }
  }

  const grid: Grid = { nx, ny, nz, ox, oy, oz, cell, field }
  const { positions, indices } = marchGrid(grid)
  return { positions, normals: buildNormals(positions, indices), indices }
}

/** Area-weighted smooth vertex normals — dense MC meshes shade well with these. */
function buildNormals(positions: Float32Array, indices: Uint32Array): Float32Array {
  const normals = new Float32Array(positions.length)
  for (let t = 0; t < indices.length; t += 3) {
    const a = indices[t] * 3
    const b = indices[t + 1] * 3
    const c = indices[t + 2] * 3
    const abx = positions[b] - positions[a]
    const aby = positions[b + 1] - positions[a + 1]
    const abz = positions[b + 2] - positions[a + 2]
    const acx = positions[c] - positions[a]
    const acy = positions[c + 1] - positions[a + 1]
    const acz = positions[c + 2] - positions[a + 2]
    const nx = aby * acz - abz * acy
    const ny = abz * acx - abx * acz
    const nz = abx * acy - aby * acx
    normals[a] += nx
    normals[a + 1] += ny
    normals[a + 2] += nz
    normals[b] += nx
    normals[b + 1] += ny
    normals[b + 2] += nz
    normals[c] += nx
    normals[c + 1] += ny
    normals[c + 2] += nz
  }
  for (let i = 0; i < normals.length; i += 3) {
    const l = Math.hypot(normals[i], normals[i + 1], normals[i + 2]) || 1
    normals[i] /= l
    normals[i + 1] /= l
    normals[i + 2] /= l
  }
  return normals
}
