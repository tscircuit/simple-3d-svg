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
  const rounded = Math.round(n * 10) / 10
  return rounded % 1 === 0 ? rounded.toString() : rounded.toFixed(1)
}
function fmtPrecise(n: number): string {
  const rounded = Math.round(n * 100) / 100
  return rounded % 1 === 0 ? rounded.toString() : rounded.toFixed(2)
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
  // Map each depth-sorted Face if it actually represents an <image> triangle
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

    // Always calculate simple box vertices for text positioning
    const vc = bc // Save for text label positioning
    const vp = bp // Save for text label positioning

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
      // Handle regular box rendering (vertices already calculated above)

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
        const pts = TOP.map((i) => bw[i])
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

              // --- compute camera-space vertices once ---
              const c00 = toCam(
                lerp(lerp(dst[0], dst[1], u0), lerp(dst[3], dst[2], u0), v0),
                scene.camera,
              )
              const c10 = toCam(
                lerp(lerp(dst[0], dst[1], u1), lerp(dst[3], dst[2], u1), v0),
                scene.camera,
              )
              const c01 = toCam(
                lerp(lerp(dst[0], dst[1], u0), lerp(dst[3], dst[2], u0), v1),
                scene.camera,
              )
              const c11 = toCam(
                lerp(lerp(dst[0], dst[1], u1), lerp(dst[3], dst[2], u1), v1),
                scene.camera,
              )

              const p00 = proj(c00, W, H, focal)!
              const p10 = proj(c10, W, H, focal)!
              const p01 = proj(c01, W, H, focal)!
              const p11 = proj(c11, W, H, focal)!

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
                points: `${fmtPrecise(u0)},${fmtPrecise(v0)} ${fmtPrecise(u1)},${fmtPrecise(v0)} ${fmtPrecise(u1)},${fmtPrecise(v1)}`,
                sym,
              })
              // After pushing img for first triangle (p00,p10,p11)
              const triFace0: Face = {
                pts: [p00, p10, p11],
                cam: [c00, c10, c11],
                fill: "none",
                stroke: false,
              }
              faces.push(triFace0)
              faceToImg.set(triFace0, images[images.length - 1]!)

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
                points: `${fmtPrecise(u0)},${fmtPrecise(v0)} ${fmtPrecise(u1)},${fmtPrecise(v1)} ${fmtPrecise(u0)},${fmtPrecise(v1)}`,
                sym,
              })
              // After pushing img for second triangle (p00,p11,p01)
              const triFace1: Face = {
                pts: [p00, p11, p01],
                cam: [c00, c11, c01],
                fill: "none",
                stroke: false,
              }
              faces.push(triFace1)
              faceToImg.set(triFace1, images[images.length - 1]!)
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

  // Improved depth sorting - robust and performant
  function sortFacesByDepth(polys: Face[]): Face[] {
    if (polys.length <= 1) return polys

    // Calculate depth info for each face with better sorting criteria
    const facesWithDepth = polys.map((face, index) => {
      let minZ = Infinity
      let maxZ = -Infinity
      let sumZ = 0

      for (const pt of face.cam) {
        const z = pt.z
        if (z < minZ) minZ = z
        if (z > maxZ) maxZ = z
        sumZ += z
      }

      const avgZ = sumZ / face.cam.length
      const centerZ = (minZ + maxZ) / 2
      const depthRange = maxZ - minZ

      return {
        face,
        minZ,
        maxZ,
        avgZ,
        centerZ,
        depthRange,
        originalIndex: index,
      }
    })

    // Sort using a hierarchical comparison approach
    facesWithDepth.sort((a, b) => {
      const EPS = 1e-8

      // For nearly coplanar faces (small depth range), use average
      if (a.depthRange < EPS && b.depthRange < EPS) {
        const avgDiff = b.avgZ - a.avgZ
        if (Math.abs(avgDiff) > EPS) return avgDiff
        return a.originalIndex - b.originalIndex
      }

      // Primary: Use furthest point (maxZ) for back-to-front rendering
      const maxDiff = b.maxZ - a.maxZ
      if (Math.abs(maxDiff) > EPS) return maxDiff

      // Secondary: Use average depth for ties
      const avgDiff = b.avgZ - a.avgZ
      if (Math.abs(avgDiff) > EPS) return avgDiff

      // Tertiary: Use nearest point (minZ)
      const minDiff = b.minZ - a.minZ
      if (Math.abs(minDiff) > EPS) return minDiff

      // Final: Use original index for deterministic output
      return a.originalIndex - b.originalIndex
    })

    return facesWithDepth.map((item) => item.face)
  }

  const orderedFaces = sortFacesByDepth(faces)

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
