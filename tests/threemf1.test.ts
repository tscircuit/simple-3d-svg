import { test, expect } from "bun:test"
import { renderScene, load3MF } from "../lib"
import { zipSync, strToU8 } from "fflate"

function create3mfDataUrl(): string {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
  <resources>
    <basematerials id="2">
      <base name="red" displaycolor="#FF0000FF"/>
      <base name="green" displaycolor="#00FF00FF"/>
      <base name="blue" displaycolor="#0000FFFF"/>
      <base name="yellow" displaycolor="#FFFF00FF"/>
    </basematerials>
    <object id="1" type="model">
      <mesh>
        <vertices>
          <vertex x="0" y="0" z="0"/>
          <vertex x="1" y="0" z="0"/>
          <vertex x="0" y="1" z="0"/>
          <vertex x="0" y="0" z="1"/>
        </vertices>
        <triangles>
          <triangle v1="0" v2="1" v3="2" pid="2" p1="0" p2="0" p3="0"/>
          <triangle v1="0" v2="1" v3="3" pid="2" p1="1" p2="1" p3="1"/>
          <triangle v1="1" v2="2" v3="3" pid="2" p1="2" p2="2" p3="2"/>
          <triangle v1="2" v2="0" v3="3" pid="2" p1="3" p2="3" p3="3"/>
        </triangles>
      </mesh>
    </object>
  </resources>
  <build>
    <item objectid="1"/>
  </build>
</model>`
  const data = zipSync({ "3D/3dmodel.model": strToU8(xml) })
  const base64 = Buffer.from(data).toString("base64")
  return `data:application/octet-stream;base64,${base64}`
}

const pyramid3mf = create3mfDataUrl()

test("3MF rendering", async () => {
  const mesh = await load3MF(pyramid3mf)
  expect(mesh.triangles[0]!.color).toEqual([255, 0, 0, 1])

  const scene = {
    boxes: [
      {
        center: { x: 0, y: 0, z: 0 },
        size: { x: 2, y: 2, z: 2 },
        threeMfUrl: pyramid3mf,
        scaleThreeMfToBox: true,
      },
    ],
    camera: {
      position: { x: 5, y: 5, z: 5 },
      lookAt: { x: 0, y: 0, z: 0 },
    },
  }

  const svg = await renderScene(scene)
  expect(svg).toContain("<svg")
  expect(svg).toContain("</svg>")
  expect(svg).toContain("polygon")

  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
