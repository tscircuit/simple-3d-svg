import { mat4, vec3 } from "gl-matrix"
import type { Point3 } from "./types"

function toVec(p: Point3): vec3 {
  return vec3.fromValues(p.x, p.y, p.z)
}

function fromVec(v: vec3): Point3 {
  return { x: v[0]!, y: v[1]!, z: v[2]! }
}

export function add(a: Point3, b: Point3): Point3 {
  const out = vec3.create()
  vec3.add(out, toVec(a), toVec(b))
  return fromVec(out)
}

export function sub(a: Point3, b: Point3): Point3 {
  const out = vec3.create()
  vec3.subtract(out, toVec(a), toVec(b))
  return fromVec(out)
}

export function dot(a: Point3, b: Point3): number {
  return vec3.dot(toVec(a), toVec(b))
}

export function cross(a: Point3, b: Point3): Point3 {
  const out = vec3.create()
  vec3.cross(out, toVec(a), toVec(b))
  return fromVec(out)
}

export function scale(v: Point3, k: number): Point3 {
  const out = vec3.create()
  vec3.scale(out, toVec(v), k)
  return fromVec(out)
}

export function len(v: Point3): number {
  return vec3.length(toVec(v))
}

export function norm(v: Point3): Point3 {
  const out = vec3.create()
  vec3.normalize(out, toVec(v))
  if (!out[0] && !out[1] && !out[2]) return { x: 0, y: 0, z: 0 }
  return fromVec(out)
}

export function rotLocal(p: Point3, r: Point3 = { x: 0, y: 0, z: 0 }): Point3 {
  const matrix = mat4.create()
  mat4.identity(matrix)
  if (r.x) mat4.rotateX(matrix, matrix, r.x)
  if (r.y) mat4.rotateY(matrix, matrix, r.y)
  if (r.z) mat4.rotateZ(matrix, matrix, r.z)
  const out = vec3.create()
  vec3.transformMat4(out, toVec(p), matrix)
  return fromVec(out)
}
