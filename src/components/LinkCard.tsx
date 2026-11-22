import { ArrowUpRight } from 'lucide-react'
import type { ButtonStyle, PublicLink } from '../../shared/types'
import { getLinkIcon } from './icons'

const RADIUS: Record<ButtonStyle, string> = {
  rounded: 'rounded-2xl',
  pill: 'rounded-full',
  square: 'rounded-md',
}

interface LinkCardProps {
  link: PublicLink
  buttonStyle: ButtonStyle
  /** In the dashboard preview, open the destination directly and don't record clicks. */
  preview?: boolean
  index?: number
}

export function LinkCard({ link, buttonStyle, preview, index = 0 }: LinkCardProps) {
  const icon = getLinkIcon(link.icon)
  const pill = buttonStyle === 'pill'
  return (
    <a
      // Real visitors go through /go/:id, which records the click server-side and redirects.
      href={preview ? link.url : `/go/${link.id}`}
      target={preview ? '_blank' : undefined}
      rel="noopener noreferrer"
      className={`group relative flex w-full animate-fade-up items-center gap-3.5 overflow-hidden border border-(--p-border) bg-(--p-card) shadow-(--p-shadow) backdrop-blur-md transition duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:-translate-y-1 hover:border-[color-mix(in_srgb,var(--p-accent)_45%,transparent)] hover:bg-(--p-card-hover) hover:shadow-[0_14px_34px_-12px_color-mix(in_srgb,var(--p-accent)_50%,transparent)] active:translate-y-0 active:scale-[0.97] ${RADIUS[buttonStyle]} ${pill ? 'px-4 py-3' : 'p-3.5'}`}
      style={{ animationDelay: `${80 + index * 45}ms` }}
    >
      {/* A soft shine that sweeps across on hover. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 -skew-x-12 bg-linear-to-r from-transparent via-[color-mix(in_srgb,var(--p-accent)_18%,transparent)] to-transparent opacity-0 transition-[left,opacity] duration-700 ease-out group-hover:left-[120%] group-hover:opacity-100"
      />
      <span
        className={`grid size-10 shrink-0 place-items-center transition duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover:scale-110 group-hover:-rotate-6 ${pill ? 'rounded-full' : buttonStyle === 'square' ? 'rounded' : 'rounded-xl'}`}
        style={{
          background: icon ? 'color-mix(in srgb, var(--p-accent) 12%, transparent)' : 'transparent',
          color: 'var(--p-accent-text)',
        }}
      >
        {icon ? <icon.Icon size={19} /> : null}
      </span>
      <span className="min-w-0 flex-1 text-center">
        <span className="block truncate text-base font-medium tracking-tight text-(--p-fg)">{link.title}</span>
        {link.description ? (
          <span className="mt-0.5 block truncate text-(length:--p-text-small) text-(--p-muted)">{link.description}</span>
        ) : null}
      </span>
      <span className="grid size-10 shrink-0 place-items-center text-(--p-muted) opacity-0 transition duration-300 group-hover:translate-x-0.5 group-hover:text-(--p-accent-text) group-hover:opacity-100 group-focus-visible:opacity-100">
        <ArrowUpRight size={18} aria-hidden="true" />
      </span>
    </a>
  )
}
