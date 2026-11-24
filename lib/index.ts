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
export { renderScene } from "./render-svg"

// Re-export polygon visibility / culling helpers
export {
  areaOfPolygonCoveredByOtherPolygons,
  cullHiddenFaceElements,
  isPolygonCoveredByOtherPolygons,
  polygonArea,
} from "./polygon-culling"
export type { Point2, Polygon2D } from "./polygon-culling"

// Re-export STL loader
export { loadSTL } from "./loaders/stl"
// Re-export OBJ loader
export { loadOBJ } from "./loaders/obj"
// Re-export 3MF loader
export { load3MF } from "./loaders/threemf"
