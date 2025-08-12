import { expect, test } from "bun:test"
import { renderScene, load3MF } from "../lib/index"

test("renders a 3MF file", async () => {
  const scene = {
    boxes: [
      {
        center: { x: 0, y: 0, z: 0 },
        size: { x: 2, y: 2, z: 2 },
        threeMfUrl: "https://example.com/test.3mf",
        color: "blue" as const,
      },
    ],
    camera: {
      position: { x: 5, y: 5, z: 5 },
      lookAt: { x: 0, y: 0, z: 0 },
    },
  }

  // Mock fetch for 3MF file
  const original = global.fetch
  global.fetch = async (url: string): Promise<Response> => {
    if (url === "https://example.com/test.3mf") {
      // Create a minimal 3MF file as a ZIP archive
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
  <resources>
    <object id="1" type="model">
      <mesh>
        <vertices>
          <vertex x="0" y="0" z="0" />
          <vertex x="1" y="0" z="0" />
          <vertex x="0" y="1" z="0" />
          <vertex x="0" y="0" z="1" />
        </vertices>
        <triangles>
          <triangle v1="0" v2="1" v3="2" />
          <triangle v1="0" v2="2" v3="3" />
          <triangle v1="0" v2="3" v3="1" />
          <triangle v1="1" v2="3" v3="2" />
        </triangles>
      </mesh>
    </object>
  </resources>
  <build>
    <item objectid="1" />
  </build>
</model>`

      // Create uncompressed ZIP buffer manually
      const encoder = new TextEncoder()
      const xmlBytes = encoder.encode(xmlContent)

      // Local file header
      const filename = "3D/3dmodel.model"
      const filenameBytes = encoder.encode(filename)

      const localHeader = new ArrayBuffer(30 + filenameBytes.length)
      const localView = new DataView(localHeader)
      localView.setUint32(0, 0x04034b50, true) // Local file header signature
      localView.setUint16(4, 20, true) // Version needed to extract
      localView.setUint16(6, 0, true) // General purpose bit flag
      localView.setUint16(8, 0, true) // Compression method (0 = no compression)
      localView.setUint32(18, xmlBytes.length, true) // Compressed size
      localView.setUint32(22, xmlBytes.length, true) // Uncompressed size
      localView.setUint16(26, filenameBytes.length, true) // Filename length
      localView.setUint16(28, 0, true) // Extra field length

      // Copy filename
      new Uint8Array(localHeader, 30).set(filenameBytes)

      // Central directory header
      const centralHeader = new ArrayBuffer(46 + filenameBytes.length)
      const centralView = new DataView(centralHeader)
      centralView.setUint32(0, 0x02014b46, true) // Central file header signature
      centralView.setUint16(4, 20, true) // Version made by
      centralView.setUint16(6, 20, true) // Version needed to extract
      centralView.setUint16(8, 0, true) // General purpose bit flag
      centralView.setUint16(10, 0, true) // Compression method
      centralView.setUint32(20, xmlBytes.length, true) // Compressed size
      centralView.setUint32(24, xmlBytes.length, true) // Uncompressed size
      centralView.setUint16(28, filenameBytes.length, true) // Filename length
      centralView.setUint16(30, 0, true) // Extra field length
      centralView.setUint16(32, 0, true) // File comment length
      centralView.setUint32(42, 0, true) // Relative offset of local header

      // Copy filename
      new Uint8Array(centralHeader, 46).set(filenameBytes)

      // End of central directory record
      const endRecord = new ArrayBuffer(22)
      const endView = new DataView(endRecord)
      endView.setUint32(0, 0x06054b50, true) // End of central directory signature
      endView.setUint16(8, 1, true) // Total number of central directory records
      endView.setUint16(10, 1, true) // Total number of central directory records on this disk
      endView.setUint32(12, centralHeader.byteLength, true) // Size of central directory
      const centralDirOffset = localHeader.byteLength + xmlBytes.length
      endView.setUint32(16, centralDirOffset, true) // Offset of start of central directory

      // Combine all parts
      const totalSize =
        localHeader.byteLength +
        xmlBytes.length +
        centralHeader.byteLength +
        endRecord.byteLength
      const zipBuffer = new ArrayBuffer(totalSize)
      const zipView = new Uint8Array(zipBuffer)

      let offset = 0
      zipView.set(new Uint8Array(localHeader), offset)
      offset += localHeader.byteLength
      zipView.set(xmlBytes, offset)
      offset += xmlBytes.length
      zipView.set(new Uint8Array(centralHeader), offset)
      offset += centralHeader.byteLength
      zipView.set(new Uint8Array(endRecord), offset)

      return new Response(zipBuffer, {
        status: 200,
        headers: { "Content-Type": "application/octet-stream" },
      })
    }
    return original(url)
  }

  try {
    const svg = await renderScene(scene)
    expect(svg).toMatch(/^<svg/)
    expect(svg).toMatch(/<\/svg>$/)
    expect(svg.length).toBeGreaterThan(100)
  } finally {
    global.fetch = original
  }
})

test("load3MF function works", async () => {
  const original = global.fetch
  global.fetch = async (): Promise<Response> => {
    const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
  <resources>
    <object id="1" type="model">
      <mesh>
        <vertices>
          <vertex x="0" y="0" z="0" />
          <vertex x="1" y="0" z="0" />
          <vertex x="0" y="1" z="0" />
        </vertices>
        <triangles>
          <triangle v1="0" v2="1" v3="2" />
        </triangles>
      </mesh>
    </object>
  </resources>
</model>`

    const encoder = new TextEncoder()
    const xmlBytes = encoder.encode(xmlContent)

    // Simple uncompressed ZIP with just the model file
    const filename = "3D/3dmodel.model"
    const filenameBytes = encoder.encode(filename)

    const localHeader = new ArrayBuffer(30 + filenameBytes.length)
    const localView = new DataView(localHeader)
    localView.setUint32(0, 0x04034b50, true) // signature
    localView.setUint16(8, 0, true) // compression method
    localView.setUint32(18, xmlBytes.length, true) // compressed size
    localView.setUint32(22, xmlBytes.length, true) // uncompressed size
    localView.setUint16(26, filenameBytes.length, true) // filename length
    new Uint8Array(localHeader, 30).set(filenameBytes)

    const centralHeader = new ArrayBuffer(46 + filenameBytes.length)
    const centralView = new DataView(centralHeader)
    centralView.setUint32(0, 0x02014b46, true) // signature
    centralView.setUint16(10, 0, true) // compression method
    centralView.setUint32(20, xmlBytes.length, true) // compressed size
    centralView.setUint32(24, xmlBytes.length, true) // uncompressed size
    centralView.setUint16(28, filenameBytes.length, true) // filename length
    centralView.setUint32(42, 0, true) // local header offset
    new Uint8Array(centralHeader, 46).set(filenameBytes)

    const endRecord = new ArrayBuffer(22)
    const endView = new DataView(endRecord)
    endView.setUint32(0, 0x06054b50, true) // signature
    endView.setUint16(8, 1, true) // number of entries
    endView.setUint16(10, 1, true) // number of entries on disk
    endView.setUint32(12, centralHeader.byteLength, true) // central dir size
    endView.setUint32(16, localHeader.byteLength + xmlBytes.length, true) // central dir offset

    const totalSize =
      localHeader.byteLength +
      xmlBytes.length +
      centralHeader.byteLength +
      endRecord.byteLength
    const zipBuffer = new ArrayBuffer(totalSize)
    const zipView = new Uint8Array(zipBuffer)

    let offset = 0
    zipView.set(new Uint8Array(localHeader), offset)
    offset += localHeader.byteLength
    zipView.set(xmlBytes, offset)
    offset += xmlBytes.length
    zipView.set(new Uint8Array(centralHeader), offset)
    offset += centralHeader.byteLength
    zipView.set(new Uint8Array(endRecord), offset)

    return new Response(zipBuffer)
  }

  try {
    const mesh = await load3MF("test.3mf")
    expect(mesh.triangles).toHaveLength(1)
    expect(mesh.triangles[0]?.vertices).toHaveLength(3)
    expect(mesh.boundingBox).toBeDefined()
  } finally {
    global.fetch = original
  }
})
