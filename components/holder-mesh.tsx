"use client"

import { useEffect, useRef } from "react"
import * as THREE from "three"
import { useThree } from "@react-three/fiber"
import { buildHolderArrays, type HolderParams } from "@/lib/candle-holder"
import { arraysToGeometry } from "@/lib/geometry"
import type { HolderJob, HolderResult } from "@/lib/holder-worker"

// resolution is expressed in cells per tube diameter — the detail that
// matters. Coarse while dragging, refined once the parameters settle.
// Phones get a lighter refine so regeneration never feels stuck.
// the calmer shuffle coherence rules made builds ~30% cheaper, which
// buys a crisper refine at the same wall-clock — sharper tube joints
const PREVIEW_CPT = 3.6
const REFINE_CPT_MOBILE = 6.5
const REFINE_CPT = 9
const REFINE_CPT_HI = 12
const REFINE_DELAY = 240

const newWorker = () =>
  new Worker(new URL("../lib/holder-worker.ts", import.meta.url))

export function HolderMesh({
  params,
  hiDetail,
  mobile,
  onFit,
}: {
  params: HolderParams
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
  const previewPending = useRef<HolderJob | null>(null)
  const refineWorker = useRef<Worker | null>(null)
  const workersDead = useRef(false)

  const swap = (geo: THREE.BufferGeometry) => {
    const mesh = meshRef.current
    if (!mesh) {
      geo.dispose()
      return
    }
    // stand the holder on the floor plane at y = 0
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

  const applyResult = (e: MessageEvent<HolderResult>) => {
    const { gen, positions, normals, indices } = e.data
    if (gen === genRef.current) {
      swap(arraysToGeometry({ positions, normals, indices }))
    }
  }

  const postPreview = (job: HolderJob) => {
    if (workersDead.current) {
      swap(arraysToGeometry(buildHolderArrays(job.params, job.cellsPerTube)))
      return
    }
    if (!previewWorker.current) {
      try {
        const w = newWorker()
        w.onmessage = (e: MessageEvent<HolderResult>) => {
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
        swap(arraysToGeometry(buildHolderArrays(job.params, job.cellsPerTube)))
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

  const postRefine = (job: HolderJob) => {
    if (workersDead.current) return
    // kill any in-flight refine — its result would be stale anyway
    refineWorker.current?.terminate()
    try {
      const w = newWorker()
      w.onmessage = (e: MessageEvent<HolderResult>) => {
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
    postPreview({ gen, params, cellsPerTube: PREVIEW_CPT })
    const refineCpt = hiDetail
      ? REFINE_CPT_HI
      : mobile
        ? REFINE_CPT_MOBILE
        : REFINE_CPT
    const id = window.setTimeout(() => {
      if (gen === genRef.current) {
        postRefine({ gen, params, cellsPerTube: refineCpt })
      }
    }, REFINE_DELAY)
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, hiDetail, mobile])

  useEffect(() => {
    const mesh = meshRef.current
    return () => mesh?.geometry?.dispose()
  }, [])

  return (
    <mesh ref={meshRef} castShadow receiveShadow>
      {/* glazed ceramic: warm off-white body under a wet clearcoat */}
      <meshPhysicalMaterial
        color="#f3f0e9"
        roughness={0.18}
        metalness={0}
        clearcoat={1}
        clearcoatRoughness={0.22}
        envMapIntensity={1.05}
      />
    </mesh>
  )
}
