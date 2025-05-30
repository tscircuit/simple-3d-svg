import type { Box, Scene, Color, Camera, Point3 } from "./types"
import {
  colorToCss,
  add,
  sub,
  dot,
  cross,
  scale,
  len,
  norm,
  rotLocal,
} from "./math"
import { loadStlMesh, Mesh } from "./loaders/stl"

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

function renderBoxFaces(
  box: Box,
  faces: Face[],
  cam: Camera,
  W: number,
  H: number,
  focal: number,
) {
  const vw = verts(box)
  const vc = vw.map((v) => toCam(v, cam))
  const vp = vc.map((v) => proj(v, W, H, focal))
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
  return { vc, vp }
}

function renderMesh(
  box: Box,
  mesh: Mesh,
  faces: Face[],
  cam: Camera,
  W: number,
  H: number,
  focal: number,
) {
  let min = { x: Infinity, y: Infinity, z: Infinity }
  let max = { x: -Infinity, y: -Infinity, z: -Infinity }
  for (const t of mesh.triangles) {
    for (const v of [t.a, t.b, t.c]) {
      if (v.x < min.x) min.x = v.x
      if (v.y < min.y) min.y = v.y
      if (v.z < min.z) min.z = v.z
      if (v.x > max.x) max.x = v.x
      if (v.y > max.y) max.y = v.y
      if (v.z > max.z) max.z = v.z
    }
  }
  const size = { x: max.x - min.x, y: max.y - min.y, z: max.z - min.z }
  const center = {
    x: (min.x + max.x) / 2,
    y: (min.y + max.y) / 2,
    z: (min.z + max.z) / 2,
  }
  const scaleV = {
    x: size.x ? box.size.x / size.x : 1,
    y: size.y ? box.size.y / size.y : 1,
    z: size.z ? box.size.z / size.z : 1,
  }
  const posOff = box.stlPositionOffset ?? { x: 0, y: 0, z: 0 }
  const rotOff = box.stlRotationOffset ?? { x: 0, y: 0, z: 0 }
  for (const t of mesh.triangles) {
    const pts: Point3[] = []
    for (const v0 of [t.a, t.b, t.c]) {
      let v = sub(v0, center)
      v = { x: v.x * scaleV.x, y: v.y * scaleV.y, z: v.z * scaleV.z }
      v = rotLocal(v, rotOff)
      v = add(v, posOff)
      v = rotLocal(v, box.rotation)
      v = add(v, box.center)
      pts.push(v)
    }
    const vc = pts.map((p) => toCam(p, cam))
    const vp = vc.map((p) => proj(p, W, H, focal))
    if (vp.every(Boolean)) {
      const n = cross(sub(vc[1]!, vc[0]!), sub(vc[2]!, vc[0]!))
      if (n.z < 0) {
        const depth = Math.max(vc[0]!.z, vc[1]!.z, vc[2]!.z)
        faces.push({ pts: vp as Proj[], depth, fill: colorToCss(box.color) })
      }
    }
  }
}

type Face = { pts: Proj[]; depth: number; fill: string }
type Label = { matrix: string; depth: number; text: string; fill: string }

export function renderScene(
  scene: Scene,
  opt: { width?: number; height?: number; backgroundColor?: Color } = {},
): string {
  const W = opt.width ?? W_DEF
  const H = opt.height ?? H_DEF
  const focal = scene.camera.focalLength ?? FOCAL
  const faces: Face[] = []
  const labels: Label[] = []

  for (const box of scene.boxes) {
    if (box.stlUrl) {
      const mesh = loadStlMesh(box.stlUrl)
      renderMesh(box, mesh, faces, scene.camera, W, H, focal)
    } else {
      const { vc, vp } = renderBoxFaces(box, faces, scene.camera, W, H, focal)
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
            const cz = Math.max(...TOP.map((i) => vc[i]!.z))
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
  }

  faces.sort((a, b) => b.depth - a.depth)
  labels.sort((a, b) => b.depth - a.depth)

  const out: string[] = []
  out.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="${-W / 2} ${-H / 2} ${W} ${H}">`,
  )
  if (opt.backgroundColor) {
    out.push(
      `  <rect x="${-W / 2}" y="${-H / 2}" width="${W}" height="${H}" fill="${colorToCss(opt.backgroundColor)}" />\n`,
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
