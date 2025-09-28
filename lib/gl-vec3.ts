import { mat4, vec3 } from "gl-matrix"
import type { Point3 } from "./types"

export type Vec3 = vec3

export function createVec3(): vec3 {
  return vec3.create()
}

export function cloneVec3(v: vec3): vec3 {
  return vec3.clone(v)
}

export function fromPoint(point: Point3, out: vec3 = vec3.create()): vec3 {
  out[0] = point.x
  out[1] = point.y
  out[2] = point.z
  return out
}

export function toPoint(source: vec3): Point3 {
  return { x: source[0]!, y: source[1]!, z: source[2]! }
}

export function add(out: vec3, a: vec3, b: vec3): vec3 {
  return vec3.add(out, a, b)
}

export function subtract(out: vec3, a: vec3, b: vec3): vec3 {
  return vec3.subtract(out, a, b)
}

export function scale(out: vec3, a: vec3, scalar: number): vec3 {
  return vec3.scale(out, a, scalar)
}

export function dot(a: vec3, b: vec3): number {
  return vec3.dot(a, b)
}

export function cross(out: vec3, a: vec3, b: vec3): vec3 {
  return vec3.cross(out, a, b)
}

export function length(a: vec3): number {
  return vec3.length(a)
}

export function normalize(out: vec3, a: vec3): vec3 {
  return vec3.normalize(out, a)
}

export function createRotationMatrix(rotation?: Point3 | null): mat4 | null {
  if (!rotation) return null
  const matrix = mat4.create()
  mat4.identity(matrix)
  if (rotation.x) mat4.rotateX(matrix, matrix, rotation.x)
  if (rotation.y) mat4.rotateY(matrix, matrix, rotation.y)
  if (rotation.z) mat4.rotateZ(matrix, matrix, rotation.z)
  return matrix
}

export function transformMat4(
  out: vec3,
  v: vec3,
  matrix: mat4 | null | undefined,
): vec3 {
  if (!matrix) return vec3.copy(out, v)
  return vec3.transformMat4(out, v, matrix)
}
