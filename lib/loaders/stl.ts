import type { Point3 } from "../types"

export interface Triangle {
  a: Point3
  b: Point3
  c: Point3
}
export interface Mesh {
  triangles: Triangle[]
}

const cache = new Map<string, Promise<Mesh>>()

export async function loadStlMesh(url: string): Promise<Mesh> {
  if (cache.has(url)) return cache.get(url)!
  const p = (async () => {
    const res = await fetch(url)
    const arr = new Uint8Array(await res.arrayBuffer())
    return parseStlBuffer(arr)
  })()
  cache.set(url, p)
  return p
}

function parseStlBuffer(buf: Uint8Array): Mesh {
  const head = new TextDecoder().decode(buf.slice(0, 5)).toLowerCase()
  if (head === "solid") {
    return parseStlAscii(new TextDecoder().decode(buf))
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

function parseStlBinary(buf: Uint8Array): Mesh {
  const tri: Triangle[] = []
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  const count = view.getUint32(80, true)
  let off = 84
  for (let i = 0; i < count; i++) {
    off += 12 // skip normal
    const a = {
      x: view.getFloat32(off, true),
      y: view.getFloat32(off + 4, true),
      z: view.getFloat32(off + 8, true),
    }
    off += 12
    const b = {
      x: view.getFloat32(off, true),
      y: view.getFloat32(off + 4, true),
      z: view.getFloat32(off + 8, true),
    }
    off += 12
    const c = {
      x: view.getFloat32(off, true),
      y: view.getFloat32(off + 4, true),
      z: view.getFloat32(off + 8, true),
    }
    off += 12
    off += 2 // attribute byte count
    tri.push({ a, b, c })
  }
  return { triangles: tri }
}
