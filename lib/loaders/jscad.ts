import jscad from "@jscad/modeling"
import {
  executeJscadOperations,
  type JscadImplementation,
  type JscadOperation,
} from "jscad-planner"
import type { Color, Point3, STLMesh, Triangle } from "../types"

function normalizeJscadColor(c?: readonly number[]): Color | undefined {
  if (!c || c.length < 3) return undefined
  const r0 = c[0] ?? 0
  const g0 = c[1] ?? 0
  const b0 = c[2] ?? 0
  const a0 = c[3] ?? 1
  const scale = r0 <= 1 && g0 <= 1 && b0 <= 1 ? 255 : 1
  return [r0 * scale, g0 * scale, b0 * scale, a0]
}

function collectGeom3(value: unknown, out: jscad.geometries.geom3.Geom3[]) {
  if (!value) return
  if (Array.isArray(value)) {
    for (const item of value) {
      collectGeom3(item, out)
    }
    return
  }
  if (jscad.geometries.geom3.isA(value)) {
    out.push(value)
  }
}

export function loadJscadOperation(
  operation: JscadOperation | JscadOperation[],
): STLMesh {
  const ops = Array.isArray(operation) ? operation : [operation]
  const geoms: jscad.geometries.geom3.Geom3[] = []

  for (const op of ops) {
    const evaluated = executeJscadOperations(
      jscad as unknown as JscadImplementation,
      op,
    )
    collectGeom3(evaluated, geoms)
  }

  const triangles: Triangle[] = []

  for (const geom of geoms) {
    const geomColor = normalizeJscadColor(geom.color)
    const polygons = jscad.geometries.geom3.toPolygons(geom)

    for (const poly of polygons) {
      const verts = poly.vertices
      if (!verts || verts.length < 3) continue
      const polyColor = normalizeJscadColor(poly.color) ?? geomColor

      const v0: Point3 = {
        x: verts[0]![0]!,
        y: verts[0]![1]!,
        z: verts[0]![2]!,
      }

      for (let i = 1; i < verts.length - 1; i++) {
        const v1: Point3 = {
          x: verts[i]![0]!,
          y: verts[i]![1]!,
          z: verts[i]![2]!,
        }
        const v2: Point3 = {
          x: verts[i + 1]![0]!,
          y: verts[i + 1]![1]!,
          z: verts[i + 1]![2]!,
        }

        const edge1 = {
          x: v1.x - v0.x,
          y: v1.y - v0.y,
          z: v1.z - v0.z,
        }
        const edge2 = {
          x: v2.x - v0.x,
          y: v2.y - v0.y,
          z: v2.z - v0.z,
        }
        const normal: Point3 = {
          x: edge1.y * edge2.z - edge1.z * edge2.y,
          y: edge1.z * edge2.x - edge1.x * edge2.z,
          z: edge1.x * edge2.y - edge1.y * edge2.x,
        }

        triangles.push(
          polyColor
            ? { vertices: [v0, v1, v2], normal, color: polyColor }
            : { vertices: [v0, v1, v2], normal },
        )
      }
    }
  }

  return {
    triangles,
    boundingBox: calculateBoundingBox(triangles),
  }
}

function calculateBoundingBox(triangles: Triangle[]): {
  min: Point3
  max: Point3
} {
  if (triangles.length === 0) {
    return { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } }
  }

  let minX = Infinity
  let minY = Infinity
  let minZ = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  let maxZ = -Infinity

  for (const tri of triangles) {
    for (const v of tri.vertices) {
      if (v.x < minX) minX = v.x
      if (v.y < minY) minY = v.y
      if (v.z < minZ) minZ = v.z
      if (v.x > maxX) maxX = v.x
      if (v.y > maxY) maxY = v.y
      if (v.z > maxZ) maxZ = v.z
    }
  }

  return {
    min: { x: minX, y: minY, z: minZ },
    max: { x: maxX, y: maxY, z: maxZ },
  }
}
