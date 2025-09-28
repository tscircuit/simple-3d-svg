import { vec3 } from "gl-matrix"
import type { Box } from "./types"
import { add, fromPoint, rotLocal, type Vec3 } from "./vec3"

// faces: front, back, bottom, top, right, left
export const FACES: [number, number, number, number][] = [
  [0, 1, 2, 3],
  [4, 7, 6, 5],
  [0, 1, 5, 4],
  [3, 2, 6, 7],
  [1, 2, 6, 5],
  [0, 3, 7, 4],
]
export const EDGES: [number, number][] = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 0],
  [4, 5],
  [5, 6],
  [6, 7],
  [7, 4],
  [0, 4],
  [1, 5],
  [2, 6],
  [3, 7],
]
export const TOP = [3, 2, 6, 7] as const

export const BOX_TRIANGLES: [number, number, number][] = [
  [0, 1, 2],
  [0, 2, 3],
  [4, 6, 7],
  [4, 5, 6],
  [0, 5, 1],
  [0, 4, 5],
  [3, 6, 2],
  [3, 7, 6],
  [1, 6, 2],
  [1, 5, 6],
  [0, 7, 3],
  [0, 4, 7],
]

export function verts(b: Box): Vec3[] {
  const { size, center, rotation } = b
  const sx = size.x
  const sy = size.y
  const sz = size.z

  const offsets: Vec3[] = [
    vec3.fromValues(-sx / 2, -sy / 2, -sz / 2),
    vec3.fromValues(sx / 2, -sy / 2, -sz / 2),
    vec3.fromValues(sx / 2, sy / 2, -sz / 2),
    vec3.fromValues(-sx / 2, sy / 2, -sz / 2),
    vec3.fromValues(-sx / 2, -sy / 2, sz / 2),
    vec3.fromValues(sx / 2, -sy / 2, sz / 2),
    vec3.fromValues(sx / 2, sy / 2, sz / 2),
    vec3.fromValues(-sx / 2, sy / 2, sz / 2),
  ]

  const c = fromPoint(center)
  return offsets.map((offset) => add(rotLocal(offset, rotation), c))
}

export function buildBoxTriangleBuffer(box: Box): Float32Array[] {
  const v = verts(box)
  return BOX_TRIANGLES.map(([a, b, c]) => {
    const triangle = new Float32Array(9)
    triangle.set(v[a]!, 0)
    triangle.set(v[b]!, 3)
    triangle.set(v[c]!, 6)
    return triangle
  })
}
