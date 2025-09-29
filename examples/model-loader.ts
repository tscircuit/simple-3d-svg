// Handles model download and caching using CacheStorage + Blob URL.
// Prevents repeated network fetch and ensures local reuse.

const RAW_MODEL_URL =
  "https://modelcdn.tscircuit.com/easyeda_models/download?uuid=6ef04b62f1e945518af209609f65fa6f&pn=C110153"

const CACHE_NAME = "models-v1"

let cachedBlobURL: string | null = null
let inflight: Promise<string> | null = null

export function warmupModelIdle() {
  const cb = () => getModelBlobURL().catch(() => {})
  if ("requestIdleCallback" in window) {
    ;(window as any).requestIdleCallback(cb)
  } else {
    setTimeout(cb, 800)
  }
}

export async function getModelBlobURL(): Promise<string> {
  if (cachedBlobURL) return cachedBlobURL
  if (inflight) return inflight

  inflight = (async () => {
    const cache = await caches.open(CACHE_NAME)
    const req = new Request(RAW_MODEL_URL, { mode: "cors" })

    let res = await cache.match(req)
    if (!res) {
      res = await fetchWithTimeout(req, 15000, { cache: "reload" })
      if (!res.ok) throw new Error(`Fetch model failed: ${res.status}`)
      cache.put(req, res.clone()).catch(() => {})
    }

    const blob = await res.blob()
    if (cachedBlobURL) URL.revokeObjectURL(cachedBlobURL)
    cachedBlobURL = URL.createObjectURL(blob)
    return cachedBlobURL
  })()

  try {
    return await inflight
  } finally {
    inflight = null
  }
}

function fetchWithTimeout(
  input: RequestInfo | URL,
  ms = 15000,
  init?: RequestInit,
) {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), ms)
  return fetch(input, { ...init, signal: controller.signal }).finally(() =>
    clearTimeout(id),
  )
}
