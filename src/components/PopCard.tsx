import { X } from 'lucide-react'
import { AnimatePresence } from 'motion/react'
import * as m from 'motion/react-m'
import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'

/**
 * Pop-up card that grows out of the element that opened it and shrinks back into it when closed.
 * Used by the story pop-up and the client cards.
 *
 * Native <dialog>: focus is trapped while open, Esc closes it, and focus returns to the trigger.
 * The dialog is a full-screen transparent layer so the backdrop and card can animate; it is only
 * closed for real once the exit animation has finished. Tall cards scroll inside the layer.
 */
export function PopCard({
  open,
  onClose,
  from,
  labelledBy,
  grain = true,
  className = 'max-w-md',
  palette,
  children,
}: {
  open: boolean
  onClose: () => void
  /** On-screen box of the element that opened the card; the card grows out of it. */
  from?: DOMRect | null
  /** id of the card's heading. */
  labelledBy: string
  /** Follows the owner's film-grain setting. */
  grain?: boolean
  /** Width of the card. */
  className?: string
  /** CSS variables for the card only, e.g. the light-mode palette for the client cards. */
  palette?: CSSProperties
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const d = ref.current
    if (d && open && !d.open) d.showModal()
  }, [open])

  // Start (and end) small, at the opener's position relative to the centre of the screen.
  const hidden = from
    ? {
        opacity: 0,
        scale: 0.35,
        x: from.left + from.width / 2 - window.innerWidth / 2,
        y: from.top + from.height / 2 - window.innerHeight / 2,
      }
    : { opacity: 0, scale: 0.96, x: 0, y: 12 }

  return (
    <dialog
      ref={ref}
      aria-labelledby={labelledBy}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      className="fixed inset-0 m-0 size-full max-h-none max-w-none overflow-y-auto border-0 bg-transparent p-0 text-(--p-fg) backdrop:bg-transparent"
    >
      <AnimatePresence onExitComplete={() => ref.current?.close()}>
        {open ? (
          // The no-op exit keeps this wrapper mounted until the backdrop and card have animated out.
          <m.div key="card" className="relative grid min-h-full place-items-center p-4" exit={{ opacity: 1, transition: { duration: 0.26 } }}>
            <m.div
              aria-hidden="true"
              className="fixed inset-0 bg-black/50 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { duration: 0.25 } }}
              exit={{ opacity: 0, transition: { duration: 0.22 } }}
              onClick={onClose}
            />
            <m.div
              initial={hidden}
              animate={{ opacity: 1, scale: 1, x: 0, y: 0, transition: { type: 'spring', stiffness: 380, damping: 30 } }}
              exit={{ ...hidden, transition: { duration: 0.22, ease: [0.4, 0, 1, 1] } }}
              style={palette}
              // text colour set here (not only on the dialog) so a `palette` on the card also applies to text.
              className={`relative w-full overflow-hidden rounded-(--p-radius-card) border border-(--p-border) bg-(--p-bg) text-(--p-fg) shadow-2xl ${className}`}
            >
              {grain ? <div aria-hidden="true" className="grain absolute" /> : null}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -top-24 left-1/2 h-48 w-72 -translate-x-1/2 rounded-full blur-3xl"
                style={{ background: 'color-mix(in srgb, var(--p-accent) 35%, transparent)' }}
              />
              <div className="relative p-6">{children}</div>
            </m.div>
          </m.div>
        ) : null}
      </AnimatePresence>
    </dialog>
  )
}

/** The round close button in a card's top-right corner. */
export function CloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Close"
      className="-mt-1 -mr-1 grid size-11 shrink-0 place-items-center rounded-full text-(--p-muted) transition hover:rotate-90 hover:bg-(--p-card-hover) hover:text-(--p-fg) active:scale-90"
    >
      <X size={18} />
    </button>
  )
}
