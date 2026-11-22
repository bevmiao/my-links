import { Check, Copy, Share2, X } from 'lucide-react'
import { generate } from 'lean-qr/nano'
import { useEffect, useId, useMemo, useRef, useState } from 'react'

/**
 * "Share" pop-up: a QR code for the public page, the address with a Copy button, and the phone's
 * share sheet where the browser has one. Loaded on demand (React.lazy in ProfileView), so the QR
 * encoder never adds to the page's own download. The QR code is generated in the browser by
 * lean-qr; nothing is sent to any service.
 *
 * Native <dialog>: focus is trapped while open, Esc closes it, and focus returns to the trigger.
 */
export default function ShareDialog({ url, name, onClose }: { url: string; name: string; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const [copied, setCopied] = useState(false)
  const canShare = typeof navigator !== 'undefined' && !!navigator.share
  const pretty = url.replace(/^https?:\/\//, '').replace(/\/$/, '')

  useEffect(() => {
    const d = ref.current
    if (d && !d.open) d.showModal()
  }, [])

  // Close the native dialog first (that returns focus to the Share button); the parent unmounts
  // this component on the dialog's `close` event.
  const dismiss = () => ref.current?.close()

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      /* clipboard blocked: the address is on screen and selectable */
    }
  }

  async function share() {
    try {
      await navigator.share({ title: name, url })
    } catch {
      /* cancelled */
    }
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) dismiss()
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-xs overflow-hidden rounded-(--p-radius-card) border border-(--p-border) bg-(--p-bg) p-0 text-(--p-fg) shadow-2xl backdrop:bg-black/50 backdrop:backdrop-blur-sm open:animate-pop-in"
    >
      <div className="relative p-5">
        <div className="flex items-start justify-between gap-3">
          <h2 id={titleId} className="font-display text-xl font-medium">
            Share my page
          </h2>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Close"
            className="-mt-2 -mr-2 grid size-11 place-items-center rounded-full text-(--p-muted) transition hover:rotate-90 hover:bg-(--p-card-hover) hover:text-(--p-fg) active:scale-90"
          >
            <X size={18} />
          </button>
        </div>
        <p className="mt-1 text-(length:--p-text-small) text-(--p-muted)">Point a phone camera at the code.</p>

        {/* Always dark on white, whatever the theme, so every camera can read it. */}
        <div className="mx-auto mt-4 w-full max-w-56 rounded-(--p-radius-inner) bg-white p-2 shadow-(--p-shadow)">
          <QrCode text={url} label={`QR code for ${pretty}`} />
        </div>

        <p className="mt-4 truncate text-center text-(length:--p-text-small) font-medium select-all">{pretty}</p>

        <div className={`mt-3 grid gap-2 ${canShare ? 'grid-cols-2' : 'grid-cols-1'}`}>
          <button
            type="button"
            onClick={copy}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-(--p-radius-chip) border border-(--p-border) bg-(--p-card) px-4 text-(length:--p-text-small) font-semibold transition hover:bg-(--p-card-hover) active:scale-95"
          >
            {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
            <span aria-live="polite">{copied ? 'Copied' : 'Copy link'}</span>
          </button>
          {canShare ? (
            <button
              type="button"
              onClick={share}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-(--p-radius-chip) bg-(--p-accent) px-4 text-(length:--p-text-small) font-semibold text-(--p-on-accent) transition hover:opacity-90 active:scale-95"
            >
              <Share2 size={16} aria-hidden="true" />
              Share…
            </button>
          ) : null}
        </div>
      </div>
    </dialog>
  )
}

/** The QR code as one SVG path (crisp at any size), with the standard 4-module quiet zone. */
function QrCode({ text, label }: { text: string; label: string }) {
  const { size, path } = useMemo(() => {
    const code = generate(text)
    let d = ''
    for (let y = 0; y < code.size; y++)
      for (let x = 0; x < code.size; x++) if (code.get(x, y)) d += `M${x + 4} ${y + 4}h1v1h-1z`
    return { size: code.size + 8, path: d }
  }, [text])
  return (
    <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} className="block h-auto w-full" shapeRendering="crispEdges">
      <rect width={size} height={size} fill="#fff" />
      <path d={path} fill="#000" />
    </svg>
  )
}
