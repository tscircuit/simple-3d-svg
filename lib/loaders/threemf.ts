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
  const vertexData =
    json?.model?.resources?.object?.mesh?.vertices?.vertex ?? []
  const verticesArr = Array.isArray(vertexData) ? vertexData : [vertexData]
  const vertices: Point3[] = verticesArr.map((v: any) => ({
    x: parseFloat(v["@_x"]),
    y: parseFloat(v["@_y"]),
    z: parseFloat(v["@_z"]),
  }))

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

  const triangleData =
    json?.model?.resources?.object?.mesh?.triangles?.triangle ?? []
  const trianglesArr = Array.isArray(triangleData)
    ? triangleData
    : [triangleData]
  const triangles: Triangle[] = trianglesArr.map((t: any) => {
    const v1 = vertices[parseInt(t["@_v1"])]!
    const v2 = vertices[parseInt(t["@_v2"])]!
    const v3 = vertices[parseInt(t["@_v3"])]!
    const edge1 = { x: v2.x - v1.x, y: v2.y - v1.y, z: v2.z - v1.z }
    const edge2 = { x: v3.x - v1.x, y: v3.y - v1.y, z: v3.z - v1.z }
    const normal = {
      x: edge1.y * edge2.z - edge1.z * edge2.y,
      y: edge1.z * edge2.x - edge1.x * edge2.z,
      z: -(edge1.x * edge2.y - edge1.y * edge2.x),
    }
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
