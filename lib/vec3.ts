import { mat4, vec3 } from "gl-matrix"
import type { Point3 } from "./types"

export type Vec3 = vec3
export type VecLike = Point3 | Vec3

export function isVec3(v: VecLike): v is Vec3 {
  return v instanceof Float32Array
}

export function create(x = 0, y = 0, z = 0): Vec3 {
  return vec3.fromValues(x, y, z)
}

export function fromPoint(p: Point3): Vec3 {
  return vec3.fromValues(p.x, p.y, p.z)
}

export function toPoint(v: Vec3): Point3 {
  return { x: v[0]!, y: v[1]!, z: v[2]! }
}

function toVec(v: VecLike): Vec3 {
  return isVec3(v) ? v : fromPoint(v)
}

export function clone(v: VecLike): Vec3 {
  return vec3.clone(toVec(v))
}

export function add(a: VecLike, b: VecLike, out: Vec3 = vec3.create()): Vec3 {
  return vec3.add(out, toVec(a), toVec(b))
}

export function sub(a: VecLike, b: VecLike, out: Vec3 = vec3.create()): Vec3 {
  return vec3.sub(out, toVec(a), toVec(b))
}

export function dot(a: VecLike, b: VecLike): number {
  return vec3.dot(toVec(a), toVec(b))
}

export function cross(a: VecLike, b: VecLike, out: Vec3 = vec3.create()): Vec3 {
  return vec3.cross(out, toVec(a), toVec(b))
}

export function scale(v: VecLike, k: number, out: Vec3 = vec3.create()): Vec3 {
  return vec3.scale(out, toVec(v), k)
}

export function len(v: VecLike): number {
  return vec3.length(toVec(v))
}

export function norm(v: VecLike, out: Vec3 = vec3.create()): Vec3 {
  return vec3.normalize(out, toVec(v))
}

export function rotLocal(
  v: VecLike,
  rotation?: Point3 | null,
  out: Vec3 = vec3.create(),
): Vec3 {
  const vec = toVec(v)
  if (!rotation || (!rotation.x && !rotation.y && !rotation.z)) {
    return vec3.copy(out, vec)
  }

  const temp = vec3.create()
  vec3.copy(out, vec)

  if (rotation.x) {
    const m = mat4.create()
    mat4.fromXRotation(m, rotation.x)
    vec3.transformMat4(temp, out, m)
    vec3.copy(out, temp)
  }
  if (rotation.y) {
    const m = mat4.create()
    mat4.fromYRotation(m, rotation.y)
    vec3.transformMat4(temp, out, m)
    vec3.copy(out, temp)
  }
  if (rotation.z) {
    const m = mat4.create()
    mat4.fromZRotation(m, rotation.z)
    vec3.transformMat4(temp, out, m)
    vec3.copy(out, temp)
  }

  return out
}
