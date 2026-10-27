import type { Point3, STLMesh, Triangle } from "../types"
import { unzipSync } from "fflate"
import { XMLParser } from "fast-xml-parser"

const threeMfCache = new Map<string, STLMesh>()

export async function load3MF(url: string): Promise<STLMesh> {
  if (threeMfCache.has(url)) {
    return threeMfCache.get(url)!
  }

  const response = await fetch(url)
  const buffer = await response.arrayBuffer()
  const files = unzipSync(new Uint8Array(buffer))
  const modelFile = files["3D/3dmodel.model"]
  if (!modelFile) throw new Error("3MF model file not found")
  const modelXml = new TextDecoder().decode(modelFile)
  const mesh = parse3MF(modelXml)
  threeMfCache.set(url, mesh)
  return mesh
}

function parse3MF(xml: string): STLMesh {
  const parser = new XMLParser({ ignoreAttributes: false })
  const json = parser.parse(xml)
  const baseMaterials = json?.model?.resources?.basematerials
  const materialColors: Record<string, [number, number, number, number][]> = {}
  if (baseMaterials) {
    const mats = Array.isArray(baseMaterials) ? baseMaterials : [baseMaterials]
    for (const mat of mats) {
      const id = mat["@_id"]
      const bases = mat.base ?? []
      const basesArr = Array.isArray(bases) ? bases : [bases]
      materialColors[id] = basesArr.map((b: any) =>
        parseDisplayColor(b["@_displaycolor"]),
      )
    }
  }

  const objects = new Map<string, any>(
    asArray(json?.model?.resources?.object).map((object) => [
      String(object["@_id"]),
      object,
    ]),
  )
  const resolvedObjects = new Map<string, Triangle[]>()
  const resolving = new Set<string>()

  const resolveObject = (id: string): Triangle[] => {
    const cached = resolvedObjects.get(id)
    if (cached) return cached
    if (resolving.has(id)) {
      throw new Error(`Circular 3MF object reference: ${id}`)
    }
    const object = objects.get(id)
    if (!object) throw new Error(`3MF object ${id} not found`)

    resolving.add(id)
    const triangles = object.mesh
      ? parseMesh(object.mesh, materialColors)
      : asArray(object.components?.component).flatMap((component) =>
          transformTriangles(
            resolveObject(String(component["@_objectid"])),
            component["@_transform"],
          ),
        )
    resolving.delete(id)
    resolvedObjects.set(id, triangles)
    return triangles
  }

  // Resources are templates; only build items instantiate geometry. Resolve
  // components in object space, then apply each enclosing placement transform.
  const triangles = asArray(json?.model?.build?.item).flatMap((item) =>
    transformTriangles(
      resolveObject(String(item["@_objectid"])),
      item["@_transform"],
    ),
  )

  const rotatedTriangles = triangles.map((tri) => ({
    ...tri,
    vertices: tri.vertices.map((v) => ({
      x: v.x,
      y: -v.z,
      z: v.y,
    })) as [Point3, Point3, Point3],
    normal: {
      x: tri.normal.x,
      y: -tri.normal.z,
      z: tri.normal.y,
    },
  }))

  return {
    triangles: rotatedTriangles,
    boundingBox: calculateBoundingBox(rotatedTriangles),
  }
}

function asArray(value: any): any[] {
  return value == null ? [] : Array.isArray(value) ? value : [value]
}

function parseMesh(
  mesh: any,
  materialColors: Record<string, [number, number, number, number][]>,
): Triangle[] {
  const vertexData = mesh?.vertices?.vertex ?? []
  const verticesArr = Array.isArray(vertexData) ? vertexData : [vertexData]
  const vertices: Point3[] = verticesArr.map((v: any) => ({
    x: parseFloat(v["@_x"]),
    y: parseFloat(v["@_y"]),
    z: parseFloat(v["@_z"]),
  }))

  const triangleData = mesh?.triangles?.triangle ?? []
  const trianglesArr = Array.isArray(triangleData)
    ? triangleData
    : [triangleData]
  const triangles: Triangle[] = trianglesArr.map((t: any) => {
    const v1 = vertices[parseInt(t["@_v1"])]!
    const v2 = vertices[parseInt(t["@_v2"])]!
    const v3 = vertices[parseInt(t["@_v3"])]!
    const normal = calculateNormal([v1, v2, v3])
    let color
    const pid = t["@_pid"]
    if (pid && materialColors[pid]) {
      const idx = parseInt(t["@_p1"] ?? t["@_p2"] ?? t["@_p3"] ?? "0")
      color = materialColors[pid][idx]
    }
    return color
      ? { vertices: [v1, v2, v3], normal, color }
      : { vertices: [v1, v2, v3], normal }
  })

  return triangles
}

function calculateNormal([v1, v2, v3]: [Point3, Point3, Point3]): Point3 {
  const edge1 = { x: v2.x - v1.x, y: v2.y - v1.y, z: v2.z - v1.z }
  const edge2 = { x: v3.x - v1.x, y: v3.y - v1.y, z: v3.z - v1.z }
  return {
    x: edge1.y * edge2.z - edge1.z * edge2.y,
    y: edge1.z * edge2.x - edge1.x * edge2.z,
    z: -(edge1.x * edge2.y - edge1.y * edge2.x),
  }
}

function transformTriangles(
  triangles: Triangle[],
  transform?: string,
): Triangle[] {
  if (transform === undefined) return triangles
  const m = transform.trim().split(/\s+/).map(Number)
  if (m.length !== 12 || !m.every(Number.isFinite)) {
    throw new Error("Invalid 3MF transform: expected 12 finite numbers")
  }
  // 3MF uses row-vector affine transforms with translation in the last row.
  const determinant =
    m[0]! * (m[4]! * m[8]! - m[5]! * m[7]!) -
    m[1]! * (m[3]! * m[8]! - m[5]! * m[6]!) +
    m[2]! * (m[3]! * m[7]! - m[4]! * m[6]!)
  return triangles.map((triangle) => {
    const vertices = triangle.vertices.map((v) => ({
      x: v.x * m[0]! + v.y * m[3]! + v.z * m[6]! + m[9]!,
      y: v.x * m[1]! + v.y * m[4]! + v.z * m[7]! + m[10]!,
      z: v.x * m[2]! + v.y * m[5]! + v.z * m[8]! + m[11]!,
    })) as [Point3, Point3, Point3]
    // Reflections must preserve the sign of the mesh's volume (Core §3.3).
    if (determinant < 0) [vertices[1], vertices[2]] = [vertices[2], vertices[1]]
    return { ...triangle, vertices, normal: calculateNormal(vertices) }
  })
}

function parseDisplayColor(str: string): [number, number, number, number] {
  if (str?.startsWith("#")) {
    const hex = str.slice(1)
    if (hex.length === 8) {
      const r = parseInt(hex.slice(0, 2), 16)
      const g = parseInt(hex.slice(2, 4), 16)
      const b = parseInt(hex.slice(4, 6), 16)
      const a = parseInt(hex.slice(6, 8), 16) / 255
      return [r, g, b, a]
    }
    if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16)
      const g = parseInt(hex.slice(2, 4), 16)
      const b = parseInt(hex.slice(4, 6), 16)
      return [r, g, b, 1]
    }
  }
  return [0, 0, 0, 1]
}

function calculateBoundingBox(triangles: Triangle[]): {
  min: Point3
  max: Point3
} {
  if (triangles.length === 0) {
    return { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } }
  }

  let minX = Infinity
  let minY = Infinity
  let minZ = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  let maxZ = -Infinity

  for (const tri of triangles) {
    for (const v of tri.vertices) {
      if (v.x < minX) minX = v.x
      if (v.y < minY) minY = v.y
      if (v.z < minZ) minZ = v.z
      if (v.x > maxX) maxX = v.x
      if (v.y > maxY) maxY = v.y
      if (v.z > maxZ) maxZ = v.z
    }
  }

  return {
    min: { x: minX, y: minY, z: minZ },
    max: { x: maxX, y: maxY, z: maxZ },
  }
}
