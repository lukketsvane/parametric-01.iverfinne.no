import { marchGrid, type Grid } from "./marching-cubes"

/**
 * Parametric candle-stick holders — grown, not modeled.
 *
 * A seeded branching growth process builds a skeleton of tubes inside one
 * symmetry wedge: struts grow from the candle cup, droop or lift under
 * gravity, curl, split, close into loops and end in bulbs or open mouths.
 * The wedge is replicated by the chosen symmetry group (cyclic or dihedral),
 * everything is fused with smooth positive booleans and carved with negative
 * ones (candle socket, tube bores), and marching cubes extracts one
 * watertight organic surface, like slip-cast ceramic. Every growth and
 * symmetry decision is exposed as a parameter.
 */

/**
 * Physical scale: 1 scene unit = 50 mm. STL exports are scaled to mm.
 * The candle socket is built to real candle sizes:
 *  - telys (tealight, e.g. Clas Ohlson 44-1725): Ø39 × 16 mm cup
 *    → socket Ø41 mm, 12 mm deep
 *  - kronelys (taper, e.g. Clas Ohlson 44-3816): Ø22 mm base, 190 mm tall
 *    → socket Ø23 mm, 28 mm deep for grip
 */
export const MM_PER_UNIT = 50

export type CandleType = "telys" | "kronelys"

export const CANDLE_SPECS: Record<
  CandleType,
  { socketR: number; socketDepth: number; cupHalfH: number; label: string }
> = {
  telys: {
    socketR: 20.5 / MM_PER_UNIT, // Ø41 mm
    socketDepth: 12 / MM_PER_UNIT,
    cupHalfH: 8.5 / MM_PER_UNIT, // 17 mm tall cup
    label: "telys Ø39mm",
  },
  kronelys: {
    socketR: 11.5 / MM_PER_UNIT, // Ø23 mm
    socketDepth: 28 / MM_PER_UNIT,
    cupHalfH: 16 / MM_PER_UNIT, // 32 mm tall cup
    label: "kronelys Ø22mm",
  },
}

export type HolderParams = {
  preset: string
  seed: number
  /** which candle the socket is built for */
  candle: CandleType
  /* symmetry group */
  symmetry: number
  /** 0 = cyclic Cn, 1 = dihedral Dn (adds a mirror inside each wedge) */
  mirror: number
  /* growth */
  depth: number
  branches: number
  branchSpread: number
  length: number
  decay: number
  gravity: number
  outward: number
  curl: number
  wiggle: number
  loopiness: number
  /** probability that tips and branch nodes ring the axis */
  rings: number
  /** crown: a ring around the cup mouth that limbs grow from, with bored
      mouths at its corners when open ends are on. 0 = none, 1 = wide */
  crown: number
  /** stacked cells: the grown body is repeated vertically, staggered by
      half a sector, like a tower of fused lattice pods */
  levels: number
  /* body */
  /** 0 = open lattice, towards 1 = a hollow shell grown around the body,
      pierced by one window per wedge that shrinks as the shell closes */
  shell: number
  height: number
  spread: number
  tube: number
  taper: number
  blend: number
  bulb: number
  open: number
  /** conical studs on rings, shells and feet — sea-urchin armor */
  spikes: number
  /* the candle interface */
  cup: number
  cupPos: number
  dish: number
  rimWave: number
}

export const PARAM_RANGES = {
  symmetry: { min: 3, max: 12, step: 1 },
  mirror: { min: 0, max: 1, step: 1 },
  depth: { min: 1, max: 4, step: 1 },
  branches: { min: 1, max: 3, step: 1 },
  branchSpread: { min: 0, max: 1, step: 0.02 },
  length: { min: 0.3, max: 1.5, step: 0.01 },
  decay: { min: 0.5, max: 1, step: 0.01 },
  gravity: { min: -1, max: 1, step: 0.02 },
  outward: { min: 0, max: 1, step: 0.02 },
  curl: { min: -1, max: 1, step: 0.02 },
  wiggle: { min: 0, max: 1, step: 0.02 },
  loopiness: { min: 0, max: 1, step: 0.02 },
  rings: { min: 0, max: 1, step: 0.02 },
  crown: { min: 0, max: 1, step: 0.02 },
  levels: { min: 1, max: 3, step: 1 },
  shell: { min: 0, max: 1, step: 0.02 },
  height: { min: 0.7, max: 2.6, step: 0.01 },
  spread: { min: 0.7, max: 2.2, step: 0.01 },
  tube: { min: 0.06, max: 0.17, step: 0.002 },
  taper: { min: 0, max: 0.6, step: 0.02 },
  blend: { min: 0.04, max: 0.2, step: 0.005 },
  bulb: { min: 0, max: 2, step: 0.02 },
  open: { min: 0, max: 1, step: 0.05 },
  spikes: { min: 0, max: 1, step: 0.02 },
  cup: { min: 0.24, max: 0.48, step: 0.005 },
  cupPos: { min: 0.3, max: 1, step: 0.02 },
  dish: { min: 0, max: 1, step: 0.02 },
  rimWave: { min: 0, max: 1, step: 0.02 },
} as const

export type ParamKey = keyof typeof PARAM_RANGES

/* ------------------------------------------------------------------ */
/* Presets: curated growth settings — starting points, not shapes      */
/* ------------------------------------------------------------------ */

type Recipe = Omit<HolderParams, "preset" | "seed">

export const PRESETS: Record<string, Recipe> = {
  bloom: {
    candle: "kronelys",
    symmetry: 3, mirror: 0,
    depth: 3, branches: 2, branchSpread: 0.55, length: 1.15, decay: 0.9,
    gravity: 0.95, outward: 0.7, curl: 0.08, wiggle: 0, loopiness: 1,
    rings: 0.12, crown: 0, levels: 1, shell: 0,
    height: 2.05, spread: 1.02, tube: 0.09, taper: 0.08, blend: 0.075,
    bulb: 0.25, open: 1, spikes: 0, cup: 0.3, cupPos: 1, dish: 0.42, rimWave: 0.72,
  },
  wheel: {
    candle: "telys",
    symmetry: 8, mirror: 0,
    depth: 1, branches: 1, branchSpread: 0.55, length: 1.3, decay: 0.9,
    gravity: 0.05, outward: 0.9, curl: 0, wiggle: 0, loopiness: 1,
    rings: 0, crown: 0, levels: 1, shell: 0,
    height: 0.75, spread: 1.35, tube: 0.105, taper: 0, blend: 0.08,
    bulb: 0, open: 0, spikes: 0, cup: 0.42, cupPos: 0.55, dish: 0.3, rimWave: 0.9,
  },
  coral: {
    candle: "telys",
    symmetry: 10, mirror: 0,
    depth: 2, branches: 1, branchSpread: 0.3, length: 1.0, decay: 0.9,
    gravity: -0.85, outward: 0.35, curl: 0, wiggle: 0, loopiness: 0.2,
    rings: 0.3, crown: 0.7, levels: 1, shell: 0,
    height: 1.15, spread: 1.2, tube: 0.095, taper: 0.05, blend: 0.075,
    bulb: 0.2, open: 1, spikes: 0, cup: 0.42, cupPos: 0.42, dish: 0, rimWave: 0,
  },
  urchin: {
    candle: "telys",
    symmetry: 12, mirror: 0,
    depth: 1, branches: 1, branchSpread: 0.3, length: 0.7, decay: 0.9,
    gravity: 0.9, outward: 0.3, curl: 0, wiggle: 0, loopiness: 0,
    rings: 0, crown: 0, levels: 1, shell: 1,
    height: 0.72, spread: 1.15, tube: 0.1, taper: 0, blend: 0.07,
    bulb: 0.3, open: 0.75, spikes: 1, cup: 0.44, cupPos: 1, dish: 0, rimWave: 0,
  },
  whisk: {
    candle: "kronelys",
    symmetry: 4, mirror: 0,
    depth: 2, branches: 1, branchSpread: 0.3, length: 1.35, decay: 0.95,
    gravity: -0.85, outward: 0.45, curl: 0.12, wiggle: 0.05, loopiness: 1,
    rings: 0.35, crown: 0.5, levels: 1, shell: 0,
    height: 2.3, spread: 1.1, tube: 0.1, taper: 0.05, blend: 0.09,
    bulb: 0.2, open: 0, spikes: 0, cup: 0.3, cupPos: 0.4, dish: 0, rimWave: 0,
  },
  spider: {
    candle: "kronelys",
    symmetry: 4, mirror: 0,
    depth: 2, branches: 2, branchSpread: 0.55, length: 0.9, decay: 0.9,
    gravity: 0.5, outward: 0.9, curl: 0, wiggle: 0.1, loopiness: 0.5,
    rings: 0.35, crown: 0.22, levels: 1, shell: 0,
    height: 1.3, spread: 1.5, tube: 0.105, taper: 0.1, blend: 0.09,
    bulb: 0.5, open: 1, spikes: 0, cup: 0.35, cupPos: 0.95, dish: 0, rimWave: 0,
  },
  clover: {
    candle: "telys",
    symmetry: 4, mirror: 0,
    depth: 1, branches: 1, branchSpread: 0.4, length: 1.2, decay: 0.95,
    gravity: 0.12, outward: 0.9, curl: 0.45, wiggle: 0.04, loopiness: 1,
    rings: 0, crown: 0, levels: 1, shell: 0,
    height: 1.05, spread: 1.4, tube: 0.12, taper: 0, blend: 0.08,
    bulb: 0.3, open: 0, spikes: 0, cup: 0.33, cupPos: 0.85, dish: 0.3, rimWave: 0.55,
  },
  pod: {
    candle: "telys",
    symmetry: 4, mirror: 0,
    depth: 2, branches: 1, branchSpread: 0.3, length: 0.7, decay: 0.9,
    gravity: 0.9, outward: 0.5, curl: 0, wiggle: 0.06, loopiness: 0.3,
    rings: 0.5, crown: 0, levels: 1, shell: 0.75,
    height: 1.35, spread: 1.1, tube: 0.1, taper: 0, blend: 0.08,
    bulb: 0.4, open: 0.7, spikes: 0, cup: 0.3, cupPos: 1, dish: 0, rimWave: 0,
  },
  cage: {
    candle: "kronelys",
    symmetry: 8, mirror: 0,
    depth: 3, branches: 1, branchSpread: 0.15, length: 0.55, decay: 0.95,
    gravity: 0.9, outward: 0.45, curl: 0, wiggle: 0.04, loopiness: 0.6,
    rings: 0.9, crown: 0.9, levels: 1, shell: 0,
    height: 1.35, spread: 1.15, tube: 0.085, taper: 0, blend: 0.08,
    bulb: 0.5, open: 0.85, spikes: 0, cup: 0.33, cupPos: 0.92, dish: 0, rimWave: 0,
  },
  molecule: {
    candle: "kronelys",
    symmetry: 5, mirror: 0,
    depth: 2, branches: 2, branchSpread: 0.6, length: 0.85, decay: 0.9,
    gravity: 0.65, outward: 0.95, curl: 0.15, wiggle: 0.18, loopiness: 0.2,
    rings: 0.15, crown: 0.15, levels: 1, shell: 0,
    height: 1.1, spread: 1.5, tube: 0.095, taper: 0.15, blend: 0.1,
    bulb: 1.2, open: 0, spikes: 0, cup: 0.34, cupPos: 0.95, dish: 0, rimWave: 0,
  },
}

export const FAMILIES = Object.keys(PRESETS)

/* ------------------------------------------------------------------ */
/* Seeded parameters                                                   */
/* ------------------------------------------------------------------ */

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 9000) + 1000
}

function snap(k: ParamKey, v: number): number {
  const r = PARAM_RANGES[k]
  let x = Math.min(r.max, Math.max(r.min, v))
  x = r.step >= 1 ? Math.round(x) : Math.round(x / r.step) * r.step
  return +x.toFixed(4)
}

/** a preset verbatim — the seed only drives the growth randomness */
export function genParams(seed: number, preset: string): HolderParams {
  const base = Object.prototype.hasOwnProperty.call(PRESETS, preset)
    ? PRESETS[preset]
    : PRESETS.bloom
  return { preset, seed, ...base }
}

/**
 * Shuffle: wander across the FULL range of every parameter, gently steered
 * toward the current preset so results stay in-character but surprising.
 */
export function randomizeParams(seed: number, preset: string): HolderParams {
  const rnd = mulberry32((seed * 2654435761 + 0x85ebca6b) >>> 0)
  const base = {
    ...(Object.prototype.hasOwnProperty.call(PRESETS, preset)
      ? PRESETS[preset]
      : PRESETS.bloom),
  }
  const WILD = 0.45 // 0 = preset only, 1 = uniform over the whole range
  for (const k of Object.keys(PARAM_RANGES) as ParamKey[]) {
    const r = PARAM_RANGES[k]
    const uniform = r.min + rnd() * (r.max - r.min)
    base[k] = snap(k, base[k] + (uniform - base[k]) * WILD)
  }
  // coherence: calm curves, crisp joints, one dominant structural motif —
  // a shuffle may surprise, but it must never stack every device at once.
  // The numbers come from batch curation: renders scored against the
  // reference photos, winners' parameter stats diffed against losers'.
  base.wiggle = Math.min(base.wiggle, 0.3)
  // dense growth needs slim tubes or everything fuses into a blob
  if (base.depth * base.branches >= 5) {
    base.tube = Math.min(base.tube, 0.105)
    base.loopiness = Math.min(base.loopiness, 0.55)
    base.rings = Math.min(base.rings, 0.35)
  }
  // crisp joints: cap blend against the FINAL tube, after density trims
  base.blend = Math.min(base.blend, base.tube)
  // a high symmetry order already fills the circle — pair it with extra
  // branches and the wall becomes a picket fence
  if (base.symmetry >= 9) base.branches = 1
  // airiness: what reads as "dense" is the rib count around the circle —
  // legs x branches, doubled again by almond loops. Thin the doubling
  // factors first, then the tube gauge, before ever touching symmetry.
  const ribs = () =>
    base.symmetry * base.branches * (1 + base.loopiness * 0.8)
  if (ribs() > 22) {
    base.loopiness = Math.max(
      0,
      (22 / (base.symmetry * base.branches) - 1) / 0.8,
    )
  }
  if (ribs() > 22) base.branches = 1
  if (base.symmetry >= 8 && base.depth >= 2) {
    base.tube = Math.min(base.tube, 0.095)
  }
  // corkscrewing arms read as tangles, not structure
  base.curl = Math.max(-0.4, Math.min(base.curl, 0.4))
  // keep the silhouette inside a graceful footprint: wide + flaring = sprawl
  if (base.spread * (1 + base.outward) > 2.4) {
    base.outward = Math.min(base.outward, 0.55)
    base.spread = Math.min(base.spread, 2.4 / (1 + base.outward))
  }
  // deep growth with long, barely-decaying arms on a wide base radiates
  // flat tentacles along the ground — bound the total arm reach instead
  if (base.depth >= 3) {
    const reach = base.length * (0.5 + base.decay) * base.spread
    if (reach > 1.55) base.length = 1.55 / ((0.5 + base.decay) * base.spread)
  }
  // a low, wide, long-armed build collapses into a flat web on the floor —
  // keep the silhouette's width-to-height ratio inside a vessel's
  const flat = (base.spread * Math.max(1, base.length)) / base.height
  if (flat > 1.5) {
    base.length = Math.min(
      base.length,
      Math.max(1, (1.5 * base.height) / base.spread),
    )
    if ((base.spread * Math.max(1, base.length)) / base.height > 1.5) {
      base.spread = (1.5 * base.height) / Math.max(1, base.length)
    }
  }
  if (base.shell > 0.25) {
    base.loopiness = Math.min(base.loopiness, 0.5)
    base.rings = Math.min(base.rings, 0.4)
    base.crown = Math.min(base.crown, 0.3)
    base.dish = Math.min(base.dish, 0.3)
  }
  // stacked levels fail most shuffles: only keep them for short, sparse,
  // calm builds — otherwise collapse to one level
  if (base.levels > 1) {
    const calm =
      base.height <= 1.35 &&
      base.depth <= 2 &&
      base.spikes <= 0.3 &&
      base.shell <= 0.25
    if (!calm) base.levels = 1
    base.crown = Math.min(base.crown, 0.4)
    base.dish = Math.min(base.dish, 0.3)
  }
  // studs are a committed choice, not an accident: weak rolls scatter
  // warty nubs over everything, so they snap to zero — a shuffle either
  // wears real urchin armor or none at all (and never on busy builds)
  if (base.spikes < 0.4 || base.depth * base.branches >= 5 || base.levels > 1)
    base.spikes = 0
  else base.spikes = Math.min(base.spikes, 0.7)
  // same for pearls: a faint bulb roll leaves toy-like knobs on tube ends
  if (base.bulb < 0.5) base.bulb = 0
  else base.bulb = Math.min(base.bulb, 0.9)
  // one top motif: a dish AND a crown stack into a jagged double rim
  if (base.dish >= 0.25 && base.crown >= 0.25) {
    if (base.dish >= base.crown) base.crown = 0.15
    else base.dish = 0.15
  }
  // the cup reads best riding high on the form, and visibly so
  base.cupPos = Math.max(base.cupPos, 0.7)
  if (base.cupPos < 0.75) base.dish = Math.min(base.dish, 0.2)
  // a squat melted puck helps nobody; neither does a leggy tower
  base.height = Math.max(0.85, Math.min(base.height, 2.1))
  // a tealight holder is a low object — cap its height
  if (base.candle === "telys") base.height = Math.min(base.height, 1.25)
  for (const k of [
    "wiggle", "blend", "tube", "curl", "outward", "spread", "length",
    "loopiness", "rings", "crown", "dish", "levels", "spikes", "bulb",
    "branches", "cupPos", "height",
  ] as ParamKey[]) {
    base[k] = snap(k, base[k])
  }
  return { preset, seed, ...base }
}

export const DEFAULT_SEED = 11
export const DEFAULT_PARAMS: HolderParams = genParams(DEFAULT_SEED, "bloom")

/* ------------------------------------------------------------------ */
/* SDF primitives                                                      */
/* ------------------------------------------------------------------ */

type V3 = [number, number, number]

type Sphere = { t: 1; x: number; y: number; z: number; r: number }
/** vertical rounded cylinder: half-height h, edge rounding rd */
type Cylinder = { t: 2; x: number; y: number; z: number; r: number; h: number; rd: number }
/** wavy drip dish: a thin cupped plate whose rim undulates VERTICALLY in
    petals (vamp) with a subtle radius scallop (amp) and upward curl */
type Dish = {
  t: 3
  y: number; r: number
  amp: number; vamp: number; waves: number; phase: number
  th: number; curve: number
}
/**
 * tube along a polyline with per-vertex radius: exact distance to the whole
 * path (hard min across segments) so a curved, tapering strut reads as one
 * clean tube with no joint bulges
 */
type Tube = { t: 4; segs: Float32Array; n: number; r: number }
/** axis-aligned ellipsoid of revolution (rx = rz), approximate SDF */
type Ellipsoid = { t: 5; x: number; y: number; z: number; rx: number; ry: number }

type Prim = Sphere | Cylinder | Dish | Tube | Ellipsoid

function sphere(c: V3, r: number): Sphere {
  return { t: 1, x: c[0], y: c[1], z: c[2], r }
}

/** pack a point path into a Tube prim (8 floats per segment, incl. radius) */
function tube(pts: V3[], r: number | number[]): Tube {
  const n = pts.length - 1
  const segs = new Float32Array(n * 8)
  let rmax = 0
  for (let i = 0; i < n; i++) {
    const a = pts[i]
    const b = pts[i + 1]
    const dx = b[0] - a[0]
    const dy = b[1] - a[1]
    const dz = b[2] - a[2]
    const l2 = dx * dx + dy * dy + dz * dz
    const ri = typeof r === "number" ? r : (r[i] + r[i + 1]) / 2
    rmax = Math.max(rmax, ri)
    const o = i * 8
    segs[o] = a[0]
    segs[o + 1] = a[1]
    segs[o + 2] = a[2]
    segs[o + 3] = dx
    segs[o + 4] = dy
    segs[o + 5] = dz
    segs[o + 6] = l2 > 1e-12 ? 1 / l2 : 0
    segs[o + 7] = ri
  }
  return { t: 4, segs, n, r: rmax }
}

function evalPrim(p: Prim, x: number, y: number, z: number): number {
  switch (p.t) {
    case 1: {
      const px = x - p.x
      const py = y - p.y
      const pz = z - p.z
      return Math.sqrt(px * px + py * py + pz * pz) - p.r
    }
    case 2: {
      const px = x - p.x
      const pz = z - p.z
      const dr = Math.sqrt(px * px + pz * pz) - p.r + p.rd
      const dy = Math.abs(y - p.y) - p.h + p.rd
      const mx = dr > dy ? dr : dy
      const ox = dr > 0 ? dr : 0
      const oy = dy > 0 ? dy : 0
      return (mx < 0 ? mx : Math.sqrt(ox * ox + oy * oy)) - p.rd
    }
    case 3: {
      const q = Math.sqrt(x * x + z * z)
      const ang = Math.atan2(z, x)
      const rim = p.r * (1 + p.amp * Math.sin(p.waves * ang + p.phase))
      const nq = q / p.r
      // petals: the rim undulates vertically, growing toward the edge
      const surf =
        p.y +
        p.curve * nq * nq * p.r +
        p.vamp * Math.sin(p.waves * ang + p.phase) * nq * nq * nq
      const dv = Math.abs(y - surf) - p.th
      const dr = q - rim
      const mx = dv > dr ? dv : dr
      const ov = dv > 0 ? dv : 0
      const orr = dr > 0 ? dr : 0
      return (mx < 0 ? mx : Math.sqrt(ov * ov + orr * orr)) - p.th * 0.5
    }
    case 4: {
      const s = p.segs
      let best = Infinity
      for (let i = 0, o = 0; i < p.n; i++, o += 8) {
        const px = x - s[o]
        const py = y - s[o + 1]
        const pz = z - s[o + 2]
        const dx = s[o + 3]
        const dy = s[o + 4]
        const dz = s[o + 5]
        let h = (px * dx + py * dy + pz * dz) * s[o + 6]
        h = h < 0 ? 0 : h > 1 ? 1 : h
        const qx = px - dx * h
        const qy = py - dy * h
        const qz = pz - dz * h
        const d = Math.sqrt(qx * qx + qy * qy + qz * qz) - s[o + 7]
        if (d < best) best = d
      }
      return best
    }
    case 5: {
      const px = (x - p.x) / p.rx
      const py = (y - p.y) / p.ry
      const pz = (z - p.z) / p.rx
      const k = Math.sqrt(px * px + py * py + pz * pz)
      return (k - 1) * Math.min(p.rx, p.ry)
    }
  }
}

/** conservative bounding sphere per primitive, for early-out rejection */
function primBound(p: Prim): { x: number; y: number; z: number; br: number } {
  switch (p.t) {
    case 1:
      return { x: p.x, y: p.y, z: p.z, br: p.r }
    case 2:
      return { x: p.x, y: p.y, z: p.z, br: Math.sqrt(p.r * p.r + p.h * p.h) + p.rd }
    case 3: {
      const rmax = p.r * (1 + p.amp)
      // the plate curls up as curve·(q/r)² — at the wavy rim q can reach
      // rmax, so bound the lift there or the dish gets clipped by the grid
      const lift =
        (Math.abs(p.curve) * rmax * rmax) / p.r + Math.abs(p.vamp) * 1.3
      const ymax = lift + p.th * 2
      return {
        x: 0,
        y: p.y + ymax / 2,
        z: 0,
        br: Math.sqrt(rmax * rmax + ymax * ymax) + p.th + Math.abs(p.vamp),
      }
    }
    case 4: {
      let x0 = Infinity, y0 = Infinity, z0 = Infinity
      let x1 = -Infinity, y1 = -Infinity, z1 = -Infinity
      const s = p.segs
      for (let i = 0, o = 0; i < p.n; i++, o += 8) {
        for (const [px, py, pz] of [
          [s[o], s[o + 1], s[o + 2]],
          [s[o] + s[o + 3], s[o + 1] + s[o + 4], s[o + 2] + s[o + 5]],
        ]) {
          x0 = Math.min(x0, px); x1 = Math.max(x1, px)
          y0 = Math.min(y0, py); y1 = Math.max(y1, py)
          z0 = Math.min(z0, pz); z1 = Math.max(z1, pz)
        }
      }
      const cx = (x0 + x1) / 2
      const cy = (y0 + y1) / 2
      const cz = (z0 + z1) / 2
      const br = Math.hypot(x1 - cx, y1 - cy, z1 - cz) + p.r
      return { x: cx, y: cy, z: cz, br }
    }
    case 5:
      return { x: p.x, y: p.y, z: p.z, br: Math.max(p.rx, p.ry) }
  }
}

function smin(a: number, b: number, k: number): number {
  const h = Math.max(k - Math.abs(a - b), 0) / k
  return Math.min(a, b) - h * h * k * 0.25
}

/** shift a primitive vertically */
function translatePrimY(p: Prim, dy: number): Prim {
  switch (p.t) {
    case 1:
    case 2:
    case 3:
      return { ...p, y: p.y + dy }
    case 4: {
      const segs = new Float32Array(p.segs)
      for (let o = 1; o < segs.length; o += 8) segs[o] += dy
      return { ...p, segs }
    }
    case 5:
      return { ...p, y: p.y + dy }
  }
}

/** rotate a primitive around the Y axis */
function rotatePrim(p: Prim, a: number): Prim {
  const c = Math.cos(a)
  const s = Math.sin(a)
  const rx = (x: number, z: number): [number, number] => [x * c - z * s, x * s + z * c]
  switch (p.t) {
    case 1: {
      const [x, z] = rx(p.x, p.z)
      return { ...p, x, z }
    }
    case 2: {
      const [x, z] = rx(p.x, p.z)
      return { ...p, x, z }
    }
    case 3:
      return { ...p, phase: p.phase - p.waves * a }
    case 4: {
      const segs = new Float32Array(p.segs)
      for (let o = 0; o < segs.length; o += 8) {
        const [ax, az] = rx(segs[o], segs[o + 2])
        const [dx, dz] = rx(segs[o + 3], segs[o + 5])
        segs[o] = ax
        segs[o + 2] = az
        segs[o + 3] = dx
        segs[o + 5] = dz
      }
      return { ...p, segs }
    }
    case 5:
      return p
  }
}

/**
 * The symmetry fold evaluates each sample against three neighboring wedge
 * copies, which is only exact for primitives staying within ±½ sector of
 * their wedge. Wider primitives (spiraling limbs, long loop connectors)
 * would get sliced at the fold horizon — so they are replicated explicitly
 * instead and moved to the central list.
 */
function explodeWidePrims(sk: Skeleton, n: number, sector: number, mirror: boolean) {
  const m = sector / 2
  // safe iff the prim stays within one sector of the wedge center — then
  // every sample's three fold candidates cover all copies that matter
  const limit = sector * 1.02
  const wrapPi = (a: number) => {
    while (a > Math.PI) a -= Math.PI * 2
    while (a < -Math.PI) a += Math.PI * 2
    return a
  }
  const wide = (p: Prim): boolean => {
    if (p.t === 1 || p.t === 5) {
      // point prims still have an angular POSITION (plus width from their
      // radius): a bulb parked past the fold horizon would be sliced too
      const d = Math.hypot(p.x, p.z)
      if (d < 0.15) return false
      const r = p.t === 1 ? p.r : p.rx
      const half = Math.asin(Math.min(1, r / d))
      return Math.abs(wrapPi(Math.atan2(p.z, p.x) - m)) + half > limit
    }
    if (p.t !== 4) return false // central cylinders/dishes have no span
    const s = p.segs
    let cum = Number.NaN
    let prevRaw = 0
    let lo = 0
    let hi = 0
    for (let i = 0; i <= p.n; i++) {
      const o = Math.min(i, p.n - 1) * 8
      const last = i === p.n
      const x = last ? s[o] + s[o + 3] : s[o]
      const z = last ? s[o + 2] + s[o + 5] : s[o + 2]
      if (Math.hypot(x, z) < 0.15) continue // near-axis points bind to no wedge
      const raw = Math.atan2(z, x)
      if (Number.isNaN(cum)) {
        cum = wrapPi(raw - m)
        prevRaw = raw
        lo = hi = cum
        continue
      }
      // continuous paths step by small angles — unwrap via the previous point
      cum += wrapPi(raw - prevRaw)
      prevRaw = raw
      lo = Math.min(lo, cum)
      hi = Math.max(hi, cum)
    }
    return hi > limit || lo < -limit
  }

  // reflect across the wedge center plane θ = sector/2 — the same mirror
  // the dihedral fold applies, so exploded prims keep their mirror twins
  const reflectPrim = (p: Prim): Prim => {
    const c = Math.cos(sector)
    const sn = Math.sin(sector)
    const rx = (x: number, z: number): [number, number] => [
      x * c + z * sn,
      x * sn - z * c,
    ]
    switch (p.t) {
      case 1:
      case 5: {
        const [x, z] = rx(p.x, p.z)
        return { ...p, x, z }
      }
      case 2: {
        const [x, z] = rx(p.x, p.z)
        return { ...p, x, z }
      }
      case 4: {
        const segs = new Float32Array(p.segs)
        for (let i = 0; i < p.n; i++) {
          const o = i * 8
          const [ax, az] = rx(segs[o], segs[o + 2])
          const [dx, dz] = rx(segs[o + 3], segs[o + 5])
          segs[o] = ax
          segs[o + 2] = az
          segs[o + 3] = dx
          segs[o + 5] = dz
        }
        return { ...p, segs }
      }
      case 3:
        return p
    }
  }

  for (const [list, neg] of [
    [sk.wedge, false],
    [sk.wedgeNeg, true],
  ] as const) {
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i]
      if (!wide(p)) continue
      list.splice(i, 1)
      const target = neg ? sk.centralNeg : sk.central
      for (let k = 0; k < n; k++) {
        target.push(rotatePrim(p, k * sector))
        if (mirror) target.push(rotatePrim(reflectPrim(p), k * sector))
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/* Growth                                                              */
/* ------------------------------------------------------------------ */

const pol = (r: number, a: number, y: number): V3 => [
  Math.cos(a) * r,
  y,
  Math.sin(a) * r,
]

/** sample a quadratic bezier a→b (control c), including b, excluding a */
function bez(a: V3, c: V3, b: V3, segs = 10): V3[] {
  const out: V3[] = []
  for (let i = 1; i <= segs; i++) {
    const t = i / segs
    const u = 1 - t
    out.push([
      u * u * a[0] + 2 * u * t * c[0] + t * t * b[0],
      u * u * a[1] + 2 * u * t * c[1] + t * t * b[1],
      u * u * a[2] + 2 * u * t * c[2] + t * t * b[2],
    ])
  }
  return out
}

type Skeleton = {
  central: Prim[]
  centralNeg: Prim[]
  wedge: Prim[]
  wedgeNeg: Prim[]
}

/** open tube mouth: bulge the tip into a lip, then bore it out along `dir` */
function openTip(sk: Skeleton, tip: V3, dir: V3, tubeR: number, open: number) {
  const dl = Math.hypot(dir[0], dir[1], dir[2]) || 1
  const nx = dir[0] / dl
  const ny = dir[1] / dl
  const nz = dir[2] / dl
  // flared lip: a swelling bead behind a wider mouth bead
  sk.wedge.push(
    sphere([tip[0] - nx * tubeR, tip[1] - ny * tubeR, tip[2] - nz * tubeR], tubeR * 1.12),
  )
  sk.wedge.push(sphere(tip, tubeR * 1.32))
  const boreR = tubeR * (0.4 + 0.36 * open)
  const back = tubeR * 0.9
  sk.wedgeNeg.push(
    tube(
      [
        [tip[0] - nx * back, tip[1] - ny * back, tip[2] - nz * back],
        [tip[0] + nx * tubeR * 2.4, tip[1] + ny * tubeR * 2.4, tip[2] + nz * tubeR * 2.4],
      ],
      boreR,
    ),
  )
}

const norm = (v: V3): V3 => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1
  return [v[0] / l, v[1] / l, v[2] / l]
}
const rotY = (v: V3, a: number): V3 => {
  const c = Math.cos(a)
  const s = Math.sin(a)
  return [v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c]
}

function buildSkeleton(p: HolderParams): Skeleton {
  const sk: Skeleton = { central: [], centralNeg: [], wedge: [], wedgeNeg: [] }
  const rnd = mulberry32((p.seed ^ 0x9e3779b9) >>> 0)
  const jr = (amt: number) => (rnd() * 2 - 1) * amt

  const n = Math.round(p.symmetry)
  const s = (Math.PI * 2) / n
  const m = s / 2
  const R = p.spread
  const H = p.height
  const yTop = H / 2
  const yBot = -H / 2
  const r0 = p.tube

  /* ---- the candle interface: cup, socket, optional drip dish ----
     socket dimensions are real: the chosen candle must drop in and hold */
  const spec = Object.prototype.hasOwnProperty.call(CANDLE_SPECS, p.candle)
    ? CANDLE_SPECS[p.candle]
    : CANDLE_SPECS.kronelys
  const minWall = 4 / MM_PER_UNIT
  const cupR = Math.max(p.cup, spec.socketR + minWall)
  const cupH = spec.cupHalfH
  // clamped so the cup BOTTOM never sinks below the ground plane on
  // short bodies — the piece must stand on its feet, not its cup
  const cupY = Math.max(
    Math.min(yBot + p.cupPos * H, yTop - cupH * 0.5),
    yBot + cupH,
  )
  sk.central.push({ t: 2, x: 0, y: cupY, z: 0, r: cupR, h: cupH, rd: r0 * 0.45 })
  // bore from the cup mouth down, leaving a floor under the candle
  const sockD = Math.min(spec.socketDepth, cupH * 2 - 2.5 / MM_PER_UNIT)
  sk.centralNeg.push({
    t: 2,
    x: 0,
    y: cupY + cupH + 0.06 - sockD / 2,
    z: 0,
    r: spec.socketR,
    h: sockD / 2 + 0.06,
    rd: 0.03,
  })
  // nothing may roof the flame: an open chimney is carved from just above
  // the cup mouth to beyond the tallest possible stack, as physically real
  // as the socket itself. It starts 2 mm above the rim so the cup mouth
  // keeps its full wall, and clears Ø45 mm over a tealight / Ø25 mm along
  // a taper's body.
  const flameR = spec.socketR * 1.1
  const flameY0 = cupY + cupH + 0.04
  const flameY1 = yTop + H * 3 + 1.5
  sk.centralNeg.push({
    t: 2,
    x: 0,
    y: (flameY0 + flameY1) / 2,
    z: 0,
    r: flameR,
    h: (flameY1 - flameY0) / 2,
    rd: 0.05,
  })
  let dishBore: { er: number; hy: number; rHole: number } | null = null
  if (p.dish > 0.02) {
    // the dish is a thin cupped plate whose rim curls into petals — one
    // leaf per symmetry wedge (low orders get a doubled count so a 3-fold
    // dish still reads as a flower, not a saddle), aligned to wedge centers
    const waves = n < 5 ? n * 2 : n
    const dishR = cupR * 1.2 + p.dish * (R * 0.75 - cupR)
    sk.central.push({
      t: 3,
      y: cupY + cupH * 0.62,
      r: dishR,
      amp: 0.025 + p.rimWave * 0.03,
      vamp: (0.05 + p.rimWave * 0.14) * dishR,
      waves,
      phase: Math.PI / 2 - waves * m,
      th: 0.062,
      curve: 0.18 + p.rimWave * 0.1,
    })
    // pierced petals, like the reference ruffle: with an open growth
    // character each wedge's annulus gets a cutout between cup and rim
    // (queued here, pushed after level stacking so copies stay unpierced).
    // The bore must only ever pierce the PLATE: it sits in the petal
    // valley (wedge boundary, away from the legs at wedge centers), stays
    // small, hugs the plate vertically, and is skipped entirely whenever a
    // crown ring, extra branches or a wide fan could cross it — severing
    // structure would disconnect the piece.
    if (
      p.open > 0.25 &&
      dishR - cupR > 0.26 &&
      p.crown <= 0.03 &&
      Math.round(p.branches) <= 2 &&
      p.branchSpread <= 0.6
    ) {
      const rHole = Math.min(
        (dishR - cupR) * 0.26,
        dishR * Math.sin(s / 2) * 0.4,
        0.11,
      )
      const er = Math.max(cupR * 1.08 + rHole, cupR + (dishR - cupR) * 0.45)
      if (rHole > 0.035 && er + rHole < dishR * 0.82) {
        dishBore = { er, hy: cupY + cupH * 0.62, rHole }
      }
    }
  }

  // the candle interface stays unique when the body is stacked in levels
  const cupPrims = sk.central.length
  const cupNegPrims = sk.centralNeg.length

  // conical stud pointing along dir — sea-urchin armor
  const spike = (base: V3, dir: V3, len: number, baseR: number) => {
    const dl = Math.hypot(dir[0], dir[1], dir[2]) || 1
    const tip: V3 = [
      base[0] + (dir[0] / dl) * len,
      base[1] + (dir[1] / dl) * len,
      base[2] + (dir[2] / dl) * len,
    ]
    const mid: V3 = [
      (base[0] + tip[0]) / 2,
      (base[1] + tip[1]) / 2,
      (base[2] + tip[2]) / 2,
    ]
    sk.wedge.push(tube([base, mid, tip], [baseR, baseR * 0.55, baseR * 0.12]))
  }

  // a tip can close a ring to its own symmetry copies: with n-fold
  // replication one arc per wedge becomes a full circle
  const ringTo = (end: V3, rr: number) => {
    const er = Math.hypot(end[0], end[2])
    if (er < 0.15) return
    const a0 = Math.atan2(end[2], end[0])
    const pts: V3[] = []
    for (let i = 0; i <= 6; i++) {
      pts.push(pol(er, a0 - s / 2 + (s * i) / 6, end[1]))
    }
    sk.wedge.push(tube(pts, rr))
    // studded rings: alternating out-up / out-down spikes
    if (p.spikes > 0.05) {
      const len = r0 * (1.6 + 2.6 * p.spikes)
      for (const [da, up] of [
        [-s * 0.25, 0.55],
        [s * 0.25, -0.25],
      ] as const) {
        const b = pol(er, a0 + da, end[1])
        spike(b, [b[0], up * er, b[2]], len, rr * 1.25)
      }
    }
  }

  // bowed connector between two skeleton points (used for apex knots)
  const closeLoop = (a: V3, b: V3, rr: number, awayFrom?: V3) => {
    const dch = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2])
    const mid: V3 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]
    let ctrl: V3
    if (awayFrom) {
      let px = -(b[2] - a[2])
      let pz = b[0] - a[0]
      const pl = Math.hypot(px, pz) || 1
      px /= pl
      pz /= pl
      if (px * (mid[0] - awayFrom[0]) + pz * (mid[2] - awayFrom[2]) < 0) {
        px = -px
        pz = -pz
      }
      const push = Math.max(dch * 0.5, rr * 6)
      ctrl = [mid[0] + px * push, mid[1] + jr(0.03), mid[2] + pz * push]
    } else {
      const mr = Math.hypot(mid[0], mid[2]) || 1
      const bow = dch * 0.36
      ctrl = [
        mid[0] + (mid[0] / mr) * bow,
        mid[1] - p.gravity * dch * 0.3 + jr(0.04),
        mid[2] + (mid[2] / mr) * bow,
      ]
    }
    sk.wedge.push(tube([a, ...bez(a, ctrl, b, 10)], rr))
  }

  /* ---- crown: a ring around the cup mouth that limbs grow from ---- */
  let seedR = cupR * 0.9
  let seedY = cupY - cupH * 0.4
  if (p.crown > 0.03) {
    const crownR = cupR + r0 * 2 + p.crown * (R * 0.8 - cupR - r0 * 2)
    const yC = cupY + cupH * 0.2
    ringTo(pol(crownR, m - s / 2, yC), r0)
    sk.wedge.push(tube([pol(cupR * 0.85, m, yC), pol(crownR, m, yC)], r0 * 0.95))
    if (p.open > 0.05 && crownR - cupR > r0 * 1.5) {
      const b = m + s / 2
      const corner = pol(crownR, b, yC)
      sk.wedge.push(sphere(corner, r0 * 1.3))
      // the bore stays outside the cup wall — a collapsed crown must
      // never let it drill toward the socket
      const boreIn = Math.max(crownR - r0 * 2.4, cupR + r0 * 0.6)
      sk.wedgeNeg.push(
        tube(
          [pol(boreIn, b, yC), pol(crownR + r0 * 2.4, b, yC)],
          r0 * (0.38 + 0.34 * p.open),
        ),
      )
    }
    seedR = crownR
    seedY = yC - r0 * 0.4
  }

  /* ---- structured growth: tiers of clean arcs inside the wedge ----
     Randomness decides LAYOUT (where limbs go, which fate each tip gets);
     the curves themselves are always clean single-bow arcs, so every
     output reads as bent porcelain tube, never as a melted random walk. */

  // a clean arc from a to b: one outward/tangential/vertical bow plus an
  // optional subtle ripple — never a random kink
  const arc = (
    a: V3,
    b: V3,
    bowOut: number,
    bowTan: number,
    bowUp: number,
    rr: number,
  ): V3[] => {
    const mid: V3 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]
    const mr = Math.hypot(mid[0], mid[2]) || 1
    const ox = mid[0] / mr
    const oz = mid[2] / mr
    const ctrl: V3 = [
      mid[0] + ox * bowOut - oz * bowTan,
      mid[1] + bowUp,
      mid[2] + oz * bowOut + ox * bowTan,
    ]
    const pts: V3[] = [a, ...bez(a, ctrl, b, 14)]
    if (p.wiggle > 0.02) {
      // deterministic ripple along the arc, radial, fading at the ends
      const amp = p.wiggle * rr * 1.6
      for (let i = 1; i < pts.length - 1; i++) {
        const t = i / (pts.length - 1)
        const q = Math.hypot(pts[i][0], pts[i][2]) || 1
        const rip = Math.sin(t * Math.PI * 3) * Math.sin(t * Math.PI) * amp
        pts[i] = [
          pts[i][0] + (pts[i][0] / q) * rip,
          pts[i][1],
          pts[i][2] + (pts[i][2] / q) * rip,
        ]
      }
    }
    return pts
  }

  const lift = p.gravity < -0.3 // negative gravity: limbs rise instead
  const tiers = Math.round(p.depth)
  const arms = Math.round(p.branches)
  const rTip = Math.max(0.05, r0 * (1 - p.taper * 0.6))
  const chordBow = (c: number) => c * (0.22 + 0.38 * p.outward)

  // the lattice hangs from a hub on a short stem under the cup (a crown
  // replaces the hub as the attachment when present); the stem cap must
  // stay above the ground plane so the piece stands on its feet
  const hubY = Math.max(
    p.crown > 0.03 ? seedY : seedY - Math.max(0.14, (seedY - yBot) * 0.16),
    yBot + r0 * 1.2,
  )
  if (p.crown <= 0.03) {
    // conical stem: swallows the candle collar and tapers to tube gauge,
    // so nothing under the dish reads as a bare block
    if (p.dish > 0.02) {
      // trumpet: a bell skirt flowing from the dish underside over the
      // candle collar and tapering into the stem — no exposed block
      sk.central.push(
        tube(
          [
            [0, cupY + cupH * 0.25, 0],
            [0, cupY - cupH * 0.55, 0],
            [0, (cupY + hubY) / 2 - cupH * 0.3, 0],
            [0, hubY, 0],
          ],
          [cupR * 1.06, cupR * 0.85, (cupR + r0) * 0.38, r0 * 0.95],
        ),
      )
    } else {
      sk.central.push(
        tube(
          [
            [0, cupY - cupH * 0.2, 0],
            [0, (cupY + hubY) / 2, 0],
            [0, hubY, 0],
          ],
          [r0 * 1.1, r0, r0 * 0.95],
        ),
      )
    }
  }
  const hubR = p.crown > 0.03 ? seedR : r0 * 0.9

  // feet land on a ground ring (or a sky ring when lifting — which must
  // clear the flame chimney, or the whole ring would be carved away)
  let fR = R * (0.62 + 0.3 * p.outward) * Math.min(1.3, p.length)
  if (lift) fR = Math.max(fR, flameR + r0 * 2.2)
  const yFoot = lift ? yTop - r0 * 1.5 : yBot + r0
  const anchors: V3[] = [[0, yTop - r0 * 1.5, 0]]

  /* tier 0 — legs: planar vertical almond loops or single arcs, hub → foot.
     The two arcs of a loop live in the SAME radial plane with different
     outward bows, so every loop reads edge-on clean from other angles. */
  for (let k = 0; k < arms; k++) {
    const off = arms > 1 ? (k - (arms - 1) / 2) * p.branchSpread * s * 0.8 : 0
    const a0 = m + off
    const seed = pol(hubR, a0, hubY)
    const fa = a0 + p.curl * s * 0.6
    const foot = pol(fR, fa, yFoot)
    const chord = Math.hypot(foot[0] - seed[0], foot[1] - seed[1], foot[2] - seed[2])
    const sag = -p.gravity * chord * 0.18
    anchors.push(foot)
    if (rnd() < p.loopiness) {
      // almond loop: the two arcs bow along the TRUE perpendicular of the
      // chord within its radial plane (cross product), so the eye always
      // opens — steep legs open radially, flat petals open vertically —
      // plus a tangential widening for flat petals
      const dhx = (foot[0] - seed[0]) / (chord || 1)
      const dhy = (foot[1] - seed[1]) / (chord || 1)
      const dhz = (foot[2] - seed[2]) / (chord || 1)
      const mx = (seed[0] + foot[0]) / 2
      const mz = (seed[2] + foot[2]) / 2
      const mr = Math.hypot(mx, mz) || 1
      const rhx = mx / mr
      const rhz = mz / mr
      const thx = -rhz
      const thz = rhx
      // perp = chord x tangent, normalized
      let px = dhy * thz
      let py = dhz * thx - dhx * thz
      let pz = -dhy * thx
      const pl = Math.hypot(px, py, pz) || 1
      px /= pl
      py /= pl
      pz /= pl
      // orient the eye outward/upward
      if (px * rhx + pz * rhz + py * 0.5 < 0) {
        px = -px
        py = -py
        pz = -pz
      }
      const so = Math.max(chord * (0.18 + 0.3 * p.branchSpread), r0 * 4.5)
      const flat = 1 - Math.min(1, Math.abs(dhy) * 1.4)
      const ox = px * so + thx * so * 0.4 * flat
      const oy = py * so
      const oz = pz * so + thz * so * 0.4 * flat
      const bowO = ox * rhx + oz * rhz
      const bowT = ox * thx + oz * thz
      const cb = chordBow(chord) * 0.6
      sk.wedge.push(tube(arc(seed, foot, cb + bowO, bowT, sag + oy, r0), r0))
      sk.wedge.push(tube(arc(seed, foot, cb - bowO, -bowT, sag * 0.7 - oy, r0), r0))
    } else {
      sk.wedge.push(tube(arc(seed, foot, chordBow(chord), 0, sag, r0), r0))
    }
    // the foot: an open mouth angled into the ground, a pearl, or bare
    if (p.open > 0.05 && rnd() < p.open) {
      openTip(
        sk,
        foot,
        lift ? [foot[0] * 0.45, 1.15, foot[2] * 0.45] : [foot[0] * 0.55, -0.75, foot[2] * 0.55],
        r0,
        p.open,
      )
    } else if (p.spikes > 0.05 && rnd() < p.spikes) {
      spike(foot, [foot[0], 0.35, foot[2]], r0 * (1.6 + 2.4 * p.spikes), r0 * 1.2)
    } else if (rnd() < p.bulb * 0.6) {
      sk.wedge.push(sphere(foot, r0 * (1.2 + p.bulb * 0.5)))
    }
    if (rnd() < p.rings * 0.7) ringTo(foot, r0 * 0.9)
    if (lift && rnd() < p.loopiness * 0.8) {
      // rising limbs close onto an apex knot — but the flame chimney owns
      // the axis above the cup mouth, so up there they land on a collar
      // ring around the chimney instead of a point the carve would sever
      const yApex = yTop - r0
      if (yApex > flameY0 - rTip) {
        const apex = pol(flameR + rTip * 1.6, fa, Math.max(yApex, flameY0 + rTip))
        closeLoop(foot, apex, rTip, undefined)
        if (k === 0) ringTo(apex, rTip)
      } else {
        closeLoop(foot, [0, yApex, 0], rTip, undefined)
      }
    }
  }

  /* tier 1 — arches: foot-to-foot arcs between neighboring wedges; their
     apex at the wedge boundary is the crossing point later tiers build on */
  let archApex: V3 | null = null
  if (tiers >= 2 && !lift) {
    const fa = m + p.curl * s * 0.6
    const foot = pol(fR, fa, yFoot)
    const next = pol(fR, fa + s, yFoot)
    const span = Math.hypot(next[0] - foot[0], next[2] - foot[2])
    const hUp = span * (0.16 + 0.18 * p.decay)
    const bowOut = span * 0.1
    sk.wedge.push(tube(arc(foot, next, bowOut, 0, hUp, rTip), rTip))
    // quadratic apex sits halfway toward the control point
    archApex = pol(
      fR * Math.cos(s / 2) + bowOut * 0.5,
      fa + s / 2,
      yFoot + hUp * 0.5,
    )
  }

  /* tier 2 — side arms: flared mouths growing out of the arch crossings */
  if (tiers >= 3) {
    const b = m + s / 2 + p.curl * s * 0.6
    const base = archApex ?? pol(Math.max(hubR, fR * 0.4), b, (hubY + yFoot) / 2)
    const armL = R * 0.3 * (0.6 + 0.8 * p.decay)
    const tip: V3 = [
      base[0] + (base[0] / (Math.hypot(base[0], base[2]) || 1)) * armL,
      base[1] + armL * 0.25,
      base[2] + (base[2] / (Math.hypot(base[0], base[2]) || 1)) * armL,
    ]
    sk.wedge.push(tube(arc(base, tip, 0, 0, -armL * 0.15, rTip), rTip))
    if (p.open > 0.05 && rnd() < Math.max(0.5, p.open)) {
      openTip(sk, tip, [tip[0], 0.2, tip[2]], rTip, p.open)
    } else {
      sk.wedge.push(sphere(tip, rTip * (1.1 + p.bulb * 0.5)))
    }
    if (rnd() < p.rings * 0.5) ringTo(tip, rTip * 0.85)
  }

  /* tier 3 — crest: short nubs rising past the cup rim */
  if (tiers >= 4) {
    const base = pol(seedR * 0.95, m + s / 2, seedY + cupH)
    const tip2: V3 = [base[0] * 1.25, seedY + cupH + r0 * 2.8, base[2] * 1.25]
    sk.wedge.push(tube([base, tip2], rTip * 0.9))
    if (rnd() < p.bulb * 0.7) sk.wedge.push(sphere(tip2, rTip * (1.15 + p.bulb * 0.45)))
    else if (p.open > 0.05 && rnd() < p.open) openTip(sk, tip2, [tip2[0] * 0.4, 1, tip2[2] * 0.4], rTip * 0.9, p.open)
  }

  /* ---- optional shell: a hollow skin grown around the body ----
     below 0.25 a shell is only fragments between its windows, so it is
     treated as absent rather than producing broken-eggshell debris */
  if (p.shell > 0.25) {
    const wall = r0 * 1.7
    const rx = R * 0.8
    const yLo = yBot + r0
    const yHi = cupY + cupH * 0.5
    const cy = (yLo + yHi) / 2
    const ry = (yHi - yLo) / 2 + wall
    sk.central.push({ t: 5, x: 0, y: cy, z: 0, rx, ry })
    sk.centralNeg.push({ t: 5, x: 0, y: cy, z: 0, rx: rx - wall, ry: ry - wall })
    // one window per wedge, shrinking as the shell closes up
    const winW = rx * s * (0.36 - 0.24 * p.shell)
    if (winW > wall * 0.4) {
      sk.wedgeNeg.push(
        tube(
          [pol(rx * 0.94, m, cy - ry * 0.35), pol(rx * 0.94, m, cy + ry * 0.3)],
          winW,
        ),
      )
    }
    // punch holes through the ribs between the windows
    if (p.open > 0.05) {
      const b = m + s / 2
      const punchR = r0 * (0.55 + 0.45 * p.open)
      sk.wedgeNeg.push(tube([pol(rx * 0.2, b, cy - ry * 0.55), pol(rx * 1.3, b, cy - ry * 0.48)], punchR))
      sk.wedgeNeg.push(tube([pol(rx * 0.15, b, cy + ry * 0.5), pol(rx * 1.25, b, cy + ry * 0.58)], punchR * 0.7))
    }
    // studded armor: two rows of conical spikes on the shell
    if (p.spikes > 0.05) {
      const len = Math.max(r0 * 2.2, rx * 0.34 * p.spikes)
      for (const [da, t] of [
        [0, 0.25],
        [s * 0.5, 0.68],
      ] as const) {
        // point on the ellipsoid at height parameter t, angle m+da
        const py = cy + ry * t * 0.9
        const pr = rx * Math.sqrt(Math.max(0.05, 1 - t * t))
        const b2 = pol(pr * 0.9, m + da, py)
        spike(b2, [b2[0], t * rx * 1.6, b2[2]], len, r0 * 1.8)
      }
    }
  }

  /* ---- levels: stack the grown body into a staggered tower ---- */
  const L = Math.round(p.levels)
  if (L > 1) {
    const dy = H * 0.84
    const baseW = sk.wedge.slice()
    const baseWN = sk.wedgeNeg.slice()
    const baseC = sk.central.slice(cupPrims)
    const baseCN = sk.centralNeg.slice(cupNegPrims)
    // the lowest and highest off-axis anchors weld consecutive levels
    // (any true off-axis point counts — a narrow foot ring must still weld)
    let lowA: V3 | null = null
    let highA: V3 | null = null
    for (const a of anchors) {
      if (Math.hypot(a[0], a[2]) < 0.05) continue
      if (!lowA || a[1] < lowA[1]) lowA = a
      if (!highA || a[1] > highA[1]) highA = a
    }
    for (let k = 1; k < L; k++) {
      const rot = (k % 2) * s * 0.5
      const rotPrev = ((k - 1) % 2) * s * 0.5
      for (const prim of baseW)
        sk.wedge.push(translatePrimY(rotatePrim(prim, rot), -dy * k))
      for (const prim of baseWN)
        sk.wedgeNeg.push(translatePrimY(rotatePrim(prim, rot), -dy * k))
      for (const prim of baseC)
        sk.central.push(translatePrimY(rotatePrim(prim, rot), -dy * k))
      for (const prim of baseCN)
        sk.centralNeg.push(translatePrimY(rotatePrim(prim, rot), -dy * k))
      // guaranteed weld: a strut from the level above's foot anchor down
      // to the level below's crown anchor
      if (lowA && highA) {
        const a = rotY(lowA, rotPrev)
        const b = rotY(highA, rot)
        sk.wedge.push(
          tube(
            [
              [a[0], a[1] - dy * (k - 1), a[2]],
              [b[0], b[1] - dy * k, b[2]],
            ],
            r0 * 0.95,
          ),
        )
      }
    }
  }

  // the dish cutouts pierce only the true dish, never level copies —
  // in the petal valley at the wedge boundary, clear of the legs
  if (dishBore) {
    sk.wedgeNeg.push(
      tube(
        [
          pol(dishBore.er, m + s / 2, dishBore.hy - 0.16),
          pol(dishBore.er, m + s / 2, dishBore.hy + 0.2),
        ],
        dishBore.rHole,
      ),
    )
  }

  // anything reaching beyond the safe folding window gets replicated
  // explicitly so it can never be sliced at the fold horizon
  explodeWidePrims(sk, n, s, p.mirror >= 0.5)

  return sk
}

/* ------------------------------------------------------------------ */
/* Field evaluation with symmetry-group folding                        */
/* ------------------------------------------------------------------ */

type BoundedPrim = { prim: Prim; bx: number; by: number; bz: number; br: number }

function withBounds(prims: Prim[]): BoundedPrim[] {
  return prims.map((prim) => {
    const b = primBound(prim)
    return { prim, bx: b.x, by: b.y, bz: b.z, br: b.br }
  })
}

export type Field = {
  eval: (x: number, y: number, z: number) => number
  bounds: { min: V3; max: V3 }
}

export function makeField(p: HolderParams): Field {
  const sk = buildSkeleton(p)
  const central = withBounds(sk.central)
  const centralNeg = withBounds(sk.centralNeg)
  const wedge = withBounds(sk.wedge)
  const wedgeNeg = withBounds(sk.wedgeNeg)

  const n = Math.round(p.symmetry)
  const sector = (Math.PI * 2) / n
  const mirror = p.mirror >= 0.5
  const k = p.blend
  const kNeg = Math.min(0.05, k * 0.5) + 0.015

  // bounds: wedge prims sweep a full circle around Y
  let maxR = 0.3
  let yMin = Infinity
  let yMax = -Infinity
  for (const { bx, by, bz, br } of [...central, ...wedge]) {
    maxR = Math.max(maxR, Math.hypot(bx, bz) + br)
    yMin = Math.min(yMin, by - br)
    yMax = Math.max(yMax, by + br)
  }
  const margin = k * 1.5 + 0.1
  const bounds = {
    min: [-maxR - margin, yMin - margin, -maxR - margin] as V3,
    max: [maxR + margin, yMax + margin, maxR + margin] as V3,
  }

  const accum = (
    list: BoundedPrim[],
    x: number,
    y: number,
    z: number,
    d: number,
    kk: number,
  ) => {
    for (let i = 0; i < list.length; i++) {
      const bp = list[i]
      const dx = x - bp.bx
      const dy = y - bp.by
      const dz = z - bp.bz
      const lim = d + kk + bp.br
      if (lim > 0 && dx * dx + dy * dy + dz * dz > lim * lim) continue
      d = smin(d, evalPrim(bp.prim, x, y, z), kk)
    }
    return d
  }

  // fold the point into the canonical wedge and its two neighbors so
  // primitives spanning a sector boundary still blend seamlessly; for the
  // dihedral group each candidate is also evaluated mirrored across the
  // wedge center plane
  const foldAccum = (
    list: BoundedPrim[],
    x: number,
    y: number,
    z: number,
    d: number,
    kk: number,
    theta: number,
  ) => {
    const kf = Math.floor(theta / sector)
    for (let o = -1; o <= 1; o++) {
      const a = (kf + o) * sector
      const ca = Math.cos(a)
      const sa = Math.sin(a)
      const xr = x * ca + z * sa
      const zr = -x * sa + z * ca
      d = accum(list, xr, y, zr, d, kk)
      if (mirror) {
        // reflect across the wedge center plane θ = sector/2
        const a2 = Math.atan2(zr, xr)
        const rr = Math.hypot(xr, zr)
        const am = sector - a2
        d = accum(list, Math.cos(am) * rr, y, Math.sin(am) * rr, d, kk)
      }
    }
    return d
  }

  const evalAt = (x: number, y: number, z: number): number => {
    const theta = Math.atan2(z, x)
    let d = accum(central, x, y, z, 1e9, k)
    d = foldAccum(wedge, x, y, z, d, k, theta)

    if (centralNeg.length || wedgeNeg.length) {
      let dn = accum(centralNeg, x, y, z, 1e9, kNeg)
      dn = foldAccum(wedgeNeg, x, y, z, dn, kNeg, theta)
      d = -smin(-d, dn, kNeg)
    }

    return d
  }

  return { eval: evalAt, bounds }
}

/* ------------------------------------------------------------------ */
/* Sampling + meshing                                                  */
/* ------------------------------------------------------------------ */

export type HolderMeshArrays = {
  positions: Float32Array
  normals: Float32Array
  indices: Uint32Array
}

/**
 * Sample the field and run marching cubes. `cellsPerTube` sets the mesh
 * resolution relative to the strut diameter — the detail that matters —
 * capped at `maxDim` cells on the longest axis. Normals come from the SDF
 * gradient, so shading is glassy-smooth even at modest resolutions.
 */
export function buildHolderArrays(
  p: HolderParams,
  cellsPerTube: number,
  maxDim = 280,
): HolderMeshArrays {
  const field = makeField(p)
  const [x0, y0, z0] = field.bounds.min
  const [x1, y1, z1] = field.bounds.max
  const ex = x1 - x0
  const ey = y1 - y0
  const ez = z1 - z0
  const maxExtent = Math.max(ex, ey, ez)
  // two resolution demands: the tube wants `cellsPerTube` for smoothness,
  // while thin features (tapered tips, dish plate, shell wall) only need
  // ~2.8 cells across to not tear — so they set a floor, not the budget
  const TEAR_CELLS = 2.8
  const gens = Math.max(0, Math.round(p.depth) - 1)
  let minFeature = Math.max(0.05, p.tube * Math.pow(1 - p.taper * 0.45, gens)) * 2
  if (p.dish > 0.02) minFeature = Math.min(minFeature, 0.14)
  if (p.shell > 0.25) minFeature = Math.min(minFeature, p.tube * 1.7)
  const cell = Math.max(
    Math.min((p.tube * 2) / cellsPerTube, minFeature / TEAR_CELLS),
    maxExtent / maxDim,
  )
  const nx = Math.max(8, Math.ceil(ex / cell) + 1)
  const ny = Math.max(8, Math.ceil(ey / cell) + 1)
  const nz = Math.max(8, Math.ceil(ez / cell) + 1)

  // hierarchical sampling: probe a coarse lattice first and skip whole
  // blocks that provably contain no surface (the field is 1-Lipschitz),
  // evaluating fine cells only near the surface — a 3-6x speedup
  const values = new Float32Array(nx * ny * nz)
  const S = 4 // block stride
  const ncx = Math.ceil((nx - 1) / S) + 1
  const ncy = Math.ceil((ny - 1) / S) + 1
  const ncz = Math.ceil((nz - 1) / S) + 1
  const coarse = new Float32Array(ncx * ncy * ncz)
  let ci = 0
  for (let z = 0; z < ncz; z++) {
    const pz = z0 + Math.min(z * S, nz - 1) * cell
    for (let y = 0; y < ncy; y++) {
      const py = y0 + Math.min(y * S, ny - 1) * cell
      for (let x = 0; x < ncx; x++, ci++) {
        coarse[ci] = field.eval(x0 + Math.min(x * S, nx - 1) * cell, py, pz)
      }
    }
  }
  const diag = S * cell * Math.sqrt(3) * 1.05
  const cAt = (x: number, y: number, z: number) => coarse[x + ncx * (y + ncy * z)]
  for (let bz = 0; bz < ncz - 1; bz++) {
    for (let by = 0; by < ncy - 1; by++) {
      for (let bx = 0; bx < ncx - 1; bx++) {
        let m = Infinity
        let sgn = 0
        for (let c = 0; c < 8; c++) {
          const v = cAt(bx + (c & 1), by + ((c >> 1) & 1), bz + ((c >> 2) & 1))
          m = Math.min(m, Math.abs(v))
          sgn = v
        }
        const xEnd = Math.min((bx + 1) * S, nx - 1)
        const yEnd = Math.min((by + 1) * S, ny - 1)
        const zEnd = Math.min((bz + 1) * S, nz - 1)
        if (m > diag) {
          // whole block is provably on one side — fill, don't evaluate
          const fill = sgn > 0 ? m : -m
          for (let z = bz * S; z <= zEnd; z++) {
            for (let y = by * S; y <= yEnd; y++) {
              let idx = bx * S + nx * (y + ny * z)
              for (let x = bx * S; x <= xEnd; x++, idx++) values[idx] = fill
            }
          }
        } else {
          for (let z = bz * S; z <= zEnd; z++) {
            const pz = z0 + z * cell
            for (let y = by * S; y <= yEnd; y++) {
              const py = y0 + y * cell
              let idx = bx * S + nx * (y + ny * z)
              for (let x = bx * S; x <= xEnd; x++, idx++) {
                values[idx] = field.eval(x0 + x * cell, py, pz)
              }
            }
          }
        }
      }
    }
  }

  const grid: Grid = { nx, ny, nz, ox: x0, oy: y0, oz: z0, cell, field: values }
  const marched = marchGrid(grid)
  const positions = marched.positions
  // a candle holder is ONE printable body: keep only the connected
  // component that carries the cup, dropping crumbs and loose ornaments
  const specA = Object.prototype.hasOwnProperty.call(CANDLE_SPECS, p.candle)
    ? CANDLE_SPECS[p.candle]
    : CANDLE_SPECS.kronelys
  const cupYA = Math.min(
    -p.height / 2 + p.cupPos * p.height,
    p.height / 2 - specA.cupHalfH * 0.5,
  )
  const indices = filterIslands(positions, marched.indices, [
    0,
    cupYA - specA.cupHalfH * 0.6,
    0,
  ])

  // normals from the field gradient (central differences); the wider stencil
  // softens shading over creases like the dish rim
  const normals = new Float32Array(positions.length)
  const eps = cell * 0.9
  for (let v = 0; v < positions.length; v += 3) {
    const x = positions[v]
    const y = positions[v + 1]
    const z = positions[v + 2]
    let gx = field.eval(x + eps, y, z) - field.eval(x - eps, y, z)
    let gy = field.eval(x, y + eps, z) - field.eval(x, y - eps, z)
    let gz = field.eval(x, y, z + eps) - field.eval(x, y, z - eps)
    const l = Math.hypot(gx, gy, gz) || 1
    gx /= l
    gy /= l
    gz /= l
    normals[v] = gx
    normals[v + 1] = gy
    normals[v + 2] = gz
  }

  return { positions, normals, indices }
}

/**
 * Connected-component filter over the triangle mesh: the finished piece
 * must be ONE printable body, so only the component containing the cup
 * survives — floating crumbs, severed slivers and even large detached
 * ornaments are all dropped. `anchor` is a point inside the cup's solid
 * wall; the component of the vertex nearest to it is the holder.
 */
function filterIslands(
  positions: Float32Array,
  indices: Uint32Array,
  anchor: [number, number, number],
): Uint32Array {
  const nVerts = positions.length / 3
  if (nVerts === 0) return indices
  const parent = new Int32Array(nVerts)
  for (let i = 0; i < nVerts; i++) parent[i] = i
  const find = (a: number): number => {
    while (parent[a] !== a) {
      parent[a] = parent[parent[a]]
      a = parent[a]
    }
    return a
  }
  for (let t = 0; t < indices.length; t += 3) {
    const a = find(indices[t])
    const b = find(indices[t + 1])
    const c = find(indices[t + 2])
    if (b !== a) parent[b] = a
    if (c !== a) parent[c] = a
  }
  let best = 0
  let bestD = Infinity
  for (let i = 0; i < nVerts; i++) {
    const dx = positions[i * 3] - anchor[0]
    const dy = positions[i * 3 + 1] - anchor[1]
    const dz = positions[i * 3 + 2] - anchor[2]
    const d = dx * dx + dy * dy + dz * dz
    if (d < bestD) {
      bestD = d
      best = i
    }
  }
  const keep = find(best)
  const out = new Uint32Array(indices.length)
  let w = 0
  for (let t = 0; t < indices.length; t += 3) {
    if (find(indices[t]) === keep) {
      out[w++] = indices[t]
      out[w++] = indices[t + 1]
      out[w++] = indices[t + 2]
    }
  }
  if (w === indices.length) return indices
  return out.slice(0, w)
}
