type Point3 = { x: number; y: number; z: number }

function rotLocal(p: Point3, r: Point3 = { x: 0, y: 0, z: 0 }): Point3 {
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

export { rotLocal }
