// simple-svg-3d-renderer.ts (v4)
// STL loading support with preserved face image functionality
// ------------------------------------------------------

// Re-export types from types.ts
export type {
  Point3,
  RGBA,
  Color,
  Box,
  Camera,
  Scene,
  Triangle,
  STLMesh,
} from "./types"

// Re-export the main render function
export { renderScene } from "./render"

// Re-export STL loader
export { loadSTL } from "./loaders/stl"
