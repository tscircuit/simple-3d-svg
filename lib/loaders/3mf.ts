import type { Point3, STLMesh, Triangle } from "../types"
import { unzipSync, strFromU8 } from "fflate"

const mfCache = new Map<string, STLMesh>()

export async function load3MF(url: string): Promise<STLMesh> {
  if (mfCache.has(url)) return mfCache.get(url)!
  const response = await fetch(url)
  const buffer = await response.arrayBuffer()
  const mesh = parse3MF(buffer)
  mfCache.set(url, mesh)
  return mesh
}

function parse3MF(buffer: ArrayBuffer): STLMesh {
  const data = new Uint8Array(buffer)
  const files = unzipSync(data)
  const modelFile = files["3D/3dmodel.model"]
  if (!modelFile) throw new Error("3MF model file not found")
  const xmlText = strFromU8(modelFile)

  const vertexRegex =
    /<vertex[^>]*x="([^"]+)"[^>]*y="([^"]+)"[^>]*z="([^"]+)"[^>]*>/g
  const vertices: Point3[] = []
  let match: RegExpExecArray | null
  while ((match = vertexRegex.exec(xmlText))) {
    vertices.push({
      x: parseFloat(match[1]!),
      y: parseFloat(match[2]!),
      z: parseFloat(match[3]!),
    })
  }

  const triangleRegex =
    /<triangle[^>]*v1="([^"]+)"[^>]*v2="([^"]+)"[^>]*v3="([^"]+)"[^>]*>/g
  const triangles: Triangle[] = []
  while ((match = triangleRegex.exec(xmlText))) {
    const v1 = parseInt(match[1]!)
    const v2 = parseInt(match[2]!)
    const v3 = parseInt(match[3]!)
    const a = vertices[v1]!
    const b = vertices[v2]!
    const c = vertices[v3]!
    const edge1 = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z }
    const edge2 = { x: c.x - a.x, y: c.y - a.y, z: c.z - a.z }
    const normal = {
      x: edge1.y * edge2.z - edge1.z * edge2.y,
      y: edge1.z * edge2.x - edge1.x * edge2.z,
      z: edge1.x * edge2.y - edge1.y * edge2.x,
    }
    triangles.push({ vertices: [a, b, c], normal })
  }

  // Rotate -90 degrees around X to convert Z-up to Y-up
  const rotatedTriangles = triangles.map((triangle) => ({
    ...triangle,
    vertices: triangle.vertices.map((v) => ({
      x: v.x,
      y: -v.z,
      z: v.y,
    })) as [Point3, Point3, Point3],
    normal: {
      x: triangle.normal.x,
      y: -triangle.normal.z,
      z: triangle.normal.y,
    },
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
  if (triangles.length === 0) {
    return { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } }
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
