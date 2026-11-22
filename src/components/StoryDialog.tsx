import { MapPin, X } from 'lucide-react'
import { AnimatePresence } from 'motion/react'
import * as m from 'motion/react-m'
import { useEffect, useId, useRef } from 'react'
import { SECTION_LABELS } from '../../shared/homepage'
import type { HomepageStory } from '../../shared/types'

/**
 * Pop-up card with the owner's story, opened by tapping the location on the Work page. It grows
 * out of the button that opened it and shrinks back into it when closed.
 * Native <dialog>: focus is trapped while open, Esc closes it, and focus returns to the trigger.
 * The dialog is a full-screen transparent layer so the backdrop and card can animate; it is only
 * closed for real once the exit animation has finished.
 */
export function StoryDialog({
  story,
  location,
  open,
  onClose,
  grain = true,
  from,
}: {
  story: HomepageStory
  location: string
  open: boolean
  onClose: () => void
  /** Follows the owner's film-grain setting. */
  grain?: boolean
  /** On-screen box of the button that opened the dialog; the card grows out of it. */
  from?: DOMRect | null
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

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
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      className="fixed inset-0 m-0 size-full max-h-none max-w-none overflow-y-auto border-0 bg-transparent p-0 text-(--p-fg) backdrop:bg-transparent"
    >
      <AnimatePresence onExitComplete={() => ref.current?.close()}>
        {open ? (
          // The no-op exit keeps this wrapper mounted until the backdrop and card have animated out.
          <m.div key="story" className="relative grid min-h-full place-items-center p-4" exit={{ opacity: 1, transition: { duration: 0.26 } }}>
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
              className="relative w-full max-w-md overflow-hidden rounded-(--p-radius-card) border border-(--p-border) bg-(--p-bg) shadow-2xl"
            >
                {grain ? <div aria-hidden="true" className="grain absolute" /> : null}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -top-24 left-1/2 h-48 w-72 -translate-x-1/2 rounded-full blur-3xl"
                  style={{ background: 'color-mix(in srgb, var(--p-accent) 35%, transparent)' }}
                />
                <div className="relative p-6">
                  <div className="flex items-start justify-between gap-4">
                    <p className="inline-flex items-center gap-1.5 text-(length:--p-text-small) font-medium text-(--p-accent-text)">
                      <MapPin size={15} aria-hidden="true" />
                      {location}
                    </p>
                    <button
                      type="button"
                      onClick={onClose}
                      aria-label="Close"
                      className="-mt-1 -mr-1 grid size-11 place-items-center rounded-full text-(--p-muted) transition hover:rotate-90 hover:bg-(--p-card-hover) hover:text-(--p-fg) active:scale-90"
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <h2 id={titleId} className="mt-2 font-display text-2xl font-medium text-balance">
                    {story.title || SECTION_LABELS.story}
                  </h2>
                  <p className="mt-3 text-(length:--p-text-body) leading-(--p-leading-body) whitespace-pre-line text-pretty text-(--p-fg)/85">
                    {story.body}
                  </p>
                </div>
            </m.div>
          </m.div>
        ) : null}
      </AnimatePresence>
    </dialog>
  )
}
