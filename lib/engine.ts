/**
 * The vessel motor's public parameter space.
 *
 * One formal system covers every reference piece: a thrown-vessel profile
 * (foot → belly → neck → flared mouth), optionally stepped into pagoda
 * skirts, whose surface is built not as a solid skin but from structure —
 * radial fins and horizontal shelves that follow the profile, crossing
 * into waffle grids, studded with spikes at the crossings, wrapped in an
 * optional solid lower skin, and eroded at every free edge by ruffle and
 * tear noise. Each preset is one of the reference pieces, exactly; the
 * sliders move through the space between them.
 *
 * This module is UI-facing and dependency-free. The geometry itself is
 * built in lib/vessel.ts (SDF + marching cubes) and mounted by
 * components/engine-mesh.tsx.
 */

/** Physical scale: 1 scene unit = 50 mm. STL exports are scaled to mm. */
export const MM_PER_UNIT = 50

export type ParamKey =
  // silhouette
  | "height"
  | "foot"
  | "belly"
  | "bellyY"
  | "neck"
  | "neckY"
  | "flare"
  | "lip"
  // pagoda skirts
  | "tiers"
  | "tierDepth"
  | "droop"
  // radial fins
  | "fins"
  | "finDepth"
  | "finThick"
  | "twist"
  // horizontal shelves
  | "rings"
  | "ringDepth"
  | "ringThick"
  // body
  | "core"
  | "wall"
  | "skin"
  // free edges
  | "ruffle"
  | "ruffleFreq"
  | "mouthWave"
  | "mouthAmp"
  | "spikes"
  | "rough"

export type ParamRange = { min: number; max: number; step: number }

export type Params = { preset: string; seed: number } & Record<ParamKey, number>

export const PARAM_RANGES: Record<ParamKey, ParamRange> = {
  height: { min: 1.6, max: 4.4, step: 0.05 },
  foot: { min: 0.2, max: 1.2, step: 0.01 },
  belly: { min: 0.3, max: 1.6, step: 0.01 },
  bellyY: { min: 0.1, max: 0.7, step: 0.01 },
  neck: { min: 0.12, max: 0.9, step: 0.01 },
  neckY: { min: 0.5, max: 0.92, step: 0.01 },
  flare: { min: 0, max: 1.2, step: 0.01 },
  lip: { min: 0, max: 1, step: 0.01 },
  tiers: { min: 0, max: 6, step: 1 },
  tierDepth: { min: 0, max: 0.5, step: 0.01 },
  droop: { min: 0, max: 1, step: 0.01 },
  fins: { min: 0, max: 48, step: 1 },
  finDepth: { min: 0, max: 0.7, step: 0.01 },
  finThick: { min: 0.02, max: 0.12, step: 0.005 },
  twist: { min: -1, max: 1, step: 0.01 },
  rings: { min: 0, max: 16, step: 1 },
  ringDepth: { min: 0, max: 0.6, step: 0.01 },
  ringThick: { min: 0.02, max: 0.14, step: 0.005 },
  core: { min: 0.25, max: 1, step: 0.01 },
  wall: { min: 0.04, max: 0.2, step: 0.005 },
  skin: { min: 0, max: 1, step: 0.01 },
  ruffle: { min: 0, max: 0.35, step: 0.01 },
  ruffleFreq: { min: 2, max: 24, step: 1 },
  mouthWave: { min: 0, max: 8, step: 1 },
  mouthAmp: { min: 0, max: 0.35, step: 0.01 },
  spikes: { min: 0, max: 1, step: 0.01 },
  rough: { min: 0, max: 1, step: 0.01 },
}

/** How the controls panel groups the parameters. */
export const SECTIONS: {
  title: string
  keys: { key: ParamKey; label: string }[]
}[] = [
  {
    title: "Silhouette",
    keys: [
      { key: "height", label: "Height" },
      { key: "foot", label: "Foot" },
      { key: "belly", label: "Belly" },
      { key: "bellyY", label: "Belly at" },
      { key: "neck", label: "Neck" },
      { key: "neckY", label: "Neck at" },
      { key: "flare", label: "Flare" },
      { key: "lip", label: "Lip" },
    ],
  },
  {
    title: "Skirts",
    keys: [
      { key: "tiers", label: "Tiers" },
      { key: "tierDepth", label: "Depth" },
      { key: "droop", label: "Droop" },
    ],
  },
  {
    title: "Fins",
    keys: [
      { key: "fins", label: "Fins" },
      { key: "finDepth", label: "Depth" },
      { key: "finThick", label: "Thick" },
      { key: "twist", label: "Twist" },
    ],
  },
  {
    title: "Shelves",
    keys: [
      { key: "rings", label: "Shelves" },
      { key: "ringDepth", label: "Depth" },
      { key: "ringThick", label: "Thick" },
    ],
  },
  {
    title: "Body",
    keys: [
      { key: "core", label: "Core" },
      { key: "wall", label: "Wall" },
      { key: "skin", label: "Skin" },
    ],
  },
  {
    title: "Edges",
    keys: [
      { key: "ruffle", label: "Ruffle" },
      { key: "ruffleFreq", label: "Waves" },
      { key: "mouthWave", label: "Mouth n" },
      { key: "mouthAmp", label: "Mouth amp" },
      { key: "spikes", label: "Spikes" },
      { key: "rough", label: "Tear" },
    ],
  },
]

/**
 * The five reference pieces, one preset each:
 *  - relikvie: tall white column — spiked shelf/fin lattice over a solid
 *    lower skirt, ruffled crown mouth
 *  - pagode:   grey stepped tower — dense pleat fins over four drooping
 *    skirts, squared trumpet mouth
 *  - vaffel:   blue ovoid — open fin × shelf waffle grid around an inner
 *    vessel, flat squared collar
 *  - turbin:   squat cream rotor — deep radial fins around a fat belly,
 *    one skirt, flared top
 *  - korall:   white bloom — few fins and shelves, everything heavily
 *    ruffled and torn, wide horn mouth
 */
const BASE: Record<string, Record<ParamKey, number>> = {
  relikvie: {
    height: 4.1, foot: 0.95, belly: 1.02, bellyY: 0.5, neck: 0.42, neckY: 0.78,
    flare: 0.58, lip: 0.4,
    tiers: 0, tierDepth: 0, droop: 0.3,
    fins: 10, finDepth: 0.34, finThick: 0.05, twist: 0,
    rings: 11, ringDepth: 0.3, ringThick: 0.055,
    core: 0.55, wall: 0.1, skin: 0.4,
    ruffle: 0.03, ruffleFreq: 9, mouthWave: 0, mouthAmp: 0, spikes: 1,
    rough: 0.35,
  },
  pagode: {
    height: 3.3, foot: 0.5, belly: 1.18, bellyY: 0.3, neck: 0.34, neckY: 0.72,
    flare: 0.58, lip: 0.3,
    tiers: 4, tierDepth: 0.3, droop: 0.6,
    fins: 34, finDepth: 0.11, finThick: 0.045, twist: 0,
    rings: 0, ringDepth: 0, ringThick: 0.05,
    core: 0.82, wall: 0.09, skin: 0,
    ruffle: 0.04, ruffleFreq: 15, mouthWave: 4, mouthAmp: 0.15, spikes: 0,
    rough: 0.45,
  },
  vaffel: {
    height: 2.9, foot: 0.5, belly: 1.02, bellyY: 0.42, neck: 0.3, neckY: 0.8,
    flare: 0.72, lip: 0.75,
    tiers: 0, tierDepth: 0, droop: 0.15,
    fins: 12, finDepth: 0.22, finThick: 0.05, twist: 0,
    rings: 8, ringDepth: 0.22, ringThick: 0.05,
    core: 0.85, wall: 0.08, skin: 0,
    ruffle: 0.03, ruffleFreq: 8, mouthWave: 4, mouthAmp: 0.22, spikes: 0.5,
    rough: 0.3,
  },
  turbin: {
    height: 2.2, foot: 0.6, belly: 1.5, bellyY: 0.28, neck: 0.45, neckY: 0.68,
    flare: 0.7, lip: 0.22,
    tiers: 2, tierDepth: 0.3, droop: 0.7,
    fins: 18, finDepth: 0.45, finThick: 0.06, twist: 0.05,
    rings: 0, ringDepth: 0, ringThick: 0.05,
    core: 0.6, wall: 0.1, skin: 0,
    ruffle: 0.05, ruffleFreq: 10, mouthWave: 0, mouthAmp: 0, spikes: 0,
    rough: 0.35,
  },
  korall: {
    height: 3.1, foot: 0.68, belly: 1.12, bellyY: 0.44, neck: 0.48, neckY: 0.7,
    flare: 1.05, lip: 0.5,
    tiers: 2, tierDepth: 0.15, droop: 0.6,
    fins: 9, finDepth: 0.3, finThick: 0.045, twist: 0,
    rings: 4, ringDepth: 0.26, ringThick: 0.05,
    core: 0.65, wall: 0.09, skin: 0.12,
    ruffle: 0.24, ruffleFreq: 7, mouthWave: 0, mouthAmp: 0, spikes: 0.15,
    rough: 0.55,
  },
}

export const PRESETS: readonly string[] = Object.keys(BASE)

/** Body tint per family, matched to the reference pieces. */
export const PRESET_COLORS: Record<string, string> = {
  relikvie: "#f4f1e8",
  pagode: "#b8b0ac",
  vaffel: "#8fb0cc",
  turbin: "#eddcb4",
  korall: "#f5f2ec",
}

/** Which parameter each two-finger scroll axis nudges. */
export const NUDGE_PARAMS: { vertical?: ParamKey; horizontal?: ParamKey } = {
  vertical: "height",
  horizontal: "belly",
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 9000) + 1000
}

/**
 * The canonical design of a preset family. Deliberately NOT seed-jittered:
 * picking a preset reproduces the reference piece exactly — the seed only
 * phases the ruffle/tear noise fields.
 */
export function genParams(seed: number, preset: string): Params {
  const base = BASE[preset] ?? BASE[PRESETS[0]]
  return { preset: BASE[preset] ? preset : PRESETS[0], seed, ...base }
}

// mulberry32 — tiny deterministic PRNG for shuffle jitter
function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// how far shuffle may wander from the family base: fraction of the full
// range for continuous params, absolute ± for integer ones
const JITTER: Record<ParamKey, number> = {
  height: 0.12, foot: 0.15, belly: 0.15, bellyY: 0.12, neck: 0.15,
  neckY: 0.08, flare: 0.2, lip: 0.2,
  tiers: 1, tierDepth: 0.2, droop: 0.25,
  fins: 4, finDepth: 0.2, finThick: 0.1, twist: 0.15,
  rings: 2, ringDepth: 0.2, ringThick: 0.1,
  core: 0.12, wall: 0.08, skin: 0.1,
  ruffle: 0.2, ruffleFreq: 3, mouthWave: 0, mouthAmp: 0.15, spikes: 0.2,
  rough: 0.2,
}

/** A seeded variation within a preset family. */
export function randomizeParams(seed: number, preset: string): Params {
  const p = genParams(seed, preset)
  const rnd = rng(seed * 2654435761)
  for (const k of Object.keys(PARAM_RANGES) as ParamKey[]) {
    const r = PARAM_RANGES[k]
    const j = JITTER[k]
    if (j === 0) continue
    let v: number
    if (r.step >= 1) {
      v = p[k] + Math.round((rnd() - 0.5) * 2 * j)
    } else {
      v = p[k] + (rnd() - 0.5) * 2 * j * (r.max - r.min)
    }
    v = Math.min(r.max, Math.max(r.min, v))
    p[k] = r.step >= 1 ? Math.round(v) : +v.toFixed(3)
  }
  // structure that collapses to zero stays zero — it defines the family
  const base = BASE[p.preset]
  if (base.fins === 0) p.fins = 0
  if (base.rings === 0) p.rings = 0
  if (base.tiers === 0) p.tiers = 0
  if (base.skin === 0) p.skin = 0
  if (base.spikes === 0) p.spikes = 0
  if (base.mouthAmp === 0) p.mouthAmp = 0
  return p
}

export const DEFAULT_PARAMS: Params = genParams(1204, "relikvie")
