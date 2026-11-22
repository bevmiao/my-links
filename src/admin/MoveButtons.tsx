import { ArrowDown, ArrowUp } from 'lucide-react'
import { Button } from './ui'

/** Up / down buttons for reordering a list item (keyboard and screen-reader friendly). */
export function MoveButtons({ label, index, count, onMove }: { label: string; index: number; count: number; onMove: (to: number) => void }) {
  return (
    <div className="flex shrink-0">
      <Button variant="ghost" size="icon" aria-label={`Move ${label} up`} disabled={index === 0} onClick={() => onMove(index - 1)}>
        <ArrowUp size={14} />
      </Button>
      <Button variant="ghost" size="icon" aria-label={`Move ${label} down`} disabled={index === count - 1} onClick={() => onMove(index + 1)}>
        <ArrowDown size={14} />
      </Button>
    </div>
  )
}
