"use client"

import { useEffect, useRef } from "react"
import * as THREE from "three"
import { useThree } from "@react-three/fiber"
import { PRESET_COLORS, type Params } from "@/lib/engine"
import { buildVesselArrays } from "@/lib/vessel"
import { arraysToGeometry } from "@/lib/geometry"
import type { EngineJob, EngineResult } from "@/lib/engine-worker"

// target grid cells along the largest axis — coarse while dragging,
// refined once the parameters settle. Phones get a lighter refine so
// regeneration never feels stuck.
const PREVIEW_RES = 84
const REFINE_RES_MOBILE = 132
const REFINE_RES = 176
const REFINE_RES_HI = 220
const REFINE_DELAY = 240

const newWorker = () =>
  new Worker(new URL("../lib/engine-worker.ts", import.meta.url))

export function EngineMesh({
  params,
  hiDetail,
  mobile,
  onFit,
}: {
  params: Params
  hiDetail: boolean
  mobile: boolean
  onFit?: (radius: number, centerY: number) => void
}) {
  const meshRef = useRef<THREE.Mesh>(null)
  const invalidate = useThree((s) => s.invalidate)

  const genRef = useRef(0)

  // two lanes: a persistent fast worker for previews, and a killable one
  // for long refines — a stale refine is terminated instead of awaited, so
  // switching presets or dragging never waits behind an old build
  const previewWorker = useRef<Worker | null>(null)
  const previewBusy = useRef(false)
  const previewPending = useRef<EngineJob | null>(null)
  const refineWorker = useRef<Worker | null>(null)
  const workersDead = useRef(false)

  const swap = (geo: THREE.BufferGeometry) => {
    const mesh = meshRef.current
    if (!mesh) {
      geo.dispose()
      return
    }
    // stand the vessel on the floor plane at y = 0
    geo.computeBoundingBox()
    const bb = geo.boundingBox
    if (bb) {
      geo.translate(0, -bb.min.y, 0)
      // report the grounded piece's size so the camera can frame it
      const w = Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z)
      const h = bb.max.y - bb.min.y
      onFit?.(Math.hypot(w, h) / 2, h / 2)
    }
    const old = mesh.geometry
    mesh.geometry = geo
    old?.dispose()
    invalidate()
  }

  const applyResult = (e: MessageEvent<EngineResult>) => {
    const { gen, positions, normals, indices } = e.data
    if (gen === genRef.current) {
      swap(arraysToGeometry({ positions, normals, indices }))
    }
  }

  const postPreview = (job: EngineJob) => {
    if (workersDead.current) {
      swap(arraysToGeometry(buildVesselArrays(job.params, job.res)))
      return
    }
    if (!previewWorker.current) {
      try {
        const w = newWorker()
        w.onmessage = (e: MessageEvent<EngineResult>) => {
          applyResult(e)
          const pending = previewPending.current
          previewPending.current = null
          if (pending) w.postMessage(pending)
          else previewBusy.current = false
        }
        w.onerror = () => {
          workersDead.current = true
        }
        previewWorker.current = w
      } catch {
        workersDead.current = true
        swap(arraysToGeometry(buildVesselArrays(job.params, job.res)))
        return
      }
    }
    if (previewBusy.current) {
      previewPending.current = job
    } else {
      previewBusy.current = true
      previewWorker.current.postMessage(job)
    }
  }

  const postRefine = (job: EngineJob) => {
    if (workersDead.current) return
    // kill any in-flight refine — its result would be stale anyway
    refineWorker.current?.terminate()
    try {
      const w = newWorker()
      w.onmessage = (e: MessageEvent<EngineResult>) => {
        applyResult(e)
        w.terminate()
        if (refineWorker.current === w) refineWorker.current = null
      }
      w.onerror = () => {
        w.terminate()
        if (refineWorker.current === w) refineWorker.current = null
      }
      refineWorker.current = w
      w.postMessage(job)
    } catch {
      refineWorker.current = null
    }
  }

  useEffect(() => {
    return () => {
      previewWorker.current?.terminate()
      refineWorker.current?.terminate()
      previewWorker.current = null
      refineWorker.current = null
    }
  }, [])

  useEffect(() => {
    const gen = ++genRef.current
    postPreview({ gen, params, res: PREVIEW_RES })
    const refineRes = hiDetail
      ? REFINE_RES_HI
      : mobile
        ? REFINE_RES_MOBILE
        : REFINE_RES
    const id = window.setTimeout(() => {
      if (gen === genRef.current) {
        postRefine({ gen, params, res: refineRes })
      }
    }, REFINE_DELAY)
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, hiDetail, mobile])

  useEffect(() => {
    const mesh = meshRef.current
    return () => mesh?.geometry?.dispose()
  }, [])

  const tint = PRESET_COLORS[params.preset] ?? "#f3f0e9"

  return (
    <mesh ref={meshRef} castShadow receiveShadow>
      {/* matte slip-cast body under a faint sheen, tinted per family */}
      <meshPhysicalMaterial
        color={tint}
        roughness={0.62}
        metalness={0}
        clearcoat={0.25}
        clearcoatRoughness={0.6}
        envMapIntensity={0.7}
      />
    </mesh>
  )
}
