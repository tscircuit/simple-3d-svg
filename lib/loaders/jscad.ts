import * as jscadModeling from "@jscad/modeling"
import { geometries } from "@jscad/modeling"
import { executeJscadOperations } from "jscad-planner"
import type { JscadOperation } from "jscad-planner"
import type { Point3, STLMesh, Triangle } from "../types"

type JscadPolygon = {
  vertices: Array<number[] | Float32Array>
}

function asGeomList(result: unknown): unknown[] {
  if (result == null) return []
  if (Array.isArray(result)) return result.flatMap(asGeomList)
  return [result]
}

function geom3ToMesh(geometry: unknown): STLMesh {
  const polygons = geometries.geom3.toPolygons(
    geometry as never,
  ) as JscadPolygon[]
  const triangles: Triangle[] = []
  let minX = Infinity
  let minY = Infinity
  let minZ = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  let maxZ = -Infinity

  const updateBounds = (p: Point3) => {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.z < minZ) minZ = p.z
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
    if (p.z > maxZ) maxZ = p.z
  }

  for (const poly of polygons) {
    if (!poly || poly.vertices.length < 3) continue
    const verts: Point3[] = poly.vertices.map((v) => ({
      x: Number(v[0]),
      y: Number(v[1]),
      z: Number(v[2]),
    }))
    const base = verts[0]!
    const next = verts[1]!
    const next2 = verts[2]!
    const ab = {
      x: next.x - base.x,
      y: next.y - base.y,
      z: next.z - base.z,
    }
    const ac = {
      x: next2.x - base.x,
      y: next2.y - base.y,
      z: next2.z - base.z,
    }
    const cross = {
      x: ab.y * ac.z - ab.z * ac.y,
      y: ab.z * ac.x - ab.x * ac.z,
      z: ab.x * ac.y - ab.y * ac.x,
    }
    const length = Math.sqrt(cross.x ** 2 + cross.y ** 2 + cross.z ** 2) || 1
    const normal = {
      x: cross.x / length,
      y: cross.y / length,
      z: cross.z / length,
    }

    for (let i = 1; i < verts.length - 1; i++) {
      const v1 = verts[i]!
      const v2 = verts[i + 1]!
      updateBounds(base)
      updateBounds(v1)
      updateBounds(v2)
      triangles.push({
        vertices: [base, v1, v2],
        normal,
      })
    }
  }

  if (!triangles.length) {
    return {
      triangles,
      boundingBox: {
        min: { x: 0, y: 0, z: 0 },
        max: { x: 0, y: 0, z: 0 },
      },
    }
  }

  return {
    triangles,
    boundingBox: {
      min: { x: minX, y: minY, z: minZ },
      max: { x: maxX, y: maxY, z: maxZ },
    },
  }
}

export function loadJscadOperation(operation: JscadOperation): STLMesh {
  const result = executeJscadOperations(jscadModeling as never, operation)
  const meshes = asGeomList(result).map(geom3ToMesh)
  if (meshes.length === 1) return meshes[0]!

  const triangles = meshes.flatMap((mesh) => mesh.triangles)
  if (!triangles.length) {
    return {
      triangles,
      boundingBox: {
        min: { x: 0, y: 0, z: 0 },
        max: { x: 0, y: 0, z: 0 },
      },
    }
  }

  let minX = Infinity
  let minY = Infinity
  let minZ = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  let maxZ = -Infinity
  for (const mesh of meshes) {
    const { min, max } = mesh.boundingBox
    if (min.x < minX) minX = min.x
    if (min.y < minY) minY = min.y
    if (min.z < minZ) minZ = min.z
    if (max.x > maxX) maxX = max.x
    if (max.y > maxY) maxY = max.y
    if (max.z > maxZ) maxZ = max.z
  }

  return {
    triangles,
    boundingBox: {
      min: { x: minX, y: minY, z: minZ },
      max: { x: maxX, y: maxY, z: maxZ },
    },
  }
}
