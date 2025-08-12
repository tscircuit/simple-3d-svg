import JSZip from "jszip"
import type { Point3, STLMesh, Triangle } from "../types"

const threeMFCache = new Map<string, STLMesh>()

export async function load3MF(url: string): Promise<STLMesh> {
  if (threeMFCache.has(url)) return threeMFCache.get(url)!
  const res = await fetch(url)
  const buf = await res.arrayBuffer()
  const mesh = await parse3MF(buf)
  threeMFCache.set(url, mesh)
  return mesh
}

async function parse3MF(buffer: ArrayBuffer): Promise<STLMesh> {
  const zip = await JSZip.loadAsync(buffer)
  const modelFile = zip.file("3D/3dmodel.model")
  if (!modelFile) throw new Error("3MF file missing 3D/3dmodel.model")
  const xml = await modelFile.async("string")

  const vertices: Point3[] = []
  const vertexRegex = /<vertex\s+([^/>]+)\s*\/>/g
  let match: RegExpExecArray | null
  while ((match = vertexRegex.exec(xml))) {
    const attrs = parseAttrs(match[1]!)
    vertices.push({
      x: parseFloat(attrs.x ?? "0"),
      y: parseFloat(attrs.y ?? "0"),
      z: parseFloat(attrs.z ?? "0"),
    })
  }

  const triangles: Triangle[] = []
  const triangleRegex = /<triangle\s+([^/>]+)\s*\/>/g
  while ((match = triangleRegex.exec(xml))) {
    const attrs = parseAttrs(match[1]!)
    const v1 = vertices[parseInt(attrs.v1 ?? "0")]
    const v2 = vertices[parseInt(attrs.v2 ?? "0")]
    const v3 = vertices[parseInt(attrs.v3 ?? "0")]
    if (v1 && v2 && v3) {
      const edge1 = { x: v2.x - v1.x, y: v2.y - v1.y, z: v2.z - v1.z }
      const edge2 = { x: v3.x - v1.x, y: v3.y - v1.y, z: v3.z - v1.z }
      const normal: Point3 = {
        x: edge1.y * edge2.z - edge1.z * edge2.y,
        y: edge1.z * edge2.x - edge1.x * edge2.z,
        z: edge1.x * edge2.y - edge1.y * edge2.x,
      }
      triangles.push({ vertices: [v1, v2, v3], normal })
    }
  }

  const rotatedTriangles = triangles.map((t) => ({
    ...t,
    vertices: t.vertices.map((v) => ({ x: v.x, y: -v.z, z: v.y })) as [
      Point3,
      Point3,
      Point3,
    ],
    normal: { x: t.normal.x, y: -t.normal.z, z: t.normal.y },
  }))

  return {
    triangles: rotatedTriangles,
    boundingBox: calculateBoundingBox(rotatedTriangles),
  }
}

function calculateBoundingBox(triangles: Triangle[]): {
  min: Point3
  max: Point3
} {
  if (!triangles.length) {
    return {
      min: { x: 0, y: 0, z: 0 },
      max: { x: 0, y: 0, z: 0 },
    }
  }

  let minX = Infinity,
    minY = Infinity,
    minZ = Infinity
  let maxX = -Infinity,
    maxY = -Infinity,
    maxZ = -Infinity

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

function parseAttrs(s: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  for (const part of s.split(/\s+/)) {
    const [k, v] = part.split("=")
    if (k && v) attrs[k] = v.replace(/"/g, "")
  }
  return attrs
}
