// simple-svg-3d-renderer.ts (v3)
// Top labels now align with the box's top face using an affine transform (rotation + skew).
// ------------------------------------------------------

/*────────────── Types ─────────────*/
export interface Point3 {
  x: number
  y: number
  z: number
}
export type RGBA = [number, number, number, number]
export type Color = RGBA | string

export interface Box {
  center: Point3
  size: Point3
  color: Color
  rotation?: Point3 // Euler radians
  topLabel?: string
  topLabelColor?: Color
  faceImages?: {
    top?: string
  }
}
export interface Camera {
  position: Point3
  lookAt: Point3
  focalLength?: number
}
export interface Scene {
  boxes: Box[]
  camera: Camera
}

/*────────────── Color Utility ─────────────*/
function colorToCss(c: Color): string {
  return typeof c === "string" ? c : `rgba(${c[0]},${c[1]},${c[2]},${c[3]})`
}

/*────────────── Vec3 ─────────────*/
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

/*────────────── Rotation ─────────────*/
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

/*────────────── Camera & Projection ─────────────*/
const W_DEF = 400
const H_DEF = 400
const FOCAL = 2
interface Proj {
  x: number
  y: number
  z: number
}
function axes(cam: Camera) {
  const f = norm(sub(cam.lookAt, cam.position))
  const wUp = { x: 0, y: 1, z: 0 }
  let r = norm(cross(f, wUp))
  if (!len(r)) r = { x: 1, y: 0, z: 0 }
  const u = cross(r, f)
  return { r, u, f }
}
function toCam(p: Point3, cam: Camera) {
  const { r, u, f } = axes(cam)
  const d = sub(p, cam.position)
  return { x: dot(d, r), y: dot(d, u), z: dot(d, f) }
}
function proj(p: Point3, w: number, h: number, focal: number): Proj | null {
  if (p.z <= 0) return null
  const s = focal / p.z
  return { x: (p.x * s * w) / 2, y: (-p.y * s * h) / 2, z: p.z }
}

/*────────────── Geometry ─────────────*/
const FACES: [number, number, number, number][] = [
  [0, 1, 2, 3],
  [4, 5, 6, 7],
  [0, 1, 5, 4],
  [3, 2, 6, 7],
  [1, 2, 6, 5],
  [0, 3, 7, 4],
] // front,back,bottom,top,right,left
const TOP = [3, 2, 6, 7]
function verts(b: Box): Point3[] {
  const {
    size: { x: sx, y: sy, z: sz },
    center,
    rotation,
  } = b
  const offs = [
    { x: -sx / 2, y: -sy / 2, z: -sz / 2 },
    { x: sx / 2, y: -sy / 2, z: -sz / 2 },
    { x: sx / 2, y: sy / 2, z: -sz / 2 },
    { x: -sx / 2, y: sy / 2, z: -sz / 2 },
    { x: -sx / 2, y: -sy / 2, z: sz / 2 },
    { x: sx / 2, y: -sy / 2, z: sz / 2 },
    { x: sx / 2, y: sy / 2, z: sz / 2 },
    { x: -sx / 2, y: sy / 2, z: sz / 2 },
  ]
  return offs.map((o) => add(center, rotLocal(o, rotation)))
}

/*────────────── Render ─────────────*/
export function renderScene(
  scene: Scene,
  opt: { width?: number; height?: number; backgroundColor?: Color } = {},
): string {
  const W = opt.width ?? W_DEF
  const H = opt.height ?? H_DEF
  const focal = scene.camera.focalLength ?? FOCAL
  type Face = { pts: Proj[]; depth: number; fill: string }
  type Label = { matrix: string; depth: number; text: string; fill: string }
  type Img = { matrix: string; depth: number; href: string }
  const faces: Face[] = []
  const images: Img[] = []
  const labels: Label[] = []

  for (const box of scene.boxes) {
    const vw = verts(box)
    const vc = vw.map((v) => toCam(v, scene.camera))
    const vp = vc.map((v) => proj(v, W, H, focal))

    // faces
    for (const idx of FACES) {
      const p4: Proj[] = []
      let zMax = -Infinity
      let behind = false
      for (const i of idx) {
        const p = vp[i]
        if (!p) {
          behind = true
          break
        }
        p4.push(p)
        zMax = Math.max(zMax, vc[i]!.z)
      }
      if (behind) continue
      const [a, b, c] = idx
      const n = cross(sub(vc[b]!, vc[a]!), sub(vc[c]!, vc[a]!))
      if (n.z >= 0) continue
      faces.push({
        pts: p4,
        depth: zMax,
        fill: colorToCss(box.color),
      })
    }

    // top face image
    if (box.faceImages?.top) {
      const pts = TOP.map((i) => vp[i])
      if (pts.every(Boolean)) {
        const p0 = pts[0] as Proj
        const p1 = pts[1] as Proj
        const p3 = pts[3] as Proj
        const u = sub(p1, p0)
        const v = sub(p3, p0)
        const cz = Math.max(...TOP.map((i) => vc[i]!.z))
        const m = `matrix(${u.x} ${u.y} ${v.x} ${v.y} ${p0.x} ${p0.y})`
        images.push({ matrix: m, depth: cz, href: box.faceImages.top })
      }
    }

    // top label
    if (box.topLabel) {
      const pts = TOP.map((i) => vp[i])
      if (pts.every(Boolean)) {
        const p0 = pts[0] as Proj
        const p1 = pts[1] as Proj
        const p3 = pts[3] as Proj
        const u = sub(p1, p0)
        const v = sub(p3, p0)
        const lu = len(u)
        const lv = len(v)
        if (lu && lv) {
          const uN = scale(u, 1 / lu)
          const vN = scale(v, 1 / lv)
          const cx = pts.reduce((s, p) => s + (p as Proj).x, 0) / 4
          const cy = pts.reduce((s, p) => s + (p as Proj).y, 0) / 4
          // use furthest top-face vertex so the label follows the face order
          const cz = Math.max(...TOP.map((i) => vc[i]!.z))
          // SVG transform matrix: [a b c d e f] where
          // x' = a*x + c*y + e ; y' = b*x + d*y + f
          const m = `matrix(${uN.x} ${uN.y} ${vN.x} ${vN.y} ${cx} ${cy})`
          const fillCol = box.topLabelColor ?? [0, 0, 0, 1]
          labels.push({
            matrix: m,
            depth: cz,
            text: box.topLabel,
            fill: colorToCss(fillCol),
          })
        }
      }
    }
  }

  faces.sort((a, b) => b.depth - a.depth)
  images.sort((a, b) => b.depth - a.depth)
  labels.sort((a, b) => b.depth - a.depth)

  const out: string[] = []
  out.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="${-W / 2} ${-H / 2} ${W} ${H}">`,
  )
  if (opt.backgroundColor) {
    out.push(
      `  <rect x="${-W / 2}" y="${-H / 2}" width="${W}" height="${H}" ` +
        `fill="${colorToCss(opt.backgroundColor)}" />\n`,
    )
  }
  out.push(
    '  <g stroke="#000" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">\n',
  )
  for (const f of faces) {
    out.push(
      `    <polygon fill="${f.fill}" points="${f.pts.map((p) => `${p.x},${p.y}`).join(" ")}" />\n`,
    )
  }
  out.push("  </g>\n")
  if (images.length) {
    out.push("  <g>\n")
    for (const img of images) {
      out.push(
        `    <g transform="${img.matrix}"><image href="${img.href}" x="0" y="0" width="1" height="1" preserveAspectRatio="none" /></g>\n`,
      )
    }
    out.push("  </g>\n")
  }
  out.push(
    '  <g font-family="sans-serif" font-size="14" text-anchor="middle" dominant-baseline="central">\n',
  )
  for (const l of labels) {
    out.push(
      `    <g transform="${l.matrix}"><text x=\"0\" y=\"0\" fill=\"${l.fill}\">${l.text}</text></g>\n`,
    )
  }
  out.push("  </g>\n</svg>")
  return out.join("")
}
