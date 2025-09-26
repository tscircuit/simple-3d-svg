import type { Point3, STLMesh, Box } from "./types"
import { add, sub, scale, rotLocal } from "./vec3"

type TransformCacheEntry = {
  key: string
  vertices: Point3[]
}

const transformCache = new WeakMap<Box, Map<STLMesh, TransformCacheEntry>>()

const numSig = (n: number): string =>
  Number.isFinite(n) ? n.toFixed(6) : n === Infinity ? "inf" : n === -Infinity ? "-inf" : "nan"

const pointSig = (p?: Point3 | null): string =>
  p ? `${numSig(p.x)},${numSig(p.y)},${numSig(p.z)}` : "null"

const buildTransformKey = (
  box: Box,
  scaleToBox: boolean,
  modelType: "stl" | "obj" | "3mf",
): string =>
  [
    modelType,
    scaleToBox ? "1" : "0",
    box.centerModel === false ? "0" : "1",
    pointSig(box.center),
    pointSig(box.size),
    pointSig(box.rotation),
    pointSig(box.stlRotation),
    pointSig(box.objRotation),
    pointSig(box.threeMfRotation),
    pointSig(box.stlPosition),
    pointSig(box.objPosition),
    pointSig(box.threeMfPosition),
  ].join("|")

export function scaleAndPositionMesh(
  mesh: STLMesh,
  box: Box,
  scaleToBox: boolean,
  modelType: "stl" | "obj" | "3mf",
): Point3[] {
  let perBox = transformCache.get(box)
  if (!perBox) {
    perBox = new Map()
    transformCache.set(box, perBox)
  }

  const cacheKey = buildTransformKey(box, scaleToBox, modelType)
  const cached = perBox.get(mesh)
  if (cached && cached.key === cacheKey) {
    return cached.vertices
  }

  const { boundingBox } = mesh
  const meshCenter = scale(add(boundingBox.min, boundingBox.max), 0.5)
  const centerModel = box.centerModel !== false

  const rotatedCache = new Map<Point3, Point3>()
  for (const tri of mesh.triangles) {
    for (const v of tri.vertices) {
      if (rotatedCache.has(v)) continue
      let p = sub(v, meshCenter)
      if (modelType === "stl" && box.stlRotation)
        p = rotLocal(p, box.stlRotation)
      if (modelType === "obj" && box.objRotation)
        p = rotLocal(p, box.objRotation)
      if (modelType === "3mf" && box.threeMfRotation)
        p = rotLocal(p, box.threeMfRotation)
      if (!centerModel) p = add(p, meshCenter)
      rotatedCache.set(v, p)
    }
  }

  let uniformScale = 1
  let rotatedCenter = { x: 0, y: 0, z: 0 }

  if (scaleToBox) {
    let min = { x: Infinity, y: Infinity, z: Infinity }
    let max = { x: -Infinity, y: -Infinity, z: -Infinity }
    for (const v of rotatedCache.values()) {
      if (v.x < min.x) min.x = v.x
      if (v.y < min.y) min.y = v.y
      if (v.z < min.z) min.z = v.z
      if (v.x > max.x) max.x = v.x
      if (v.y > max.y) max.y = v.y
      if (v.z > max.z) max.z = v.z
    }
    const rotatedSize = sub(max, min)
    const boxSize = box.size
    const scaleX = rotatedSize.x !== 0 ? boxSize.x / rotatedSize.x : 1
    const scaleY = rotatedSize.y !== 0 ? boxSize.y / rotatedSize.y : 1
    const scaleZ = rotatedSize.z !== 0 ? boxSize.z / rotatedSize.z : 1
    uniformScale = Math.min(scaleX, scaleY, scaleZ)
    if (!Number.isFinite(uniformScale) || uniformScale === 0) {
      uniformScale = 1
    }
    rotatedCenter = scale(add(min, max), 0.5)
  }

  const transformedVertices: Point3[] = []
  const transformedCache = new Map<Point3, Point3>()
  for (const tri of mesh.triangles) {
    for (const v of tri.vertices) {
      let t = transformedCache.get(v)
      if (!t) {
        const base = rotatedCache.get(v)!
        let next = base
        if (scaleToBox) {
          next = sub(next, rotatedCenter)
          next = scale(next, uniformScale)
          if (!centerModel) next = add(next, rotatedCenter)
        }
        if (modelType === "stl" && box.stlPosition)
          next = add(next, box.stlPosition)
        if (modelType === "obj" && box.objPosition)
          next = add(next, box.objPosition)
        if (modelType === "3mf" && box.threeMfPosition)
          next = add(next, box.threeMfPosition)
        if (box.rotation) next = rotLocal(next, box.rotation)
        next = add(next, box.center)
        t = next
        transformedCache.set(v, t)
      }
      transformedVertices.push(t)
    }
  }

  perBox.set(mesh, { key: cacheKey, vertices: transformedVertices })

  return transformedVertices
}
