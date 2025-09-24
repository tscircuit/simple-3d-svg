import type { Point3, Color, Box, Camera, Scene, STLMesh } from "./types"
import { loadSTL } from "./loaders/stl"
import { loadOBJ } from "./loaders/obj"
import { load3MF } from "./loaders/threemf"
import { add, sub, dot, cross, scale, len, norm, rotLocal } from "./vec3"
import { colorToCss, shadeByNormal } from "./color"
import { scaleAndPositionMesh } from "./mesh"
import { FACES, EDGES, TOP, verts } from "./geometry"
import { affineMatrix } from "./affine"

function fmt(n: number): string {
  return Math.round(n).toString()
}
function fmtPrecise(n: number): string {
  return (Math.round(n * 100) / 100).toString()
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

type Face = {
  pts: Proj[] // 2-D projected points (SVG space)
  cam: Point3[] // the same vertices in CAMERA space (z>0)
  fill: string
  stroke: boolean
}
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
type RenderElement =
  | { type: "face"; data: Face }
  | { type: "image"; data: Img }
  | { type: "label"; data: Label }
  | { type: "edge"; data: Edge }

type TexSample = {
  uv: { x: number; y: number }
  cam: Point3
  proj: Proj
}

function triArea2D(tri: [TexSample, TexSample, TexSample]): number {
  const [a, b, c] = tri
  return (
    (b.proj.x - a.proj.x) * (c.proj.y - a.proj.y) -
    (b.proj.y - a.proj.y) * (c.proj.x - a.proj.x)
  )
}

function triangleError(
  tri: [TexSample, TexSample, TexSample],
  sample: (u: number, v: number) => TexSample | null,
): number {
  const barycentricWeights = [
    [0.5, 0.5, 0],
    [0, 0.5, 0.5],
    [0.5, 0, 0.5],
    [1 / 3, 1 / 3, 1 / 3],
  ] as const

  let maxErr = 0
  for (const [w0, w1, w2] of barycentricWeights) {
    const targetU = tri[0]!.uv.x * w0 + tri[1]!.uv.x * w1 + tri[2]!.uv.x * w2
    const targetV = tri[0]!.uv.y * w0 + tri[1]!.uv.y * w1 + tri[2]!.uv.y * w2
    const real = sample(targetU, targetV)
    if (!real) continue
    const px = tri[0]!.proj.x * w0 + tri[1]!.proj.x * w1 + tri[2]!.proj.x * w2
    const py = tri[0]!.proj.y * w0 + tri[1]!.proj.y * w1 + tri[2]!.proj.y * w2
    const dx = real.proj.x - px
    const dy = real.proj.y - py
    const err = Math.hypot(dx, dy)
    if (err > maxErr) maxErr = err
  }
  return maxErr
}

function keyForUV(u: number, v: number): string {
  return `${Math.round(u * 1e6) / 1e6}:${Math.round(v * 1e6) / 1e6}`
}

function subdivideTriangle(
  tri: [TexSample, TexSample, TexSample],
  sample: (u: number, v: number) => TexSample | null,
  maxDepth: number,
  pixelThreshold: number,
  depth = 0,
): [TexSample, TexSample, TexSample][] {
  if (depth >= maxDepth) return [tri]
  if (Math.abs(triArea2D(tri)) < 1e-6) return [tri]

  const err = triangleError(tri, sample)
  if (err <= pixelThreshold) return [tri]

  const mid = (u0: TexSample, u1: TexSample): TexSample | null => {
    const mu = (u0.uv.x + u1.uv.x) * 0.5
    const mv = (u0.uv.y + u1.uv.y) * 0.5
    return sample(mu, mv)
  }

  const m01 = mid(tri[0]!, tri[1]!)
  const m12 = mid(tri[1]!, tri[2]!)
  const m20 = mid(tri[2]!, tri[0]!)
  if (!m01 || !m12 || !m20) return [tri]

  const degenerate = (p: TexSample, q: TexSample) =>
    Math.hypot(p.proj.x - q.proj.x, p.proj.y - q.proj.y) < 1e-4
  if (
    degenerate(m01, tri[0]!) ||
    degenerate(m01, tri[1]!) ||
    degenerate(m12, tri[1]!) ||
    degenerate(m12, tri[2]!) ||
    degenerate(m20, tri[2]!) ||
    degenerate(m20, tri[0]!)
  ) {
    return [tri]
  }

  return [
    ...subdivideTriangle(
      [tri[0]!, m01, m20],
      sample,
      maxDepth,
      pixelThreshold,
      depth + 1,
    ),
    ...subdivideTriangle(
      [m01, tri[1]!, m12],
      sample,
      maxDepth,
      pixelThreshold,
      depth + 1,
    ),
    ...subdivideTriangle(
      [m20, m12, tri[2]!],
      sample,
      maxDepth,
      pixelThreshold,
      depth + 1,
    ),
    ...subdivideTriangle(
      [m01, m12, m20],
      sample,
      maxDepth,
      pixelThreshold,
      depth + 1,
    ),
  ]
}

export async function buildRenderElements(
  scene: Scene,
  opt: { width?: number; height?: number; backgroundColor?: Color } = {},
): Promise<{
  width: number
  height: number
  backgroundColor?: Color
  elements: RenderElement[]
  images: Img[]
  texId: Map<string, string>
}> {
  const W = opt.width ?? W_DEF
  const H = opt.height ?? H_DEF
  const focal = scene.camera.focalLength ?? FOCAL
  const faces: Face[] = []
  const images: Img[] = []
  // Map each BSP-sorted Face if it actually represents an <image> triangle
  const faceToImg = new Map<Face, Img>()
  const labels: Label[] = []
  const edges: Edge[] = []
  let clipSeq = 0
  const texId = new Map<string, string>()

  // Load STL meshes for boxes that have stlUrl
  const stlMeshes = new Map<string, STLMesh>()
  const objMeshes = new Map<string, STLMesh>()
  const threeMfMeshes = new Map<string, STLMesh>()
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
    if (box.threeMfUrl && !threeMfMeshes.has(box.threeMfUrl)) {
      try {
        const mesh = await load3MF(box.threeMfUrl)
        threeMfMeshes.set(box.threeMfUrl, mesh)
      } catch (error) {
        console.warn(`Failed to load 3MF from ${box.threeMfUrl}:`, error)
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
        "stl",
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
          const baseColor = box.color ?? "gray"
          faces.push({
            pts: [v0p, v1p, v2p],
            cam: [v0c, v1c, v2c],
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
        "obj",
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

          faces.push({
            pts: [v0p, v1p, v2p],
            cam: [v0c, v1c, v2c],
            fill: shadeByNormal(
              box.color ?? triangle.color ?? "gray",
              faceNormal,
            ),
            stroke: false,
          })
        }
      }
    } else if (box.threeMfUrl && threeMfMeshes.has(box.threeMfUrl)) {
      const mesh = threeMfMeshes.get(box.threeMfUrl)!
      const transformedVertices = scaleAndPositionMesh(
        mesh,
        box,
        box.scaleThreeMfToBox ?? false,
        "3mf",
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

          faces.push({
            pts: [v0p, v1p, v2p],
            cam: [v0c, v1c, v2c],
            fill: shadeByNormal(
              box.color ?? triangle.color ?? "gray",
              faceNormal,
            ),
            stroke: false,
          })
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
        let behind = false
        for (const i of idx) {
          const p = vp[i]
          if (!p) {
            behind = true
            break
          }
          p4.push(p)
        }
        if (behind) continue
        const cam4 = idx.map((i) => vc[i] as Point3)
        faces.push({
          pts: p4,
          cam: cam4,
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

          if (!texId.has(href)) {
            texId.set(href, `tex${texId.size}`)
          }
          const sym = texId.get(href)!

          const quality = Math.max(1, box.projectionSubdivision ?? 2)
          const pixelThreshold = 0.55 + 0.45 / quality
          const maxDepth = Math.max(
            1,
            Math.min(3, Math.ceil(Math.log2(quality)) - 2),
          )

          const sampleCache = new Map<string, TexSample>()
          const lerp = (a: Point3, b: Point3, t: number): Point3 => ({
            x: a.x * (1 - t) + b.x * t,
            y: a.y * (1 - t) + b.y * t,
            z: a.z * (1 - t) + b.z * t,
          })
          const bilinear = (u: number, v: number): Point3 => {
            const ab = lerp(dst[0], dst[1], u)
            const cd = lerp(dst[3], dst[2], u)
            return lerp(ab, cd, v)
          }

          const sample = (u: number, v: number): TexSample | null => {
            const key = keyForUV(u, v)
            const cached = sampleCache.get(key)
            if (cached) return cached
            const world = bilinear(u, v)
            const camPt = toCam(world, scene.camera)
            const projPt = proj(camPt, W, H, focal)
            if (!projPt) return null
            const value: TexSample = {
              uv: { x: u, y: v },
              cam: camPt,
              proj: projPt,
            }
            sampleCache.set(key, value)
            return value
          }

          const triA = [sample(0, 0), sample(1, 0), sample(1, 1)] as [
            TexSample,
            TexSample,
            TexSample,
          ]
          const triB = [sample(0, 0), sample(1, 1), sample(0, 1)] as [
            TexSample,
            TexSample,
            TexSample,
          ]
          if (triA.every(Boolean) && triB.every(Boolean)) {
            const texTris: [TexSample, TexSample, TexSample][] = []
            texTris.push(
              ...subdivideTriangle(triA, sample, maxDepth, pixelThreshold),
              ...subdivideTriangle(triB, sample, maxDepth, pixelThreshold),
            )

            for (const tri of texTris) {
              const mat = affineMatrix(
                tri.map((v) => ({ x: v.uv.x, y: v.uv.y })) as [
                  { x: number; y: number },
                  { x: number; y: number },
                  { x: number; y: number },
                ],
                tri.map((v) => v.proj) as [Proj, Proj, Proj],
              )
              const id = `clip${clipSeq++}`
              images.push({
                matrix: mat,
                depth: cz,
                href,
                clip: id,
                points: tri
                  .map((v) => `${fmtPrecise(v.uv.x)},${fmtPrecise(v.uv.y)}`)
                  .join(" "),
                sym,
              })
              const triFace: Face = {
                pts: tri.map((v) => v.proj) as [Proj, Proj, Proj],
                cam: tri.map((v) => v.cam) as [Point3, Point3, Point3],
                fill: "none",
                stroke: false,
              }
              faces.push(triFace)
              faceToImg.set(triFace, images[images.length - 1]!)
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

  // BSP sort faces before merging with other elements
  function sortFacesBSP(
    polys: Face[],
    W: number,
    H: number,
    focal: number,
  ): Face[] {
    const EPS = 1e-6
    type Node = {
      face: Face
      normal: Point3
      point: Point3
      front: Node | null
      back: Node | null
    }

    function build(list: Face[]): Node | null {
      if (!list.length) return null
      const face = list[0]!
      const p0 = face.cam[0]!
      const p1 = face.cam[1]!
      const p2 = face.cam[2]!
      const normal = cross(sub(p1, p0), sub(p2, p0))
      const front: Face[] = []
      const back: Face[] = []

      for (let k = 1; k < list.length; k++) {
        const f = list[k]!
        // classify each vertex
        let pos = 0,
          neg = 0
        const d: number[] = []
        for (const v of f.cam) {
          const dist = dot(normal, sub(v!, p0))
          d.push(dist)
          if (dist > EPS) pos++
          else if (dist < -EPS) neg++
        }
        if (!pos && !neg) {
          front.push(f) // coplanar – draw after splitter
        } else if (!pos) back.push(f)
        else if (!neg) front.push(f)
        else {
          // split polygon by plane
          const fFrontCam: Point3[] = []
          const fBackCam: Point3[] = []
          const fFront2D: Proj[] = []
          const fBack2D: Proj[] = []

          for (let i = 0; i < f.cam.length; i++) {
            const j = (i + 1) % f.cam.length
            const aCam = f.cam[i]!
            const bCam = f.cam[j]!
            const a2D = f.pts[i]!
            const b2D = f.pts[j]!
            const da = d[i]!
            const db = d[j]!

            const push = (
              arrCam: Point3[],
              arr2D: Proj[],
              cCam: Point3,
              c2D: Proj,
            ) => {
              arrCam.push(cCam)
              arr2D.push(c2D)
            }

            if (da >= -EPS) push(fFrontCam, fFront2D, aCam!, a2D!)
            if (da <= EPS) push(fBackCam, fBack2D, aCam!, a2D!)

            if ((da > 0 && db < 0) || (da < 0 && db > 0)) {
              const t = da / (da - db)
              const interCam = {
                x: aCam.x + (bCam.x - aCam.x) * t,
                y: aCam.y + (bCam.y - aCam.y) * t,
                z: aCam.z + (bCam.z - aCam.z) * t,
              }
              const inter2D = proj(interCam, W, H, focal)!
              push(fFrontCam, fFront2D, interCam, inter2D)
              push(fBackCam, fBack2D, interCam, inter2D)
            }
          }

          const mk = (cam: Point3[], pts: Proj[]): Face | null => {
            if (cam.length < 3) return null
            const nf: Face = { cam, pts, fill: f!.fill, stroke: false }
            const img = faceToImg.get(f)
            if (img) faceToImg.set(nf, img)
            return nf
          }
          const f1 = mk(fFrontCam, fFront2D)
          const f2 = mk(fBackCam, fBack2D)
          if (f1) front.push(f1)
          if (f2) back.push(f2)
        }
      }

      return {
        face,
        normal,
        point: p0,
        front: build(front),
        back: build(back),
      }
    }

    function traverse(node: Node | null, out: Face[]) {
      if (!node) return
      const cameraSide = dot(node.normal, scale(node.point, -1))
      if (cameraSide >= 0) {
        traverse(node.back, out)
        out.push(node.face)
        traverse(node.front, out)
      } else {
        traverse(node.front, out)
        out.push(node.face)
        traverse(node.back, out)
      }
    }

    const root = build(polys)
    const ordered: Face[] = []
    traverse(root, ordered)
    return ordered
  }

  const orderedFaces = sortFacesBSP(faces, W, H, focal)

  const elements: RenderElement[] = []
  for (const f of orderedFaces) {
    const img = faceToImg.get(f)
    if (img) {
      elements.push({ type: "image", data: img })
    } else {
      elements.push({ type: "face", data: f })
    }
  }
  elements.push(
    ...labels.map((l) => ({ type: "label" as const, data: l })),
    ...edges
      .sort((a, b) => a.depth - b.depth)
      .map((e) => ({ type: "edge" as const, data: e })),
  )

  return {
    width: W,
    height: H,
    backgroundColor: opt.backgroundColor,
    elements,
    images,
    texId,
  }
}
