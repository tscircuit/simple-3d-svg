import fs from "fs"
import type { Point3 } from "../types"

export interface Triangle {
  a: Point3
  b: Point3
  c: Point3
}
export interface Mesh {
  triangles: Triangle[]
}

const cache = new Map<string, Mesh>()

export function loadStlMesh(url: string): Mesh {
  if (cache.has(url)) return cache.get(url)!
  let buf: Buffer
  if (url.startsWith("data:")) {
    const comma = url.indexOf(",")
    if (comma < 0) throw new Error("Invalid data url")
    const meta = url.slice(5, comma)
    const isBase64 = /;base64/i.test(meta)
    const data = url.slice(comma + 1)
    buf = isBase64
      ? Buffer.from(data, "base64")
      : Buffer.from(decodeURIComponent(data), "utf8")
  } else {
    buf = fs.readFileSync(url)
  }
  const mesh = parseStlBuffer(buf)
  cache.set(url, mesh)
  return mesh
}

function parseStlBuffer(buf: Buffer): Mesh {
  const head = buf.slice(0, 5).toString("utf8").toLowerCase()
  if (head === "solid") {
    return parseStlAscii(buf.toString("utf8"))
  }
  return parseStlBinary(buf)
}

function parseStlAscii(txt: string): Mesh {
  const tri: Triangle[] = []
  const re = /vertex\s+([\d+\-.eE]+)\s+([\d+\-.eE]+)\s+([\d+\-.eE]+)/gi
  let m: RegExpExecArray | null
  let verts: Point3[] = []
  while ((m = re.exec(txt))) {
    verts.push({
      x: parseFloat(m[1]),
      y: parseFloat(m[2]),
      z: parseFloat(m[3]),
    })
    if (verts.length === 3) {
      const [a, b, c] = verts
      tri.push({ a, b, c })
      verts = []
    }
  }
  return { triangles: tri }
}

function parseStlBinary(buf: Buffer): Mesh {
  const tri: Triangle[] = []
  const count = buf.readUInt32LE(80)
  let off = 84
  for (let i = 0; i < count; i++) {
    off += 12 // skip normal
    const a = {
      x: buf.readFloatLE(off),
      y: buf.readFloatLE(off + 4),
      z: buf.readFloatLE(off + 8),
    }
    off += 12
    const b = {
      x: buf.readFloatLE(off),
      y: buf.readFloatLE(off + 4),
      z: buf.readFloatLE(off + 8),
    }
    off += 12
    const c = {
      x: buf.readFloatLE(off),
      y: buf.readFloatLE(off + 4),
      z: buf.readFloatLE(off + 8),
    }
    off += 12
    off += 2 // attribute byte count
    tri.push({ a, b, c })
  }
  return { triangles: tri }
}
