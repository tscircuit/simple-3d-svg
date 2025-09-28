import type { Box, STLMesh } from "./types"
import {
  add,
  clone,
  create,
  fromPoint,
  rotLocal,
  scale,
  sub,
  type Vec3,
} from "./vec3"

function rotationForModel(box: Box, modelType: "stl" | "obj" | "3mf") {
  if (modelType === "stl") return box.stlRotation
  if (modelType === "obj") return box.objRotation
  return box.threeMfRotation
}

function positionForModel(box: Box, modelType: "stl" | "obj" | "3mf") {
  if (modelType === "stl") return box.stlPosition
  if (modelType === "obj") return box.objPosition
  return box.threeMfPosition
}

export function scaleAndPositionMesh(
  mesh: STLMesh,
  box: Box,
  scaleToBox: boolean,
  modelType: "stl" | "obj" | "3mf",
): Float32Array[] {
  const { boundingBox } = mesh
  const meshMin = fromPoint(boundingBox.min)
  const meshMax = fromPoint(boundingBox.max)
  const meshCenter = scale(add(meshMin, meshMax), 0.5)
  const centerModel = box.centerModel !== false

  const perModelRotation = rotationForModel(box, modelType)
  const perModelPosition = positionForModel(box, modelType)
  const perModelPositionVec = perModelPosition
    ? fromPoint(perModelPosition)
    : null

  const rotatedVerts: Vec3[] = []
  for (const tri of mesh.triangles) {
    for (const v of tri.vertices) {
      const base = fromPoint(v)
      let p = sub(base, meshCenter)
      p = rotLocal(p, perModelRotation)
      if (!centerModel) {
        p = add(p, meshCenter)
      }
      rotatedVerts.push(p)
    }
  }

  let uniformScale = 1
  let rotatedCenter: Vec3 = create(0, 0, 0)

  if (scaleToBox && rotatedVerts.length) {
    const min = create(Infinity, Infinity, Infinity)
    const max = create(-Infinity, -Infinity, -Infinity)
    for (const v of rotatedVerts) {
      if (v[0]! < min[0]!) min[0] = v[0]!
      if (v[1]! < min[1]!) min[1] = v[1]!
      if (v[2]! < min[2]!) min[2] = v[2]!
      if (v[0]! > max[0]!) max[0] = v[0]!
      if (v[1]! > max[1]!) max[1] = v[1]!
      if (v[2]! > max[2]!) max[2] = v[2]!
    }
    const rotatedSize = sub(max, min)
    const boxSize = fromPoint(box.size)
    const scaleX = rotatedSize[0] ? boxSize[0]! / rotatedSize[0]! : 1
    const scaleY = rotatedSize[1] ? boxSize[1]! / rotatedSize[1]! : 1
    const scaleZ = rotatedSize[2] ? boxSize[2]! / rotatedSize[2]! : 1
    uniformScale = Math.min(scaleX, scaleY, scaleZ)
    rotatedCenter = scale(add(min, max), 0.5)
  }

  const boxCenter = fromPoint(box.center)
  const boxRotation = box.rotation
  const transformedTriangles: Float32Array[] = []

  let vertIndex = 0
  for (const tri of mesh.triangles) {
    const buffer = new Float32Array(9)
    for (let i = 0; i < 3; i++) {
      let t = rotatedVerts[vertIndex++]!
      if (scaleToBox) {
        t = sub(t, rotatedCenter)
        t = scale(t, uniformScale)
        if (!centerModel) {
          t = add(t, rotatedCenter)
        }
      } else {
        t = clone(t)
      }
      if (perModelPositionVec) {
        t = add(t, perModelPositionVec)
      }
      t = rotLocal(t, boxRotation)
      t = add(t, boxCenter)
      buffer[i * 3] = t[0]!
      buffer[i * 3 + 1] = t[1]!
      buffer[i * 3 + 2] = t[2]!
    }
    transformedTriangles.push(buffer)
  }

  return transformedTriangles
}
