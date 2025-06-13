import type { Point3, RGBA, Color, Box, Camera, Scene, STLMesh } from "./types"
import { loadSTL } from "./loaders/stl"
import { loadOBJ } from "./loaders/obj"

/*────────────── Color Utility ─────────────*/
function colorToCss(c: Color): string {
  return typeof c === "string" ? c : `rgba(${c[0]},${c[1]},${c[2]},${c[3]})`
}

const NAMED_COLORS: Record<string, [number, number, number]> = {
  black: [0, 0, 0],
  silver: [192, 192, 192],
  gray: [128, 128, 128],
  grey: [128, 128, 128],
  white: [255, 255, 255],
  maroon: [128, 0, 0],
  red: [255, 0, 0],
  purple: [128, 0, 128],
  fuchsia: [255, 0, 255],
  green: [0, 128, 0],
  lime: [0, 255, 0],
  olive: [128, 128, 0],
  yellow: [255, 255, 0],
  navy: [0, 0, 128],
  blue: [0, 0, 255],
  teal: [0, 128, 128],
  aqua: [0, 255, 255],
  orange: [255, 165, 0],
}

function colorToRGBA(c: Color): RGBA {
  if (Array.isArray(c)) return c
  const s = c.trim().toLowerCase()
  if (s.startsWith("#")) {
    const hex = s.slice(1)
    if (hex.length === 3) {
      const r = parseInt(hex.charAt(0) + hex.charAt(0), 16)
      const g = parseInt(hex.charAt(1) + hex.charAt(1), 16)
      const b = parseInt(hex.charAt(2) + hex.charAt(2), 16)
      return [r, g, b, 1]
    }
    if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16)
      const g = parseInt(hex.slice(2, 4), 16)
      const b = parseInt(hex.slice(4, 6), 16)
      return [r, g, b, 1]
    }
  }
  const rgbm = s.match(/^rgba?\(([^)]+)\)$/)
  if (rgbm) {
    const content = rgbm[1]!
    const parts = content.split(/\s*,\s*/).map(Number)
    const [r = 0, g = 0, b = 0, a = 1] = parts
    return [r, g, b, a]
  }
  const named = NAMED_COLORS[s]
  if (named) return [named[0], named[1], named[2], 1]
  return [0, 0, 0, 1]
}

function lightenColor(c: Color, f: number): RGBA {
  const [r, g, b, a] = colorToRGBA(c)
  return [r + (255 - r) * f, g + (255 - g) * f, b + (255 - b) * f, a]
}

function darkenColor(c: Color, f: number): RGBA {
  const [r, g, b, a] = colorToRGBA(c)
  return [r * (1 - f), g * (1 - f), b * (1 - f), a]
}

function shadeByNormal(base: Color, normal: Point3): string {
  const n = norm(normal)
  if (n.z >= 0) {
    return colorToCss(lightenColor(base, n.z * 0.4))
  } else {
    return colorToCss(darkenColor(base, -n.z * 0.4))
  }
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
  [4, 7, 6, 5], // corrected order for the z-positive (camera-facing) side
  [0, 1, 5, 4],
  [3, 2, 6, 7],
  [1, 2, 6, 5],
  [0, 3, 7, 4],
] // front,back,bottom,top,right,left
const EDGES: [number, number][] = [
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

interface Point2 {
  x: number
  y: number
}

function inv3(m: [number, number, number][]): [number, number, number][] {
  const a = m[0]![0],
    d = m[0]![1],
    g = m[0]![2]
  const b = m[1]![0],
    e = m[1]![1],
    h = m[1]![2]
  const c = m[2]![0],
    f = m[2]![1],
    i = m[2]![2]
  const A = e * i - f * h
  const B = -(d * i - f * g)
  const C = d * h - e * g
  const D = -(b * i - c * h)
  const E = a * i - c * g
  const F = -(a * h - b * g)
  const G = b * f - c * e
  const H = -(a * f - c * d)
  const I = a * e - b * d
  const det = a * A + d * D + g * G
  const invDet = det ? 1 / det : 0
  return [
    [A * invDet, B * invDet, C * invDet],
    [D * invDet, E * invDet, F * invDet],
    [G * invDet, H * invDet, I * invDet],
  ]
}

function mul3(
  a: [number, number, number][],
  b: [number, number, number][],
): [number, number, number][] {
  const r: [number, number, number][] = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ]
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      r[i]![j] =
        a[i]![0]! * b[0]![j]! + a[i]![1]! * b[1]![j]! + a[i]![2]! * b[2]![j]!
    }
  }
  return r
}

function affineMatrix(
  src: [Point2, Point2, Point2],
  dst: [Point2, Point2, Point2],
): string {
  const S: [number, number, number][] = [
    [src[0].x, src[1].x, src[2].x],
    [src[0].y, src[1].y, src[2].y],
    [1, 1, 1],
  ]
  const D: [number, number, number][] = [
    [dst[0].x, dst[1].x, dst[2].x],
    [dst[0].y, dst[1].y, dst[2].y],
    [1, 1, 1],
  ]
  const M = mul3(D, inv3(S))
  return `matrix(${M[0]![0]} ${M[1]![0]} ${M[0]![1]} ${M[1]![1]} ${M[0]![2]} ${M[1]![2]})`
}

/*────────────── STL Mesh Processing ─────────────*/
function scaleAndPositionMesh(
  mesh: STLMesh,
  box: Box,
  scaleToBox: boolean,
): Point3[] {
  const { boundingBox } = mesh
  const meshCenter = scale(add(boundingBox.min, boundingBox.max), 0.5)

  // Rotate vertices around the mesh center
  const rotatedVerts: Point3[] = []
  for (const tri of mesh.triangles) {
    for (const v of tri.vertices) {
      let p = sub(v, meshCenter)
      if (box.stlRotation) p = rotLocal(p, box.stlRotation)
      if (box.objRotation) p = rotLocal(p, box.objRotation)
      p = add(p, meshCenter)
      rotatedVerts.push(p)
    }
  }

  let uniformScale = 1
  let rotatedCenter = { x: 0, y: 0, z: 0 }

  if (scaleToBox) {
    // Compute bounding box after rotation
    let min = { x: Infinity, y: Infinity, z: Infinity }
    let max = { x: -Infinity, y: -Infinity, z: -Infinity }
    for (const v of rotatedVerts) {
      if (v.x < min.x) min.x = v.x
      if (v.y < min.y) min.y = v.y
      if (v.z < min.z) min.z = v.z
      if (v.x > max.x) max.x = v.x
      if (v.y > max.y) max.y = v.y
      if (v.z > max.z) max.z = v.z
    }
    const rotatedSize = sub(max, min)
    const boxSize = box.size
    const scaleX = boxSize.x / rotatedSize.x
    const scaleY = boxSize.y / rotatedSize.y
    const scaleZ = boxSize.z / rotatedSize.z
    uniformScale = Math.min(scaleX, scaleY, scaleZ)
    rotatedCenter = scale(add(min, max), 0.5)
  }

  const transformedVertices: Point3[] = []
  for (const p of rotatedVerts) {
    let t = p
    if (scaleToBox) {
      t = sub(t, rotatedCenter)
      t = scale(t, uniformScale)
    }
    if (box.stlPosition) t = add(t, box.stlPosition)
    if (box.objPosition) t = add(t, box.objPosition)
    if (box.rotation) t = rotLocal(t, box.rotation)
    t = add(t, box.center)
    transformedVertices.push(t)
  }

  return transformedVertices
}

/*────────────── Render ─────────────*/
export async function renderScene(
  scene: Scene,
  opt: { width?: number; height?: number; backgroundColor?: Color } = {},
): Promise<string> {
  const W = opt.width ?? W_DEF
  const H = opt.height ?? H_DEF
  const focal = scene.camera.focalLength ?? FOCAL
  type Face = { pts: Proj[]; depth: number; fill: string; stroke: boolean }
  type Label = { matrix: string; depth: number; text: string; fill: string }
  type Img = {
    matrix: string
    depth: number
    href: string
    clip: string
    points: string
    sym?: string
  }
  type Edge = { pts: [Proj, Proj]; depth: number; color: string }
  const faces: Face[] = []
  const images: Img[] = []
  const labels: Label[] = []
  const edges: Edge[] = []
  let clipSeq = 0
  const texId = new Map<string, string>()

  // Load STL meshes for boxes that have stlUrl
  const stlMeshes = new Map<string, STLMesh>()
  const objMeshes = new Map<string, STLMesh>()
  for (const box of scene.boxes) {
    if (box.stlUrl && !stlMeshes.has(box.stlUrl)) {
      try {
        const mesh = await loadSTL(box.stlUrl)
        stlMeshes.set(box.stlUrl, mesh)
      } catch (error) {
        console.warn(`Failed to load STL from ${box.stlUrl}:`, error)
      }
    }
    if (box.objUrl && !objMeshes.has(box.objUrl)) {
      try {
        const mesh = await loadOBJ(box.objUrl)
        objMeshes.set(box.objUrl, mesh)
      } catch (error) {
        console.warn(`Failed to load OBJ from ${box.objUrl}:`, error)
      }
    }
  }

  for (const box of scene.boxes) {
    const bw = verts(box)
    const bc = bw.map((v) => toCam(v, scene.camera))
    const bp = bc.map((v) => proj(v, W, H, focal))

    if (box.drawBoundingBox) {
      for (const [a, b] of EDGES) {
        const pa = bp[a]
        const pb = bp[b]
        if (pa && pb) {
          const depth = Math.max(bc[a]!.z, bc[b]!.z)
          edges.push({ pts: [pa, pb], depth, color: "rgba(0,0,0,0.5)" })
        }
      }
    }

    // Handle STL rendering
    if (box.stlUrl && stlMeshes.has(box.stlUrl)) {
      const mesh = stlMeshes.get(box.stlUrl)!
      const transformedVertices = scaleAndPositionMesh(
        mesh,
        box,
        box.scaleStlToBox ?? false,
      )

      // Render STL triangles
      for (let i = 0; i < mesh.triangles.length; i++) {
        const triangle = mesh.triangles[i]
        const vertexStart = i * 3

        const v0w = transformedVertices[vertexStart]!
        const v1w = transformedVertices[vertexStart + 1]!
        const v2w = transformedVertices[vertexStart + 2]!

        const v0c = toCam(v0w, scene.camera)
        const v1c = toCam(v1w, scene.camera)
        const v2c = toCam(v2w, scene.camera)

        const v0p = proj(v0c, W, H, focal)
        const v1p = proj(v1c, W, H, focal)
        const v2p = proj(v2c, W, H, focal)

        if (v0p && v1p && v2p) {
          const edge1 = sub(v1c, v0c)
          const edge2 = sub(v2c, v0c)
          const normal = cross(edge1, edge2)
          const depth = Math.max(v0c.z, v1c.z, v2c.z)
          const baseColor = box.color ?? "gray"
          faces.push({
            pts: [v0p, v1p, v2p],
            depth,
            fill: shadeByNormal(baseColor, normal),
            stroke: false,
          })
        }
      }
    } else if (box.objUrl && objMeshes.has(box.objUrl)) {
      const mesh = objMeshes.get(box.objUrl)!
      const transformedVertices = scaleAndPositionMesh(
        mesh,
        box,
        box.scaleObjToBox ?? false,
      )

      for (let i = 0; i < mesh.triangles.length; i++) {
        const vertexStart = i * 3
        const triangle = mesh.triangles[i]!

        const v0w = transformedVertices[vertexStart]!
        const v1w = transformedVertices[vertexStart + 1]!
        const v2w = transformedVertices[vertexStart + 2]!

        const v0c = toCam(v0w, scene.camera)
        const v1c = toCam(v1w, scene.camera)
        const v2c = toCam(v2w, scene.camera)

        const v0p = proj(v0c, W, H, focal)
        const v1p = proj(v1c, W, H, focal)
        const v2p = proj(v2c, W, H, focal)

        if (v0p && v1p && v2p) {
          const edge1 = sub(v1c, v0c)
          const edge2 = sub(v2c, v0c)
          const faceNormal = cross(edge1, edge2)

          if (faceNormal.z < 0) {
            const depth = Math.max(v0c.z, v1c.z, v2c.z)
            faces.push({
              pts: [v0p, v1p, v2p],
              depth,
              fill: shadeByNormal(
                box.color ?? triangle.color ?? "gray",
                faceNormal,
              ),
              stroke: false,
            })
          }
        }
      }
    } else {
      // Handle regular box rendering
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
        faces.push({
          pts: p4,
          depth: zMax,
          fill: colorToCss(box.color ?? "gray"),
          stroke: true,
        })
      }

      // top face image
      if (box.faceImages?.top) {
        const pts = TOP.map((i) => vw[i])
        if (pts.every(Boolean)) {
          const dst = pts as [Point3, Point3, Point3, Point3]
          const cz = Math.max(...TOP.map((i) => vc[i]!.z))
          const href = box.faceImages.top

          // Assign unique texture ID
          if (!texId.has(href)) {
            texId.set(href, `tex${texId.size}`)
          }
          const sym = texId.get(href)!

          // Subdivide the face into projectionSubdivision x projectionSubdivision grid
          const subdivisions = box.projectionSubdivision ?? 2
          const quadsPerSide = subdivisions
          for (let row = 0; row < quadsPerSide; row++) {
            for (let col = 0; col < quadsPerSide; col++) {
              const u0 = col / quadsPerSide
              const u1 = (col + 1) / quadsPerSide
              const v0 = row / quadsPerSide
              const v1 = (row + 1) / quadsPerSide

              // Bilinear interpolation for quad corners in 3D space
              const lerp = (a: Point3, b: Point3, t: number): Point3 => ({
                x: a.x * (1 - t) + b.x * t,
                y: a.y * (1 - t) + b.y * t,
                z: a.z * (1 - t) + b.z * t,
              })

              const p00 = proj(
                toCam(
                  lerp(lerp(dst[0], dst[1], u0), lerp(dst[3], dst[2], u0), v0),
                  scene.camera,
                ),
                W,
                H,
                focal,
              )!
              const p10 = proj(
                toCam(
                  lerp(lerp(dst[0], dst[1], u1), lerp(dst[3], dst[2], u1), v0),
                  scene.camera,
                ),
                W,
                H,
                focal,
              )!
              const p01 = proj(
                toCam(
                  lerp(lerp(dst[0], dst[1], u0), lerp(dst[3], dst[2], u0), v1),
                  scene.camera,
                ),
                W,
                H,
                focal,
              )!
              const p11 = proj(
                toCam(
                  lerp(lerp(dst[0], dst[1], u1), lerp(dst[3], dst[2], u1), v1),
                  scene.camera,
                ),
                W,
                H,
                focal,
              )!

              // First triangle: p00, p10, p11
              const tri0Mat = affineMatrix(
                [
                  { x: u0, y: v0 },
                  { x: u1, y: v0 },
                  { x: u1, y: v1 },
                ],
                [p00, p10, p11],
              )
              const id0 = `clip${clipSeq++}`
              images.push({
                matrix: tri0Mat,
                depth: cz,
                href,
                clip: id0,
                points: `${u0},${v0} ${u1},${v0} ${u1},${v1}`,
                sym,
              })

              // Second triangle: p00, p11, p01
              const tri1Mat = affineMatrix(
                [
                  { x: u0, y: v0 },
                  { x: u1, y: v1 },
                  { x: u0, y: v1 },
                ],
                [p00, p11, p01],
              )
              const id1 = `clip${clipSeq++}`
              images.push({
                matrix: tri1Mat,
                depth: cz,
                href,
                clip: id1,
                points: `${u0},${v0} ${u1},${v1} ${u0},${v1}`,
                sym,
              })
            }
          }
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
  }

  // Combine all renderable elements and sort by depth
  type RenderElement =
    | { type: "face"; data: Face }
    | { type: "image"; data: Img }
    | { type: "label"; data: Label }
    | { type: "edge"; data: Edge }

  const allElements: RenderElement[] = [
    ...faces.map((f) => ({ type: "face" as const, data: f })),
    ...images.map((i) => ({ type: "image" as const, data: i })),
    ...labels.map((l) => ({ type: "label" as const, data: l })),
    ...edges.map((e) => ({ type: "edge" as const, data: e })),
  ]

  allElements.sort((a, b) => b.data.depth - a.data.depth)

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

  // Write defs section if we have images
  if (images.length) {
    out.push("  <defs>\n")

    // Write one <image> per unique texture
    for (const [href, id] of texId) {
      out.push(
        `    <image id="${id}" href="${href}" width="1" height="1" preserveAspectRatio="none" style="image-rendering:pixelated"/>\n`,
      )
    }

    // Write clip paths
    for (const img of images) {
      out.push(
        `    <clipPath id="${img.clip}" clipPathUnits="objectBoundingBox"><polygon points="${img.points}" /></clipPath>\n`,
      )
    }
    out.push("  </defs>\n")
  }

  // Render all elements in depth order with proper grouping
  let inStrokeGroup = false

  for (const element of allElements) {
    if (element.type === "face" || element.type === "image") {
      // Start stroke group if not already in one
      if (!inStrokeGroup) {
        out.push(
          '  <g stroke="#000" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">\n',
        )
        inStrokeGroup = true
      }

      if (element.type === "face") {
        const f = element.data
        const strokeAttr = f.stroke ? "" : ' stroke="none"'
        out.push(
          `    <polygon fill="${f.fill}"${strokeAttr} points="${f.pts
            .map((p) => `${p.x},${p.y}`)
            .join(" ")}" />\n`,
        )
      } else {
        const img = element.data
        out.push(
          `    <g transform="${img.matrix}" clip-path="url(#${img.clip})"><use href="#${img.sym}"/></g>\n`,
        )
      }
    } else if (element.type === "label") {
      // Close stroke group if we're in one
      if (inStrokeGroup) {
        out.push("  </g>\n")
        inStrokeGroup = false
      }

      const l = element.data
      out.push(
        `  <g font-family="sans-serif" font-size="14" text-anchor="middle" dominant-baseline="central" transform="${l.matrix}"><text x="0" y="0" fill="${l.fill}">${l.text}</text></g>\n`,
      )
    } else if (element.type === "edge") {
      if (inStrokeGroup) {
        out.push("  </g>\n")
        inStrokeGroup = false
      }
      const e = element.data
      out.push(
        `  <polyline fill="none" stroke="${e.color}" points="${e.pts
          .map((p) => `${p.x},${p.y}`)
          .join(" ")}" />\n`,
      )
    }
  }

  // Close stroke group if still open
  if (inStrokeGroup) {
    out.push("  </g>\n")
  }

  out.push("</svg>")
  return out.join("")
}
