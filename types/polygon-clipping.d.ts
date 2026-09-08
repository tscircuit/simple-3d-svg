declare module "polygon-clipping" {
  type Pair = [number, number]
  type Ring = Pair[]
  type Polygon = Ring[]
  type MultiPolygon = Polygon[]
  type Geom = Polygon | MultiPolygon

  interface PolygonClipping {
    intersection(geom: Geom, ...geoms: Geom[]): MultiPolygon
    union(geom: Geom, ...geoms: Geom[]): MultiPolygon
    xor(geom: Geom, ...geoms: Geom[]): MultiPolygon
    difference(subjectGeom: Geom, ...clipGeoms: Geom[]): MultiPolygon
  }

  const polygonClipping: PolygonClipping
  export default polygonClipping
}
