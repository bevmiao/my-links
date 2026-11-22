import { MapPin } from 'lucide-react'
import { useId } from 'react'
import { SECTION_LABELS } from '../../shared/homepage'
import type { HomepageStory } from '../../shared/types'
import { CloseButton, PopCard } from './PopCard'

/**
 * Pop-up card with the owner's story, opened by tapping the location on the Work page. It grows
 * out of the button that opened it and shrinks back into it when closed (see PopCard).
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
  const titleId = useId()
  return (
    <PopCard open={open} onClose={onClose} from={from} labelledBy={titleId} grain={grain}>
      <div className="flex items-start justify-between gap-4">
        <p className="inline-flex items-center gap-1.5 text-(length:--p-text-small) font-medium text-(--p-accent-text)">
          <MapPin size={15} aria-hidden="true" />
          {location}
        </p>
        <CloseButton onClick={onClose} />
      </div>
      <h2 id={titleId} className="mt-2 font-display text-2xl font-medium text-balance">
        {story.title || SECTION_LABELS.story}
      </h2>
      <p className="mt-3 text-(length:--p-text-body) leading-(--p-leading-body) whitespace-pre-line text-pretty text-(--p-fg)/85">
        {story.body}
      </p>
    </PopCard>
  )
}
