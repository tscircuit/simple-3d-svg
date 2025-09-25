import { useEffect, useRef, useState } from "react"
import { renderScene } from "../../lib"
import type { Scene } from "../../lib/types"

type Opt = Parameters<typeof renderScene>[1]

interface Props {
  scene: Scene
  opt?: Opt
}

export default function DragRotate({ scene, opt }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)

  // camera / drag state
  const yaw = useRef(0.6)
  const pitch = useRef(0.3)
  const radius = 30
  const dragging = useRef(false)
  const last = useRef({ x: 0, y: 0 })

  // performance optimization state
  const renderTimeout = useRef<NodeJS.Timeout | null>(null)
  const lastRenderTime = useRef(0)
  const isHighQuality = useRef(true)

  // viewport size – updated on every window resize
  const [size, setSize] = useState({ width: 0, height: 0 })

  const [svg, setSvg] = useState("")

  // helper to (re-)render with performance optimizations
  const redraw = async (force = false) => {
    if (!size.width || !size.height) return // size unknown yet

    const now = performance.now()
    const timeSinceLastRender = now - lastRenderTime.current

    // During drag, use lower quality and throttle renders
    const isDraggingNow = dragging.current
    const useHighQuality = !isDraggingNow || force
    const minRenderInterval = isDraggingNow ? 16 : 0 // ~60fps during drag, unlimited when not dragging

    // Skip render if too soon (unless forced)
    if (!force && timeSinceLastRender < minRenderInterval) {
      return
    }

    lastRenderTime.current = now
    isHighQuality.current = useHighQuality

    const dim = Math.min(size.width, size.height) // keep square aspect
    const camPos = {
      x: radius * Math.cos(pitch.current) * Math.cos(yaw.current),
      y: radius * Math.sin(pitch.current),
      z: radius * Math.cos(pitch.current) * Math.sin(yaw.current),
    }

    // Create adaptive scene with reduced subdivision during drag
    const adaptiveScene = {
      ...scene,
      camera: { ...scene.camera, position: camPos },
      boxes:
        isDraggingNow && !force
          ? scene.boxes.map((box) => ({
              ...box,
              // Reduce subdivision during drag for performance
              projectionSubdivision: Math.min(
                box.projectionSubdivision || 2,
                4,
              ),
            }))
          : scene.boxes,
    }

    const svgText = await renderScene(adaptiveScene, {
      ...opt,
      width: dim,
      height: dim,
    })
    setSvg(svgText.replace(/<\?xml[^>]*\?>\s*/g, ""))
  }

  // Throttled redraw for drag operations
  const scheduleRedraw = (immediate = false) => {
    if (renderTimeout.current) {
      clearTimeout(renderTimeout.current)
    }

    if (immediate) {
      redraw()
    } else {
      // Throttle renders during drag
      renderTimeout.current = setTimeout(
        () => {
          redraw()
        },
        dragging.current ? 8 : 0,
      ) // 8ms throttle during drag
    }
  }

  /* initial render + event handling */
  useEffect(() => {
    redraw(true) // Force high quality on initial render

    const md = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) return
      dragging.current = true
      last.current = { x: e.clientX, y: e.clientY }
    }
    const mm = (e: MouseEvent) => {
      if (!dragging.current) return
      const dx = e.clientX - last.current.x
      const dy = e.clientY - last.current.y
      last.current = { x: e.clientX, y: e.clientY }
      yaw.current += dx * 0.01
      pitch.current += dy * 0.01
      const lim = Math.PI / 2 - 0.01
      if (pitch.current > lim) pitch.current = lim
      if (pitch.current < -lim) pitch.current = -lim

      // Use throttled rendering during drag
      scheduleRedraw()
    }
    const mu = () => {
      dragging.current = false
      // Force high quality render when drag ends
      setTimeout(() => redraw(true), 50) // Small delay to ensure smooth transition
    }

    window.addEventListener("mousedown", md)
    window.addEventListener("mousemove", mm)
    window.addEventListener("mouseup", mu)
    return () => {
      window.removeEventListener("mousedown", md)
      window.removeEventListener("mousemove", mm)
      window.removeEventListener("mouseup", mu)
      if (renderTimeout.current) {
        clearTimeout(renderTimeout.current)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, opt, size]) // also when window size changes

  // track window-resize to keep `size` current
  useEffect(() => {
    const update = () =>
      setSize({ width: window.innerWidth, height: window.innerHeight })
    update() // initialise once mounted
    window.addEventListener("resize", update)
    return () => window.removeEventListener("resize", update)
  }, [])

  return (
    <div
      ref={containerRef}
      style={{ cursor: "grab", width: "100vmin", height: "100vmin" }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
