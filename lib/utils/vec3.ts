type Point3 = { x: number; y: number; z: number }

function add(a: Point3, b: Point3): Point3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }
}
function sub(a: Point3, b: Point3): Point3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }
}
function dot(a: Point3, b: Point3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z
}
function cross(a: Point3, b: Point3): Point3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  }
}
function scale(v: Point3, k: number): Point3 {
  return { x: v.x * k, y: v.y * k, z: v.z * k }
}
function len(v: Point3): number {
  return Math.sqrt(dot(v, v))
}
function norm(v: Point3): Point3 {
  const l = len(v) || 1
  return scale(v, 1 / l)
}

export { add, sub, dot, cross, scale, len, norm }
