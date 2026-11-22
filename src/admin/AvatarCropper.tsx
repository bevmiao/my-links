import { Minus, Plus, RotateCcw } from 'lucide-react'
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type WheelEvent } from 'react'
import { encodeCanvas } from '../lib/shrinkImage'
import { Button, Modal } from './ui'

/** On-screen size of the square crop area (CSS px). */
const VIEW = 280
const MAX_ZOOM = 4
/** Pixel size of the saved square photo (never upscaled past the chosen area). */
const OUTPUT = 800

interface View {
  zoom: number
  /** Top-left of the image relative to the crop area, in CSS px. */
  x: number
  y: number
}

/**
 * "Position your photo": drag to move, slider / wheel / pinch-free buttons to zoom, arrow keys
 * to nudge. Saves a square crop of exactly what's inside the circle. Built on canvas only (no
 * dependency). The bitmap comes from createImageBitmap, which applies phone EXIF rotation.
 */
export function AvatarCropper({
  bitmap,
  fileName,
  maxBytes,
  onCancel,
  onSave,
}: {
  bitmap: ImageBitmap | null
  fileName: string
  maxBytes: number
  onCancel: () => void
  onSave: (file: File) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drag = useRef<{ id: number; px: number; py: number; x: number; y: number } | null>(null)
  const [view, setView] = useState<View>({ zoom: 1, x: 0, y: 0 })
  const [saving, setSaving] = useState(false)

  const base = bitmap ? VIEW / Math.min(bitmap.width, bitmap.height) : 1

  /** Keeps the photo covering the whole circle. */
  function clamp(v: View): View {
    if (!bitmap) return v
    const zoom = Math.min(MAX_ZOOM, Math.max(1, v.zoom))
    const s = base * zoom
    const w = bitmap.width * s
    const h = bitmap.height * s
    return { zoom, x: Math.min(0, Math.max(VIEW - w, v.x)), y: Math.min(0, Math.max(VIEW - h, v.y)) }
  }

  function centred(): View {
    if (!bitmap) return { zoom: 1, x: 0, y: 0 }
    return { zoom: 1, x: (VIEW - bitmap.width * base) / 2, y: (VIEW - bitmap.height * base) / 2 }
  }

  // New photo: start centred and fully zoomed out (state adjusted during render, React's
  // recommended pattern for resetting state when a prop changes).
  const [shown, setShown] = useState<ImageBitmap | null>(null)
  if (bitmap !== shown) {
    setShown(bitmap)
    setView(centred())
  }

  // Redraw the preview whenever the position changes.
  useEffect(() => {
    const c = canvasRef.current
    const ctx = c?.getContext('2d')
    if (!c || !ctx || !bitmap) return
    const dpr = window.devicePixelRatio || 1
    c.width = VIEW * dpr
    c.height = VIEW * dpr
    ctx.imageSmoothingQuality = 'high'
    const s = base * view.zoom * dpr
    ctx.clearRect(0, 0, c.width, c.height)
    ctx.drawImage(bitmap, view.x * dpr, view.y * dpr, bitmap.width * s, bitmap.height * s)
  }, [bitmap, view, base])

  /** Zoom, keeping the middle of the circle on the same spot of the photo. */
  function zoomTo(next: number) {
    setView((v) => {
      const s = base * v.zoom
      const ns = base * Math.min(MAX_ZOOM, Math.max(1, next))
      const cx = (VIEW / 2 - v.x) / s
      const cy = (VIEW / 2 - v.y) / s
      return clamp({ zoom: next, x: VIEW / 2 - cx * ns, y: VIEW / 2 - cy * ns })
    })
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { id: e.pointerId, px: e.clientX, py: e.clientY, x: view.x, y: view.y }
  }
  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    setView((v) => clamp({ ...v, x: d.x + e.clientX - d.px, y: d.y + e.clientY - d.py }))
  }
  function onPointerUp(e: PointerEvent<HTMLDivElement>) {
    if (drag.current?.id === e.pointerId) drag.current = null
  }
  function onWheel(e: WheelEvent<HTMLDivElement>) {
    zoomTo(view.zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08))
  }
  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const step = e.shiftKey ? 20 : 5
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [step, 0],
      ArrowRight: [-step, 0],
      ArrowUp: [0, step],
      ArrowDown: [0, -step],
    }
    if (moves[e.key]) {
      e.preventDefault()
      const [dx, dy] = moves[e.key]
      setView((v) => clamp({ ...v, x: v.x + dx, y: v.y + dy }))
    } else if (e.key === '+' || e.key === '=') zoomTo(view.zoom + 0.1)
    else if (e.key === '-') zoomTo(view.zoom - 0.1)
  }

  async function save() {
    if (!bitmap) return
    setSaving(true)
    try {
      const s = base * view.zoom
      const size = VIEW / s // side of the chosen square, in photo pixels
      const out = Math.max(1, Math.min(OUTPUT, Math.round(size)))
      const canvas = document.createElement('canvas')
      canvas.width = out
      canvas.height = out
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('This browser can’t edit photos.')
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(bitmap, -view.x / s, -view.y / s, size, size, 0, 0, out, out)
      const file = await encodeCanvas(canvas, maxBytes, fileName)
      if (!file) throw new Error('This browser couldn’t save that photo. Try a JPEG or PNG.')
      onSave(file)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={!!bitmap}
      onClose={onCancel}
      title="Position your photo"
      footer={
        <>
          <Button variant="ghost" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} loading={saving}>
            Save photo
          </Button>
        </>
      }
    >
      <div className="flex flex-col items-center gap-4">
        <p className="text-sm text-zinc-500">Drag to move. Use the slider to zoom.</p>
        <div
          role="application"
          aria-label="Photo position. Drag, or use the arrow keys to move and plus or minus to zoom."
          tabIndex={0}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={onWheel}
          onKeyDown={onKeyDown}
          className="relative cursor-grab touch-none overflow-hidden rounded-xl bg-zinc-100 outline-none select-none focus-visible:ring-2 focus-visible:ring-zinc-900 active:cursor-grabbing dark:bg-zinc-800 dark:focus-visible:ring-white"
          style={{ width: VIEW, height: VIEW }}
        >
          <canvas ref={canvasRef} className="block" style={{ width: VIEW, height: VIEW }} />
          {/* Dim everything outside the circle so it's clear what will show. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-full shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] ring-2 ring-white/80"
          />
        </div>
        <div className="flex w-full max-w-[280px] items-center gap-2">
          <Button variant="ghost" size="icon" aria-label="Zoom out" onClick={() => zoomTo(view.zoom - 0.2)} disabled={view.zoom <= 1}>
            <Minus size={16} />
          </Button>
          <input
            type="range"
            min={1}
            max={MAX_ZOOM}
            step={0.01}
            value={view.zoom}
            onChange={(e) => zoomTo(Number(e.target.value))}
            aria-label="Zoom"
            className="h-11 flex-1 cursor-pointer accent-zinc-900 dark:accent-white"
          />
          <Button variant="ghost" size="icon" aria-label="Zoom in" onClick={() => zoomTo(view.zoom + 0.2)} disabled={view.zoom >= MAX_ZOOM}>
            <Plus size={16} />
          </Button>
        </div>
        <Button variant="ghost" size="sm" icon={<RotateCcw size={14} />} onClick={() => setView(centred())}>
          Reset
        </Button>
      </div>
    </Modal>
  )
}
