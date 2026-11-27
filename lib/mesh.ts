import { vec3 } from "gl-matrix"
import type { STLMesh, Box } from "./types"
import {
  add,
  createRotationMatrix,
  fromPoint,
  scale,
  subtract,
  transformMat4,
} from "./gl-vec3"

function accumulateOptionalPosition(out: vec3, box: Box) {
  if (box.stlPosition) add(out, out, fromPoint(box.stlPosition))
  if (box.objPosition) add(out, out, fromPoint(box.objPosition))
  if (box.threeMfPosition) add(out, out, fromPoint(box.threeMfPosition))
}

export function scaleAndPositionMesh(
  mesh: STLMesh,
  box: Box,
  scaleToBox: boolean,
  modelType: "stl" | "obj" | "3mf",
): Float32Array {
  const { boundingBox } = mesh
  const meshCenter = vec3.create()
  add(meshCenter, fromPoint(boundingBox.min), fromPoint(boundingBox.max))
  scale(meshCenter, meshCenter, 0.5)
  const centerModel = box.centerModel !== false

  const rotationMatrix =
    modelType === "stl"
      ? createRotationMatrix(box.stlRotation)
      : modelType === "obj"
        ? createRotationMatrix(box.objRotation)
        : createRotationMatrix(box.threeMfRotation)

  const rotatedVerts = new Float32Array(mesh.triangles.length * 9)
  const local = vec3.create()
  const rotated = vec3.create()
  let cursor = 0

  for (const tri of mesh.triangles) {
    for (const vertex of tri.vertices) {
      subtract(local, fromPoint(vertex), meshCenter)
      transformMat4(rotated, local, rotationMatrix)
      if (!centerModel) add(rotated, rotated, meshCenter)
      rotatedVerts[cursor++] = rotated[0]!
      rotatedVerts[cursor++] = rotated[1]!
      rotatedVerts[cursor++] = rotated[2]!
    }
  }

  let uniformScale = 1
  const rotatedCenter = vec3.create()

  if (scaleToBox) {
    const min = vec3.fromValues(Infinity, Infinity, Infinity)
    const max = vec3.fromValues(-Infinity, -Infinity, -Infinity)
    for (let i = 0; i < rotatedVerts.length; i += 3) {
      const x = rotatedVerts[i]!
      const y = rotatedVerts[i + 1]!
      const z = rotatedVerts[i + 2]!
      if (x < min[0]!) min[0] = x
      if (y < min[1]!) min[1] = y
      if (z < min[2]!) min[2] = z
      if (x > max[0]!) max[0] = x
      if (y > max[1]!) max[1] = y
      if (z > max[2]!) max[2] = z
    }
    const rotatedSize = vec3.create()
    subtract(rotatedSize, max, min)
    const boxSize = fromPoint(box.size)
    const scaleX = rotatedSize[0]! ? boxSize[0]! / rotatedSize[0]! : 1
    const scaleY = rotatedSize[1]! ? boxSize[1]! / rotatedSize[1]! : 1
    const scaleZ = rotatedSize[2]! ? boxSize[2]! / rotatedSize[2]! : 1
    uniformScale = Math.min(scaleX, scaleY, scaleZ)
    add(rotatedCenter, min, max)
    scale(rotatedCenter, rotatedCenter, 0.5)
  }

  const transformedVertices = new Float32Array(rotatedVerts.length)
  const translation = vec3.create()
  accumulateOptionalPosition(translation, box)
  const boxRotation = createRotationMatrix(box.rotation)
  const boxCenter = fromPoint(box.center)

  const transformed = vec3.create()
  for (let i = 0; i < rotatedVerts.length; i += 3) {
    vec3.set(
      transformed,
      rotatedVerts[i]!,
      rotatedVerts[i + 1]!,
      rotatedVerts[i + 2]!,
    )
    if (scaleToBox) {
      subtract(transformed, transformed, rotatedCenter)
      scale(transformed, transformed, uniformScale)
      if (!centerModel) add(transformed, transformed, rotatedCenter)
    }
    add(transformed, transformed, translation)
    transformMat4(transformed, transformed, boxRotation)
    add(transformed, transformed, boxCenter)
    transformedVertices[i] = transformed[0]!
    transformedVertices[i + 1] = transformed[1]!
    transformedVertices[i + 2] = transformed[2]!
  }

  return transformedVertices
}
