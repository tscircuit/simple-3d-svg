import { renderScene } from "../lib"
import { getModelBlobURL, warmupModelIdle } from "./model-loader"

const container = document.getElementById("svg-container") as HTMLDivElement

// Render into <img> instead of innerHTML to avoid parsing heavy SVG DOM
const img = document.createElement("img")
img.style.display = "block"
img.style.width = "100%"
img.style.height = "100%"
container.appendChild(img)

// Camera state
let yaw = 0.6
let pitch = 0.3
const radius = 30

// Interaction state
let dragging = false
let lastX = 0
let lastY = 0

// Render scheduling state
let rAFId: number | null = null
let pendingLowQ = false
let needHighQ = false
let rendering = false
let renderToken = 0
let currentBlobUrl: string | null = null
let lastPixelSize = 0

function getPixelSize(): number {
  const rect = container.getBoundingClientRect()
  return Math.max(1, Math.floor(rect.width))
}

function camPos() {
  return {
    x: radius * Math.cos(pitch) * Math.cos(yaw),
    y: radius * Math.sin(pitch),
    z: radius * Math.cos(pitch) * Math.sin(yaw),
  }
}

function lowQualityOpts(dim: number) {
  const d = Math.max(256, Math.floor(dim * 0.5))
  return { width: d, height: d, quality: "low" as const }
}

function highQualityOpts(dim: number) {
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1))
  const d = Math.floor(dim * dpr)
  return { width: d, height: d, quality: "high" as const }
}

function scheduleRender({ high = false } = {}) {
  if (high) needHighQ = true
  else pendingLowQ = true
  if (rAFId != null) return
  rAFId = requestAnimationFrame(tick)
}

function tick() {
  rAFId = null
  if (pendingLowQ && !rendering) {
    pendingLowQ = false
    void renderOnce({ high: false })
  }
  if (needHighQ && !rendering) {
    needHighQ = false
    void renderOnce({ high: true })
  }
  if ((pendingLowQ || needHighQ) && rAFId == null) {
    rAFId = requestAnimationFrame(tick)
  }
}

async function renderOnce({ high }: { high: boolean }) {
  rendering = true
  const token = ++renderToken
  const dim = getPixelSize()

  if (!high && Math.abs(dim - lastPixelSize) <= 1 && !dragging) {
    rendering = false
    return
  }

  try {
    const objUrl = await getModelBlobURL()
    const opts = high ? highQualityOpts(dim) : lowQualityOpts(dim)

    const svg = await renderScene(
      {
        boxes: [
          {
            center: { x: 0, y: 0, z: 0 },
            size: { x: 20, y: 20, z: 20 },
            drawBoundingBox: high ? true : false,
            objUrl,
          },
        ],
        camera: { position: camPos(), lookAt: { x: 0, y: 0, z: 0 } },
      },
      { width: opts.width, height: opts.height },
    )

    if (token !== renderToken) return

    const blob = new Blob([svg], { type: "image/svg+xml" })
    const url = URL.createObjectURL(blob)
    if (currentBlobUrl) URL.revokeObjectURL(currentBlobUrl)
    currentBlobUrl = url
    img.src = url

    if (high) lastPixelSize = dim
  } catch (err) {
    console.error(err)
  } finally {
    rendering = false
  }
}

// Pointer interactions
container.addEventListener("pointerdown", (ev) => {
  dragging = true
  container.setPointerCapture(ev.pointerId)
  lastX = ev.clientX
  lastY = ev.clientY
})

container.addEventListener("pointermove", (ev) => {
  if (!dragging) return
  const dx = ev.clientX - lastX
  const dy = ev.clientY - lastY
  lastX = ev.clientX
  lastY = ev.clientY
  yaw += dx * 0.01
  pitch += dy * 0.01
  if (pitch > Math.PI / 2 - 0.01) pitch = Math.PI / 2 - 0.01
  if (pitch < -Math.PI / 2 + 0.01) pitch = -Math.PI / 2 + 0.01
  scheduleRender({ high: false })
})

container.addEventListener("pointerup", (ev) => {
  if (!dragging) return
  dragging = false
  container.releasePointerCapture(ev.pointerId)
  scheduleRender({ high: true })
})

// Resize observer to trigger high quality render
const ro = new ResizeObserver(() => scheduleRender({ high: true }))
ro.observe(container)

// Warm up and initial render
warmupModelIdle()
scheduleRender({ high: true })

// Cleanup Blob URLs on unload
window.addEventListener("beforeunload", () => {
  if (currentBlobUrl) URL.revokeObjectURL(currentBlobUrl)
})
