import { expect, test } from "bun:test"
import { strToU8, zipSync } from "fflate"
import { load3MF, renderScene, type Point3 } from "../lib"

const tetrahedron = `
  <mesh>
    <vertices>
      <vertex x="0" y="0" z="0"/>
      <vertex x="1" y="0" z="0"/>
      <vertex x="0" y="1" z="0"/>
      <vertex x="0" y="0" z="1"/>
    </vertices>
    <triangles>
      <triangle v1="0" v2="2" v3="1" pid="9" p1="0"/>
      <triangle v1="0" v2="1" v3="3" pid="9" p1="0"/>
      <triangle v1="1" v2="2" v3="3" pid="9" p1="0"/>
      <triangle v1="2" v2="0" v3="3" pid="9" p1="0"/>
    </triangles>
  </mesh>`

function modelUrl(objects: string, items: string): string {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
    <model unit="millimeter" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
      <resources>
        <basematerials id="9"><base name="red" displaycolor="#FF0000FF"/></basematerials>
        ${objects}
      </resources>
      <build>${items}</build>
    </model>`
  return `data:application/octet-stream;base64,${Buffer.from(
    zipSync({ "3D/3dmodel.model": strToU8(xml) }),
  ).toString("base64")}`
}

const meshObject = `<object id="1" type="model">${tetrahedron}</object>`

test("3MF selects build objects instead of all resource objects", async () => {
  const mesh = await load3MF(
    modelUrl(
      `${meshObject}<object id="2" type="model">${tetrahedron}</object>`,
      '<item objectid="2"/>',
    ),
  )
  expect(mesh.triangles).toHaveLength(4)
  expect(mesh.boundingBox).toEqual({
    min: { x: 0, y: -1, z: 0 },
    max: { x: 1, y: -0, z: 1 },
  })
  expect(mesh.triangles[0]!.color).toEqual([255, 0, 0, 1])
})

test("3MF applies a build transform before converting to Y-up", async () => {
  const mesh = await load3MF(
    modelUrl(
      meshObject,
      '<item objectid="1" transform="1 0 0 0 1 0 0 0 1 2 3 4"/>',
    ),
  )
  expect(mesh.boundingBox).toEqual({
    min: { x: 2, y: -5, z: 3 },
    max: { x: 3, y: -4, z: 4 },
  })
})

test("3MF creates independent instances for repeated build items", async () => {
  const mesh = await load3MF(
    modelUrl(
      meshObject,
      '<item objectid="1"/><item objectid="1" transform="1 0 0 0 1 0 0 0 1 4 0 0"/>',
    ),
  )
  expect(mesh.triangles).toHaveLength(8)
  expect(mesh.triangles[0]!.vertices[0]).toEqual({ x: 0, y: -0, z: 0 })
  expect(mesh.triangles[4]!.vertices[0]).toEqual({ x: 4, y: -0, z: 0 })
  expect(mesh.boundingBox.max.x).toBe(5)
})

test("3MF composes nested component transforms from the inside out", async () => {
  // The inner translation (2, 0, 0) is rotated to (0, 2, 0), then
  // the outer build translation (10, 20, 30) is applied.
  const mesh = await load3MF(
    modelUrl(
      `${meshObject}
       <object id="2" type="model"><components>
         <component objectid="1" transform="1 0 0 0 1 0 0 0 1 2 0 0"/>
       </components></object>
       <object id="3" type="model"><components>
         <component objectid="2" transform="0 1 0 -1 0 0 0 0 1 0 0 0"/>
       </components></object>`,
      '<item objectid="3" transform="1 0 0 0 1 0 0 0 1 10 20 30"/>',
    ),
  )
  expect(mesh.triangles).toHaveLength(4)
  expect(mesh.boundingBox).toEqual({
    min: { x: 9, y: -31, z: 22 },
    max: { x: 10, y: -30, z: 23 },
  })
  expect(mesh.triangles[0]!.color).toEqual([255, 0, 0, 1])
})

function signedVolume(vertices: [Point3, Point3, Point3]): number {
  const [a, b, c] = vertices
  return (
    (a.x * (b.y * c.z - b.z * c.y) +
      a.y * (b.z * c.x - b.x * c.z) +
      a.z * (b.x * c.y - b.y * c.x)) /
    6
  )
}

test("3MF preserves triangle winding under reflected nonuniform scaling", async () => {
  const mesh = await load3MF(
    modelUrl(
      meshObject,
      '<item objectid="1" transform="-2 0 0 0 3 0 0 0 4 0 0 0"/>',
    ),
  )
  expect(mesh.boundingBox).toEqual({
    min: { x: -2, y: -4, z: 0 },
    max: { x: 0, y: -0, z: 3 },
  })
  expect(
    mesh.triangles.reduce((v, t) => v + signedVolume(t.vertices), 0),
  ).toBeCloseTo(4)
})

test("3MF does not render resources outside the build", async () => {
  const mesh = await load3MF(modelUrl(meshObject, ""))
  expect(mesh.triangles).toHaveLength(0)
})

test("3MF rejects missing object references", async () => {
  await expect(
    load3MF(modelUrl(meshObject, '<item objectid="99"/>')),
  ).rejects.toThrow("3MF object 99 not found")
})

test("3MF rejects circular component references", async () => {
  await expect(
    load3MF(
      modelUrl(
        '<object id="1"><components><component objectid="1"/></components></object>',
        '<item objectid="1"/>',
      ),
    ),
  ).rejects.toThrow("Circular 3MF object reference: 1")
})

test("3MF rejects incomplete transforms instead of producing NaN geometry", async () => {
  await expect(
    load3MF(modelUrl(meshObject, '<item objectid="1" transform="1 0 0"/>')),
  ).rejects.toThrow("Invalid 3MF transform")
})

test("3MF assembly renders the same geometry as equivalent build items", async () => {
  const transform = "1 0 0 0 1 0 0 0 1 3 0 0"
  const assembly = modelUrl(
    `${meshObject}<object id="2"><components>
       <component objectid="1"/><component objectid="1" transform="${transform}"/>
     </components></object>`,
    '<item objectid="2"/>',
  )
  const instances = modelUrl(
    meshObject,
    `<item objectid="1"/><item objectid="1" transform="${transform}"/>`,
  )
  const render = (url: string) =>
    renderScene({
      boxes: [
        {
          center: { x: 0, y: 0, z: 0 },
          size: { x: 4, y: 1, z: 1 },
          threeMfUrl: url,
        },
      ],
      camera: { position: { x: 6, y: 5, z: 7 }, lookAt: { x: 0, y: 0, z: 0 } },
    })
  const svg = await render(assembly)
  expect(svg).toContain("polygon")
  expect(svg).not.toContain("NaN")
  expect(svg).toBe(await render(instances))
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
