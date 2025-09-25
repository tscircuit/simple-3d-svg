import { renderScene } from "../lib"

const svgContainer = document.getElementById("svg-container")!
function getDim() {
  return Math.min(window.innerWidth, window.innerHeight)
}

const objUrl =
  "https://modelcdn.tscircuit.com/easyeda_models/download?uuid=6ef04b62f1e945518af209609f65fa6f&pn=C110153&cachebust_origin="

let yaw = 0.6
let pitch = 0.3
const radius = 30
let isDragging = false
let lastX = 0
let lastY = 0
let renderTimeout: NodeJS.Timeout | null = null
let lastRenderTime = 0

async function render(force = false) {
  const now = performance.now()
  const timeSinceLastRender = now - lastRenderTime

  // During drag, throttle renders to ~60fps
  const minRenderInterval = isDragging ? 16 : 0

  // Skip render if too soon (unless forced)
  if (!force && timeSinceLastRender < minRenderInterval) {
    return
  }

  lastRenderTime = now

  const dim = getDim()
  const camPos = {
    x: radius * Math.cos(pitch) * Math.cos(yaw),
    y: radius * Math.sin(pitch),
    z: radius * Math.cos(pitch) * Math.sin(yaw),
  }

  const svg = await renderScene(
    {
      boxes: [
        {
          center: { x: 0, y: 0, z: 0 },
          size: { x: 20, y: 20, z: 20 },
          drawBoundingBox: true,
          objUrl,
        },
      ],
      camera: {
        position: camPos,
        lookAt: { x: 0, y: 0, z: 0 },
      },
    },
    { width: dim, height: dim },
  )

  svgContainer.innerHTML = svg.replace(/<\?xml[^>]*\?>\s*/g, "")
  svgContainer.style.width = `${dim}px`
  svgContainer.style.height = `${dim}px`
}

function scheduleRender(immediate = false) {
  if (renderTimeout) {
    clearTimeout(renderTimeout)
  }

  if (immediate) {
    render()
  } else {
    // Throttle renders during drag
    renderTimeout = setTimeout(
      () => {
        render()
      },
      isDragging ? 8 : 0,
    )
  }
}

svgContainer.addEventListener("mousedown", (ev) => {
  isDragging = true
  lastX = ev.clientX
  lastY = ev.clientY
})

window.addEventListener("mousemove", (ev) => {
  if (!isDragging) return
  const dx = ev.clientX - lastX
  const dy = ev.clientY - lastY
  lastX = ev.clientX
  lastY = ev.clientY
  yaw += dx * 0.01
  pitch += dy * 0.01
  if (pitch > Math.PI / 2 - 0.01) pitch = Math.PI / 2 - 0.01
  if (pitch < -Math.PI / 2 + 0.01) pitch = -Math.PI / 2 + 0.01
  scheduleRender()
})

window.addEventListener("mouseup", () => {
  isDragging = false
  // Force high quality render when drag ends
  setTimeout(() => render(true), 50)
})

// keep SVG square on resize
window.addEventListener("resize", () => render(true))

render(true) // Force high quality on initial render
