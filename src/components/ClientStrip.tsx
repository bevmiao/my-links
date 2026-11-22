import * as m from 'motion/react-m'
import { useId, useState, type CSSProperties } from 'react'
import { clientHasDetails, SECTION_LABELS } from '../../shared/homepage'
import type { PublicClient } from '../../shared/types'
import { tapSquish } from '../lib/motion'
import { CloseButton, PopCard } from './PopCard'

/**
 * "Worked with": a row of client logos, no tiles. Logos set to "one colour" are drawn in the
 * page's text colour (the logo is used as a mask), so they read in light and dark mode alike.
 * Clients with details open into a card that grows out of the logo.
 */
export function ClientStrip({ items, grain = true }: { items: PublicClient[]; grain?: boolean }) {
  const [active, setActive] = useState<{ index: number; from: DOMRect } | null>(null)
  const [open, setOpen] = useState(false)
  const client = active ? items[active.index] : null

  return (
    <section aria-labelledby="section-clients">
      <h2 id="section-clients" className="text-center text-(length:--p-text-small) font-medium text-(--p-muted) @4xl:text-left">
        {SECTION_LABELS.clients}
      </h2>
      <ul className="mt-5 flex flex-wrap items-center justify-center gap-x-10 gap-y-6 @4xl:justify-start">
        {items.map((c, i) => {
          // Same springy hover as the link cards and social icons: lift, grow a little, and tilt
          // (alternating left and right, like the skill chips).
          const hover = `group grid min-h-14 place-items-center rounded-(--p-radius-inner) px-1.5 transition-no-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:-translate-y-1.5 hover:scale-110 ${i % 2 ? 'hover:-rotate-2' : 'hover:rotate-2'}`
          return (
          <li key={`${c.name}-${i}`}>
            {clientHasDetails(c) ? (
              <m.button
                type="button"
                {...tapSquish}
                aria-haspopup="dialog"
                aria-label={`${c.name}: what I worked on`}
                onClick={(e) => {
                  setActive({ index: i, from: e.currentTarget.getBoundingClientRect() })
                  setOpen(true)
                }}
                className={hover}
              >
                <ClientLogo client={c} decorative lively />
              </m.button>
            ) : (
              <div className={`cursor-default ${hover}`}>
                <ClientLogo client={c} lively />
              </div>
            )}
          </li>
          )
        })}
      </ul>
      {client ? <ClientCard client={client} open={open} from={active!.from} grain={grain} onClose={() => setOpen(false)} /> : null}
    </section>
  )
}

/**
 * A client's logo, or its name when there's no logo (or it fails to load).
 * `decorative`: the surrounding button already carries the name, so the logo itself is hidden
 * from screen readers. `size` is the logo height. `lively` (the strip): on hover, one-colour logos
 * and names turn the accent colour, and every logo gets a soft accent glow, like the link cards.
 */
function ClientLogo({ client, decorative, lively, size = 'h-11' }: { client: PublicClient; decorative?: boolean; lively?: boolean; size?: string }) {
  const [failed, setFailed] = useState(false)
  const tone = lively ? 'text-(--p-fg)/75 transition-[color,filter] duration-500 group-hover:text-(--p-accent-text)' : 'text-(--p-fg)/75'
  // drop-shadow (not box-shadow) follows the logo's own shape. It sits on the outer element so the
  // mask on the inner one doesn't cut it off.
  const glow = lively ? 'group-hover:drop-shadow-[0_6px_16px_color-mix(in_srgb,var(--p-accent)_55%,transparent)]' : ''
  const label = decorative ? { 'aria-hidden': true as const } : { role: 'img', 'aria-label': client.name }

  if (!client.logoUrl || failed)
    return (
      <span {...(decorative ? { 'aria-hidden': true } : {})} className={`font-display text-xl leading-tight font-medium text-balance ${tone} ${glow}`}>
        {client.name}
      </span>
    )

  if (client.logoMono) {
    // The invisible <img> gives the box the logo's real proportions; the span on top paints the
    // logo's shape in the current text colour.
    const mask: CSSProperties = {
      maskImage: `url("${client.logoUrl}")`,
      WebkitMaskImage: `url("${client.logoUrl}")`,
      maskSize: 'contain',
      WebkitMaskSize: 'contain',
      maskRepeat: 'no-repeat',
      WebkitMaskRepeat: 'no-repeat',
      maskPosition: 'center',
      WebkitMaskPosition: 'center',
    }
    return (
      <span {...label} className={`relative inline-block ${tone} ${glow}`}>
        <img src={client.logoUrl} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} className={`invisible block w-auto max-w-44 object-contain ${size}`} />
        <span aria-hidden="true" className="absolute inset-0 bg-current" style={mask} />
      </span>
    )
  }

  return (
    <img
      src={client.logoUrl}
      alt={decorative ? '' : client.name}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className={`w-auto max-w-44 object-contain opacity-85 transition-[opacity,filter] duration-500 group-hover:opacity-100 ${glow} ${size}`}
    />
  )
}

/** The pop-up card: logo, name, title, what I worked on, and photos. */
function ClientCard({
  client,
  open,
  from,
  grain,
  onClose,
}: {
  client: PublicClient
  open: boolean
  from: DOMRect
  grain: boolean
  onClose: () => void
}) {
  const titleId = useId()
  const photos = client.images
  return (
    <PopCard open={open} onClose={onClose} from={from} labelledBy={titleId} grain={grain} className="max-w-lg">
      <div className="flex items-start justify-between gap-4">
        <div className="min-h-11 pt-1.5">
          <ClientLogo client={client} decorative size="h-8" />
        </div>
        <CloseButton onClick={onClose} />
      </div>
      {client.title ? (
        <>
          <p className="mt-3 text-(length:--p-text-small) font-medium text-(--p-accent-text)">{client.name}</p>
          <h2 id={titleId} className="mt-1 font-display text-2xl font-medium text-balance">
            {client.title}
          </h2>
        </>
      ) : (
        <h2 id={titleId} className="mt-3 font-display text-2xl font-medium text-balance">
          {client.name}
        </h2>
      )}
      {client.bullets.length ? (
        <ul className="mt-4 space-y-2" aria-label="What I worked on">
          {client.bullets.map((b, i) => (
            <li key={i} className="flex gap-3 text-(length:--p-text-body) leading-snug text-pretty text-(--p-fg)/85">
              <span aria-hidden="true" className="mt-[0.55em] size-1.5 shrink-0 rounded-full bg-(--p-accent)" />
              {b}
            </li>
          ))}
        </ul>
      ) : null}
      {photos.length ? (
        <div className="mt-5 grid grid-cols-2 gap-2">
          {photos.map((p, i) => (
            <img
              key={p.url}
              src={p.url}
              alt={p.alt || `Photo from my work with ${client.name}`}
              loading="lazy"
              decoding="async"
              className={`aspect-[4/3] w-full rounded-(--p-radius-inner) bg-(--p-card) object-cover ${photos.length % 2 === 1 && i === 0 ? 'col-span-2 aspect-[16/9]' : ''}`}
            />
          ))}
        </div>
      ) : null}
    </PopCard>
  )
}
