import type { Point3, STLMesh, Triangle, Color } from "../types"

const threeMfCache = new Map<string, STLMesh>()

export async function load3MF(url: string): Promise<STLMesh> {
  if (threeMfCache.has(url)) {
    return threeMfCache.get(url)!
  }

  const response = await fetch(url)
  const buffer = await response.arrayBuffer()
  const mesh = await parse3MF(buffer)
  threeMfCache.set(url, mesh)
  return mesh
}

interface ThreeMFVertex {
  x: number
  y: number
  z: number
}

interface ThreeMFTriangle {
  v1: number
  v2: number
  v3: number
}

interface ThreeMFObject {
  id: number
  vertices: ThreeMFVertex[]
  triangles: ThreeMFTriangle[]
  colors?: Color[]
}

async function parse3MF(buffer: ArrayBuffer): Promise<STLMesh> {
  // Parse 3MF file as a ZIP archive
  const files = await parseZipBuffer(buffer)
  const modelContent = files["3D/3dmodel.model"]
  if (!modelContent) {
    throw new Error("Invalid 3MF file: missing 3D/3dmodel.model")
  }

  const doc = parseXML(modelContent)

  const model = doc.querySelector("model")
  if (!model) {
    throw new Error("Invalid 3MF file: missing model element")
  }

  const objects = Array.from(model.querySelectorAll("object") as any).map(
    (obj: any) => parseObject(obj),
  )
  const triangles: Triangle[] = []

  for (const obj of objects) {
    for (const tri of obj.triangles) {
      const v0 = obj.vertices[tri.v1]!
      const v1 = obj.vertices[tri.v2]!
      const v2 = obj.vertices[tri.v3]!

      const edge1 = {
        x: v1.x - v0.x,
        y: v1.y - v0.y,
        z: v1.z - v0.z,
      }
      const edge2 = {
        x: v2.x - v0.x,
        y: v2.y - v0.y,
        z: v2.z - v0.z,
      }

      const normal = {
        x: edge1.y * edge2.z - edge1.z * edge2.y,
        y: edge1.z * edge2.x - edge1.x * edge2.z,
        z: -(edge1.x * edge2.y - edge1.y * edge2.x),
      }

      const length = Math.sqrt(
        normal.x * normal.x + normal.y * normal.y + normal.z * normal.z,
      )
      if (length > 0) {
        normal.x /= length
        normal.y /= length
        normal.z /= length
      }

      triangles.push({
        vertices: [
          { x: v0.x, y: -v0.z, z: v0.y },
          { x: v1.x, y: -v1.z, z: v1.y },
          { x: v2.x, y: -v2.z, z: v2.y },
        ] as [Point3, Point3, Point3],
        normal: {
          x: normal.x,
          y: -normal.z,
          z: normal.y,
        },
      })
    }
  }

  return {
    triangles,
    boundingBox: calculateBoundingBox(triangles),
  }
}

function parseObject(objectElement: Element): ThreeMFObject {
  const id = parseInt(objectElement.getAttribute("id") || "0")
  const vertices: ThreeMFVertex[] = []
  const triangles: ThreeMFTriangle[] = []

  const mesh = objectElement.querySelector("mesh")
  if (!mesh) {
    return { id, vertices, triangles }
  }

  const verticesElement = mesh.querySelector("vertices")
  if (verticesElement) {
    const vertexElements = verticesElement.querySelectorAll("vertex")
    for (const vertexEl of Array.from(vertexElements as any)) {
      const x = parseFloat((vertexEl as any).getAttribute("x") || "0")
      const y = parseFloat((vertexEl as any).getAttribute("y") || "0")
      const z = parseFloat((vertexEl as any).getAttribute("z") || "0")
      vertices.push({ x, y, z })
    }
  }

  const trianglesElement = mesh.querySelector("triangles")
  if (trianglesElement) {
    const triangleElements = trianglesElement.querySelectorAll("triangle")
    for (const triangleEl of Array.from(triangleElements as any)) {
      const v1 = parseInt((triangleEl as any).getAttribute("v1") || "0")
      const v2 = parseInt((triangleEl as any).getAttribute("v2") || "0")
      const v3 = parseInt((triangleEl as any).getAttribute("v3") || "0")
      triangles.push({ v1, v2, v3 })
    }
  }

  return { id, vertices, triangles }
}

function calculateBoundingBox(triangles: Triangle[]): {
  min: Point3
  max: Point3
} {
  if (triangles.length === 0) {
    return {
      min: { x: 0, y: 0, z: 0 },
      max: { x: 0, y: 0, z: 0 },
    }
  }

  let minX = Infinity
  let minY = Infinity
  let minZ = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  let maxZ = -Infinity

  for (const triangle of triangles) {
    for (const vertex of triangle.vertices) {
      minX = Math.min(minX, vertex.x)
      minY = Math.min(minY, vertex.y)
      minZ = Math.min(minZ, vertex.z)
      maxX = Math.max(maxX, vertex.x)
      maxY = Math.max(maxY, vertex.y)
      maxZ = Math.max(maxZ, vertex.z)
    }
  }

  return {
    min: { x: minX, y: minY, z: minZ },
    max: { x: maxX, y: maxY, z: maxZ },
  }
}

// Simple ZIP parser for 3MF files (ZIP archive with XML content)
async function parseZipBuffer(
  buffer: ArrayBuffer,
): Promise<Record<string, string>> {
  const view = new DataView(buffer)
  const files: Record<string, string> = {}

  // Look for ZIP central directory end record (0x06054b50)
  let centralDirOffset = -1
  for (let i = buffer.byteLength - 22; i >= 0; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      centralDirOffset = view.getUint32(i + 16, true) // Central directory offset
      break
    }
  }

  if (centralDirOffset === -1) {
    throw new Error("Invalid ZIP file: central directory not found")
  }

  // Read central directory entries
  let offset = centralDirOffset
  while (offset < buffer.byteLength) {
    const signature = view.getUint32(offset, true)
    if (signature !== 0x02014b46) break // Central file header signature

    const filenameLength = view.getUint16(offset + 28, true)
    const extraFieldLength = view.getUint16(offset + 30, true)
    const commentLength = view.getUint16(offset + 32, true)
    const localHeaderOffset = view.getUint32(offset + 42, true)

    // Read filename
    const filenameBytes = new Uint8Array(buffer, offset + 46, filenameLength)
    const filename = new TextDecoder().decode(filenameBytes)

    // Read local file header to get file data
    const localHeaderView = new DataView(buffer, localHeaderOffset)
    if (localHeaderView.getUint32(0, true) === 0x04034b50) {
      const localFilenameLength = localHeaderView.getUint16(26, true)
      const localExtraFieldLength = localHeaderView.getUint16(28, true)
      const compressedSize = localHeaderView.getUint32(18, true)
      const compressionMethod = localHeaderView.getUint16(8, true)

      const dataOffset =
        localHeaderOffset + 30 + localFilenameLength + localExtraFieldLength

      if (compressionMethod === 0) {
        // No compression
        const fileData = new Uint8Array(buffer, dataOffset, compressedSize)
        files[filename] = new TextDecoder().decode(fileData)
      } else {
        console.warn(
          `Compression method ${compressionMethod} not supported for file: ${filename}`,
        )
      }
    }

    offset += 46 + filenameLength + extraFieldLength + commentLength
  }

  return files
}

// Simple XML parser for 3MF model files
function parseXML(xmlContent: string): Document {
  // Try to use DOMParser if available (browser environment)
  if (typeof DOMParser !== "undefined") {
    const parser = new DOMParser()
    return parser.parseFromString(xmlContent, "application/xml")
  }

  // Fallback: create a minimal DOM-like structure for Node.js
  const doc: any = {
    querySelector: (selector: string) => {
      if (selector === "model") {
        return {
          querySelectorAll: (objSelector: string) => {
            if (objSelector === "object") {
              // Parse objects from XML manually
              const objects = []
              const objectMatches = xmlContent.match(
                /<object[^>]*>[\s\S]*?<\/object>/g,
              )
              if (objectMatches) {
                for (const objMatch of objectMatches) {
                  const obj = {
                    getAttribute: (attr: string) => {
                      const match = objMatch.match(
                        new RegExp(`${attr}="([^"]*)"`, "i"),
                      )
                      return match ? match[1] : null
                    },
                    querySelector: (meshSelector: string) => {
                      if (meshSelector === "mesh") {
                        return {
                          querySelector: (childSelector: string) => {
                            if (childSelector === "vertices") {
                              return {
                                querySelectorAll: (vertexSelector: string) => {
                                  if (vertexSelector === "vertex") {
                                    const vertices = []
                                    const vertexMatches =
                                      objMatch.match(/<vertex[^>]*\/>/g)
                                    if (vertexMatches) {
                                      for (const vertexMatch of vertexMatches) {
                                        vertices.push({
                                          getAttribute: (attr: string) => {
                                            const match = vertexMatch.match(
                                              new RegExp(
                                                `${attr}="([^"]*)"`,
                                                "i",
                                              ),
                                            )
                                            return match ? match[1] : "0"
                                          },
                                        })
                                      }
                                    }
                                    return vertices
                                  }
                                  return []
                                },
                              }
                            } else if (childSelector === "triangles") {
                              return {
                                querySelectorAll: (
                                  triangleSelector: string,
                                ) => {
                                  if (triangleSelector === "triangle") {
                                    const triangles = []
                                    const triangleMatches =
                                      objMatch.match(/<triangle[^>]*\/>/g)
                                    if (triangleMatches) {
                                      for (const triangleMatch of triangleMatches) {
                                        triangles.push({
                                          getAttribute: (attr: string) => {
                                            const match = triangleMatch.match(
                                              new RegExp(
                                                `${attr}="([^"]*)"`,
                                                "i",
                                              ),
                                            )
                                            return match ? match[1] : "0"
                                          },
                                        })
                                      }
                                    }
                                    return triangles
                                  }
                                  return []
                                },
                              }
                            }
                            return null
                          },
                        }
                      }
                      return null
                    },
                  }
                  objects.push(obj)
                }
              }
              return objects
            }
            return []
          },
        }
      }
      return null
    },
  }

  return doc as Document
}
