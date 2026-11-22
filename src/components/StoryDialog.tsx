import { MapPin, X } from 'lucide-react'
import { useEffect, useId, useRef } from 'react'
import { SECTION_LABELS } from '../../shared/homepage'
import type { HomepageStory } from '../../shared/types'

/**
 * Pop-up card with the owner's story, opened by tapping the location on the Work page.
 * Native <dialog>: focus is trapped while open, Esc closes it, and focus returns to the trigger.
 */
export function StoryDialog({
  story,
  location,
  open,
  onClose,
}: {
  story: HomepageStory
  location: string
  open: boolean
  onClose: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md overflow-visible rounded-(--p-radius-card) border border-(--p-border) bg-(--p-bg) p-0 text-(--p-fg) shadow-2xl backdrop:bg-black/50 backdrop:backdrop-blur-sm open:animate-pop-in"
    >
      {open ? (
        <div className="relative overflow-hidden rounded-(--p-radius-card)">
          <div aria-hidden="true" className="grain absolute" />
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
        </div>
      ) : null}
    </dialog>
  )
}
