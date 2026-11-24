import * as jscadModeling from "@jscad/modeling"
import { executeJscadOperations, type JscadOperation } from "jscad-planner"
import type { Color, JscadObject, Point3, STLMesh, Triangle } from "../types"
import { add, cross, norm, rotLocal, sub } from "../vec3"

function jscadColorToColor(c?: number[]): Color | undefined {
  if (!c || c.length < 3) return undefined
  const [r = 0, g = 0, b = 0, a = 1] = c
  const factor = r <= 1 && g <= 1 && b <= 1 ? 255 : 1
  return [r * factor, g * factor, b * factor, a]
}

function extractTriangles(
  geom: unknown,
  out: Triangle[],
  inheritedColor?: Color,
): void {
  if (!geom) return
  if (Array.isArray(geom)) {
    for (const item of geom) {
      extractTriangles(item, out, inheritedColor)
    }
    return
  }

  if (jscadModeling.geometries.geom3.isA(geom)) {
    const geomColor =
      jscadColorToColor((geom as { color?: number[] }).color) ?? inheritedColor
    const polygons = jscadModeling.geometries.geom3.toPolygons(geom)
    for (const poly of polygons) {
      const verts = poly.vertices
      if (!verts || verts.length < 3) continue
      const polyColor =
        jscadColorToColor((poly as { color?: number[] }).color) ?? geomColor
      const first = verts[0]!
      const v0: Point3 = { x: first[0], y: first[1], z: first[2] }
      for (let i = 1; i < verts.length - 1; i++) {
        const va = verts[i]!
        const vb = verts[i + 1]!
        const v1: Point3 = { x: va[0], y: va[1], z: va[2] }
        const v2: Point3 = { x: vb[0], y: vb[1], z: vb[2] }
        const normal = norm(cross(sub(v1, v0), sub(v2, v0)))
        out.push({
          vertices: [v0, v1, v2],
          normal,
          ...(polyColor ? { color: polyColor } : {}),
        })
      }
    }
  }
}

function computeBoundingBox(triangles: Triangle[]): STLMesh["boundingBox"] {
  if (triangles.length === 0) {
    return {
      min: { x: 0, y: 0, z: 0 },
      max: { x: 0, y: 0, z: 0 },
    }
  }
  const min = { x: Infinity, y: Infinity, z: Infinity }
  const max = { x: -Infinity, y: -Infinity, z: -Infinity }
  for (const tri of triangles) {
    for (const v of tri.vertices) {
      if (v.x < min.x) min.x = v.x
      if (v.y < min.y) min.y = v.y
      if (v.z < min.z) min.z = v.z
      if (v.x > max.x) max.x = v.x
      if (v.y > max.y) max.y = v.y
      if (v.z > max.z) max.z = v.z
    }
  }
  return { min, max }
}

export function convertJscadOperationToMesh(
  operation: JscadOperation,
): STLMesh {
  const evaluated = executeJscadOperations(jscadModeling as any, operation)
  const triangles: Triangle[] = []
  extractTriangles(evaluated, triangles)
  return {
    triangles,
    boundingBox: computeBoundingBox(triangles),
  }
}

export function convertJscadObjectToMesh(jscadObject: JscadObject): STLMesh {
  const baseMesh = convertJscadOperationToMesh(jscadObject.jscad)
  const { center, rotation, scale: scaleOpt } = jscadObject
  if (!center && !rotation && scaleOpt === undefined) {
    return baseMesh
  }

  const scaleVec: Point3 =
    typeof scaleOpt === "number"
      ? { x: scaleOpt, y: scaleOpt, z: scaleOpt }
      : (scaleOpt ?? { x: 1, y: 1, z: 1 })

  const transformVertex = (v: Point3): Point3 => {
    let p: Point3 = {
      x: v.x * scaleVec.x,
      y: v.y * scaleVec.y,
      z: v.z * scaleVec.z,
    }
    if (rotation) p = rotLocal(p, rotation)
    if (center) p = add(p, center)
    return p
  }

  const flipWinding = scaleVec.x * scaleVec.y * scaleVec.z < 0

  const triangles: Triangle[] = baseMesh.triangles.map((tri) => {
    const v0 = transformVertex(tri.vertices[0])
    const rawV1 = transformVertex(tri.vertices[1])
    const rawV2 = transformVertex(tri.vertices[2])
    const v1 = flipWinding ? rawV2 : rawV1
    const v2 = flipWinding ? rawV1 : rawV2
    return {
      vertices: [v0, v1, v2],
      normal: norm(cross(sub(v1, v0), sub(v2, v0))),
      ...(tri.color ? { color: tri.color } : {}),
    }
  })

  return {
    triangles,
    boundingBox: computeBoundingBox(triangles),
  }
}
