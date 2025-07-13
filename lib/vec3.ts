import type { Point3 } from "./types"

export function add(a: Point3, b: Point3): Point3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }
}
export function sub(a: Point3, b: Point3): Point3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }
}
export function dot(a: Point3, b: Point3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z
}
export function cross(a: Point3, b: Point3): Point3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  }
}
export function scale(v: Point3, k: number): Point3 {
  return { x: v.x * k, y: v.y * k, z: v.z * k }
}
export function len(v: Point3): number {
  return Math.sqrt(dot(v, v))
}
export function norm(v: Point3): Point3 {
  const l = len(v) || 1
  return scale(v, 1 / l)
}
export function rotLocal(p: Point3, r: Point3 = { x: 0, y: 0, z: 0 }): Point3 {
  let { x, y, z } = p
  if (r.x) {
    const c = Math.cos(r.x)
    const s = Math.sin(r.x)
    const y2 = y * c - z * s
    z = y * s + z * c
    y = y2
  }
  if (r.y) {
    const c = Math.cos(r.y)
    const s = Math.sin(r.y)
    const x2 = x * c + z * s
    z = -x * s + z * c
    x = x2
  }
  if (r.z) {
    const c = Math.cos(r.z)
    const s = Math.sin(r.z)
    const x2 = x * c - y * s
    y = x * s + y * c
    x = x2
  }
  return { x, y, z }
}
