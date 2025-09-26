import type { Point3, Color, Box, Camera, Scene, STLMesh } from "./types"
import { loadSTL } from "./loaders/stl"
import { loadOBJ } from "./loaders/obj"
import { load3MF } from "./loaders/threemf"
import { add, sub, dot, cross, scale, len, norm } from "./vec3"
import { colorToCss, shadeByNormal } from "./color"
import { scaleAndPositionMesh } from "./mesh"
import { FACES, EDGES, TOP, verts } from "./geometry"
import { affineMatrix } from "./affine"

type CullSetting = boolean | "auto"

const resolveCullSetting = (
  boxSetting: CullSetting | undefined,
  globalSetting: CullSetting,
): CullSetting => {
  if (boxSetting === undefined) return globalSetting
  return boxSetting
}

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
interface CameraBasis {
  r: Point3
  u: Point3
  f: Point3
}

const computeCameraBasis = (cam: Camera): CameraBasis => {
  const forward = norm(sub(cam.lookAt, cam.position))
  const worldUp = { x: 0, y: 1, z: 0 }
  let right = cross(forward, worldUp)
  if (!len(right)) right = { x: 1, y: 0, z: 0 }
  right = norm(right)
  const up = cross(right, forward)
  return { r: right, u: up, f: forward }
}

const toCameraSpace = (p: Point3, camPos: Point3, basis: CameraBasis): Point3 => {
  const d = sub(p, camPos)
  return { x: dot(d, basis.r), y: dot(d, basis.u), z: dot(d, basis.f) }
}

type ProjectFunc = (p: Point3) => Proj | null

const createProjector = (width: number, height: number, focal: number): ProjectFunc => {
  const widthScale = (focal * width) / 2
  const heightScale = (focal * height) / 2
  return (p: Point3): Proj | null => {
    if (p.z <= 0) return null
    const invZ = 1 / p.z
    return {
      x: p.x * widthScale * invZ,
      y: -p.y * heightScale * invZ,
      z: p.z,
    }
  }
}

const isBackFacing = (
  a: Point3,
  b: Point3,
  c: Point3,
  camPos: Point3,
): boolean => {
  const abx = b.x - a.x
  const aby = b.y - a.y
  const abz = b.z - a.z
  const acx = c.x - a.x
  const acy = c.y - a.y
  const acz = c.z - a.z
  const nx = aby * acz - abz * acy
  const ny = abz * acx - abx * acz
  const nz = abx * acy - aby * acx
  const lenSq = nx * nx + ny * ny + nz * nz
  if (lenSq === 0) return false
  const vx = a.x - camPos.x
  const vy = a.y - camPos.y
  const vz = a.z - camPos.z
  return nx * vx + ny * vy + nz * vz >= 0
}

const distance2d = (a: Proj, b: Proj): number => {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.hypot(dx, dy)
}

const pickSubdivision = (
  base: number,
  projectedCorners: Proj[],
  targetPixelsPerQuad = 96,
): number => {
  if (!projectedCorners.length) return Math.max(1, base)
  const spans = [
    distance2d(projectedCorners[0]!, projectedCorners[1]!),
    distance2d(projectedCorners[1]!, projectedCorners[2]!),
    distance2d(projectedCorners[2]!, projectedCorners[3]!),
    distance2d(projectedCorners[3]!, projectedCorners[0]!),
  ]
  const maxSpan = Math.max(...spans)
  if (!Number.isFinite(maxSpan) || maxSpan === 0) return 1
  const desired = Math.ceil(maxSpan / targetPixelsPerQuad)
  return Math.max(1, Math.min(base, desired))
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
  opt: { width?: number; height?: number; backgroundColor?: Color; backfaceCulling: boolean },
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
  const cam = scene.camera
  const focal = cam.focalLength ?? FOCAL
  const cameraBasis = computeCameraBasis(cam)
  const camPosition = cam.position
  const project = createProjector(W, H, focal)
  const toCam = (p: Point3) => toCameraSpace(p, camPosition, cameraBasis)
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
    const bc = bw.map(toCam)
    const bp = bc.map((v) => project(v))

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

      const cullSetting = resolveCullSetting(
        box.backfaceCulling,
        opt.backfaceCulling,
      )

      const emit = (enableCull: boolean) => {
        const produced: Face[] = []
        let culled = 0
        for (let i = 0; i < mesh.triangles.length; i++) {
          const triangle = mesh.triangles[i]!
          const vertexStart = i * 3
          const v0w = transformedVertices[vertexStart]!
          const v1w = transformedVertices[vertexStart + 1]!
          const v2w = transformedVertices[vertexStart + 2]!

          if (enableCull && isBackFacing(v0w, v1w, v2w, camPosition)) {
            culled++
            continue
          }

          const v0c = toCam(v0w)
          const v1c = toCam(v1w)
          const v2c = toCam(v2w)

          const v0p = project(v0c)
          const v1p = project(v1c)
          const v2p = project(v2c)

          if (v0p && v1p && v2p) {
            const edge1 = sub(v1c, v0c)
            const edge2 = sub(v2c, v0c)
            const normal = cross(edge1, edge2)
            const baseColor = box.color ?? triangle.color ?? "gray"
            produced.push({
              pts: [v0p, v1p, v2p],
              cam: [v0c, v1c, v2c],
              fill: shadeByNormal(baseColor, normal),
              stroke: false,
            })
          }
        }
        return { produced, culled }
      }

      const initialCull = cullSetting === "auto" ? true : Boolean(cullSetting)
      let { produced, culled } = emit(initialCull)
      const total = produced.length + culled

      if (cullSetting === "auto" && total > 0 && produced.length < total * 0.15) {
        ;({ produced } = emit(false))
      }

      faces.push(...produced)
    } else if (box.objUrl && objMeshes.has(box.objUrl)) {
      const mesh = objMeshes.get(box.objUrl)!
      const transformedVertices = scaleAndPositionMesh(
        mesh,
        box,
        box.scaleObjToBox ?? false,
        "obj",
      )

      const cullSetting = resolveCullSetting(
        box.backfaceCulling,
        opt.backfaceCulling,
      )

      const emit = (enableCull: boolean) => {
        const produced: Face[] = []
        let culled = 0
        for (let i = 0; i < mesh.triangles.length; i++) {
          const triangle = mesh.triangles[i]!
          const vertexStart = i * 3
          const v0w = transformedVertices[vertexStart]!
          const v1w = transformedVertices[vertexStart + 1]!
          const v2w = transformedVertices[vertexStart + 2]!

          if (enableCull && isBackFacing(v0w, v1w, v2w, camPosition)) {
            culled++
            continue
          }

          const v0c = toCam(v0w)
          const v1c = toCam(v1w)
          const v2c = toCam(v2w)

          const v0p = project(v0c)
          const v1p = project(v1c)
          const v2p = project(v2c)

          if (v0p && v1p && v2p) {
            const edge1 = sub(v1c, v0c)
            const edge2 = sub(v2c, v0c)
            const faceNormal = cross(edge1, edge2)

            produced.push({
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
        return { produced, culled }
      }

      const initialCull = cullSetting === "auto" ? true : Boolean(cullSetting)
      let { produced, culled } = emit(initialCull)
      const total = produced.length + culled

      if (cullSetting === "auto" && total > 0 && produced.length < total * 0.15) {
        ;({ produced } = emit(false))
      }

      faces.push(...produced)
    } else if (box.threeMfUrl && threeMfMeshes.has(box.threeMfUrl)) {
      const mesh = threeMfMeshes.get(box.threeMfUrl)!
      const transformedVertices = scaleAndPositionMesh(
        mesh,
        box,
        box.scaleThreeMfToBox ?? false,
        "3mf",
      )

      const cullSetting = resolveCullSetting(
        box.backfaceCulling,
        opt.backfaceCulling,
      )

      const emit = (enableCull: boolean) => {
        const produced: Face[] = []
        let culled = 0
        for (let i = 0; i < mesh.triangles.length; i++) {
          const triangle = mesh.triangles[i]!
          const vertexStart = i * 3
          const v0w = transformedVertices[vertexStart]!
          const v1w = transformedVertices[vertexStart + 1]!
          const v2w = transformedVertices[vertexStart + 2]!

          if (enableCull && isBackFacing(v0w, v1w, v2w, camPosition)) {
            culled++
            continue
          }

          const v0c = toCam(v0w)
          const v1c = toCam(v1w)
          const v2c = toCam(v2w)

          const v0p = project(v0c)
          const v1p = project(v1c)
          const v2p = project(v2c)

          if (v0p && v1p && v2p) {
            const edge1 = sub(v1c, v0c)
            const edge2 = sub(v2c, v0c)
            const faceNormal = cross(edge1, edge2)

            produced.push({
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
        return { produced, culled }
      }

      const initialCull = cullSetting === "auto" ? true : Boolean(cullSetting)
      let { produced, culled } = emit(initialCull)
      const total = produced.length + culled

      if (cullSetting === "auto" && total > 0 && produced.length < total * 0.15) {
        ;({ produced } = emit(false))
      }

      faces.push(...produced)
    } else {
      // Handle regular box rendering
      const vw = verts(box)
      const vc = vw.map(toCam)
      const vp = vc.map((v) => project(v))

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

          // Assign unique texture ID
          if (!texId.has(href)) {
            texId.set(href, `tex${texId.size}`)
          }
          const sym = texId.get(href)!

          // Subdivide the face into projectionSubdivision x projectionSubdivision grid
          const projectedCorners = TOP.map((i) => vp[i]).filter(Boolean) as Proj[]
          let subdivisions = box.projectionSubdivision ?? 2
          if (projectedCorners.length === 4) {
            subdivisions = pickSubdivision(subdivisions, projectedCorners)
          }
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
              )
              const c10 = toCam(
                lerp(lerp(dst[0], dst[1], u1), lerp(dst[3], dst[2], u1), v0),
              )
              const c01 = toCam(
                lerp(lerp(dst[0], dst[1], u0), lerp(dst[3], dst[2], u0), v1),
              )
              const c11 = toCam(
                lerp(lerp(dst[0], dst[1], u1), lerp(dst[3], dst[2], u1), v1),
              )

              const p00 = project(c00)!
              const p10 = project(c10)!
              const p01 = project(c01)!
              const p11 = project(c11)!

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

  // BSP sort faces before merging with other elements
  function sortFacesBSP(polys: Face[], projectFn: ProjectFunc): Face[] {
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
              const inter2D = projectFn(interCam)!
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

  const orderedFaces = sortFacesBSP(faces, project)

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
