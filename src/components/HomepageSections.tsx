import { ArrowRight, ArrowUpRight, ChevronDown, Mail, MapPin } from 'lucide-react'
import { useReducedMotion } from 'motion/react'
import * as m from 'motion/react-m'
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { SECTION_LABELS } from '../../shared/homepage'
import type { HomepageContact, HomepageStory, PublicClient, PublicSection } from '../../shared/types'
import { tapSquish, tapSquishSoft } from '../lib/motion'
import { Reveal, Words } from './Reveal'
import { StoryDialog } from './StoryDialog'
import { VideoGrid } from './VideoGrid'

/**
 * The homepage sections that belong to one page (About or Work), in the owner's order.
 * Styling uses the public palette (--p-*) and the tokens in src/index.css.
 */
export function PageSections({ sections, preview, grain = true }: { sections: PublicSection[]; preview?: boolean; grain?: boolean }) {
  return (
    <div className="flex w-full flex-col gap-(--p-section-gap)">
      {sections.map((section, i) => (
        <Reveal key={section.key} delay={Math.min(i, 3) * 90} instant={preview}>
          <Section section={section} preview={preview} grain={grain} />
        </Reveal>
      ))}
    </div>
  )
}

/** Only http(s) links are rendered as links. The preview can show unsaved, unvalidated input. */
function safeHref(url: string): string | undefined {
  try {
    const u = new URL(url)
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : undefined
  } catch {
    return undefined
  }
}

const headingClass = 'mb-3 font-display text-(length:--p-text-title) font-medium text-(--p-fg)'
const proseClass =
  'max-w-(--p-measure) text-(length:--p-text-body) leading-(--p-leading-body) whitespace-pre-line text-pretty text-(--p-fg)/85'

function Titled({ id, children, big }: { id: PublicSection['key']; children: ReactNode; big?: boolean }) {
  const label = SECTION_LABELS[id]
  const split = label.lastIndexOf(' ')
  return (
    <section aria-labelledby={`section-${id}`}>
      <h2 id={`section-${id}`} className={big ? 'mb-5 font-display text-4xl font-medium text-(--p-fg) @md:text-5xl' : headingClass}>
        {big && split > 0 ? (
          // Editorial touch: the last word in italic accent, e.g. "Let's *work!*"
          <>
            {label.slice(0, split + 1)}
            <em className="text-(--p-accent-text)">{label.slice(split + 1)}</em>
          </>
        ) : (
          label
        )}
      </h2>
      {children}
    </section>
  )
}

function Section({ section, preview, grain }: { section: PublicSection; preview?: boolean; grain?: boolean }) {
  switch (section.key) {
    case 'intro':
      // The headline is shown under the name; this section is just the words.
      return section.intro.about ? (
        <Titled id="intro">
          <p className={proseClass}>{section.intro.about}</p>
        </Titled>
      ) : null
    case 'story':
      return <StoryBlock story={section.story} />
    case 'skills':
      return (
        <Titled id="skills">
          <ul className="flex flex-wrap gap-2">
            {section.items.map((s, i) => (
              <m.li
                key={i}
                {...tapSquish}
                className="cursor-default rounded-(--p-radius-chip) border border-(--p-border) bg-(--p-card) px-3.5 py-1.5 text-(length:--p-text-small) font-medium text-(--p-fg) transition-no-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] select-none hover:-translate-y-1 hover:border-[color-mix(in_srgb,var(--p-accent)_55%,transparent)] hover:text-(--p-accent-text) even:hover:rotate-2 odd:hover:-rotate-2"
              >
                {s.label}
              </m.li>
            ))}
          </ul>
        </Titled>
      )
    case 'opportunities':
      // One sentence, no heading, words pop in.
      return (
        <p className="max-w-[22ch] font-display text-3xl leading-tight font-medium text-balance text-(--p-fg) italic @md:text-4xl">
          <Words text={section.sentence} />
        </p>
      )
    case 'videos':
      return (
        <Titled id="videos">
          <VideoGrid items={section.items} />
        </Titled>
      )
    case 'contact':
      return (
        <Titled id="contact" big>
          <Contact contact={section.contact} story={section.story} preview={preview} grain={grain} />
        </Titled>
      )
    case 'clients':
      return <ClientStrip items={section.items} />
    case 'testimonials':
      return (
        <Titled id="testimonials">
          <p className="text-(length:--p-text-small) text-(--p-muted)">Coming soon.</p>
        </Titled>
      )
  }
}

/**
 * "Worked with": a row of client logos. Each sits on a light tile so any logo stays readable in
 * both themes. The client's name is the alt text, and is shown as text when there's no logo (or
 * the logo fails to load).
 */
function ClientStrip({ items }: { items: PublicClient[] }) {
  return (
    <section aria-labelledby="section-clients">
      <h2 id="section-clients" className="text-center text-(length:--p-text-small) font-medium text-(--p-muted) @4xl:text-left">
        {SECTION_LABELS.clients}
      </h2>
      <ul className="mt-3 flex flex-wrap justify-center gap-2.5 @4xl:justify-start">
        {items.map((c, i) => (
          <li
            key={`${c.name}-${i}`}
            className="grid h-14 min-w-24 place-items-center rounded-(--p-radius-inner) border border-(--p-border) bg-white/95 px-4 shadow-(--p-shadow)"
          >
            <ClientLogo client={c} />
          </li>
        ))}
      </ul>
    </section>
  )
}

function ClientLogo({ client }: { client: PublicClient }) {
  const [failed, setFailed] = useState(false)
  if (client.logoUrl && !failed)
    return (
      <img
        src={client.logoUrl}
        alt={client.name}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        className="max-h-8 w-auto max-w-32 object-contain"
      />
    )
  return <span className="max-w-40 text-center font-display text-base leading-tight font-medium text-balance text-zinc-800">{client.name}</span>
}

/**
 * "My story": shows the start, expands to the full text (animated to its real height). The
 * "Read more" button only appears when the text is actually cut off at the current width; if
 * at most one more line would be hidden, the whole story is shown instead.
 */
function StoryBlock({ story }: { story: HomepageStory }) {
  // `smooth` is true only for changes the visitor made (the button). Measuring and resizing
  // change the height instantly, so nothing animates on page load. It starts collapsed (the
  // usual case for a real story) and is measured before the first paint, so a long story never
  // flashes at full length.
  const [state, setState] = useState({ open: false, fits: false, smooth: false })
  const { open, fits, smooth } = state
  const reduce = useReducedMotion()
  const ref = useRef<HTMLParagraphElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      const cs = getComputedStyle(el)
      const collapsedPx = COLLAPSED_LINES_EM * parseFloat(cs.fontSize)
      const hidden = el.scrollHeight - collapsedPx
      const next = hidden <= parseFloat(cs.lineHeight)
      setState((s) => (s.fits === next ? s : { ...s, fits: next, smooth: false }))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
    // `fits` is a dependency because the paragraph is remounted when it changes (see `key`).
  }, [story.body, fits])

  const collapsed = !fits && !open
  return (
    <section aria-labelledby="section-story">
      <h2 id="section-story" className={headingClass}>
        {story.title || SECTION_LABELS.story}
      </h2>
      <div className="relative">
        <m.p
          // Remount when the measured fit changes, so the new height is written straight into the
          // DOM on render (initial={false}) instead of on a later animation frame.
          key={fits ? 'fits' : 'cut'}
          ref={ref}
          id="story-body"
          initial={false}
          // The fade at the bottom dissolves while the text opens (and returns as it closes), so
          // the change reads as one movement.
          animate={{ height: collapsed ? `${COLLAPSED_LINES_EM}em` : 'auto', '--story-fade': collapsed ? '55%' : '100%' }}
          transition={reduce || !smooth ? { duration: 0 } : { type: 'spring', visualDuration: 0.6, bounce: 0.18 }}
          className={`overflow-hidden ${proseClass} mask-[linear-gradient(to_bottom,black_var(--story-fade),transparent)]`}
        >
          {story.body}
        </m.p>
      </div>
      {!fits ? (
        <m.button
          type="button"
          {...tapSquish}
          aria-expanded={open}
          aria-controls="story-body"
          onClick={() => setState((s) => ({ ...s, open: !s.open, smooth: true }))}
          className="group mt-2 inline-flex min-h-11 items-center gap-1.5 rounded-(--p-radius-chip) text-(length:--p-text-small) font-semibold text-(--p-accent-text)"
        >
          {open ? 'Show less' : 'Read more'}
          <m.span
            aria-hidden="true"
            className="inline-flex"
            initial={false}
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ type: 'spring', visualDuration: 0.5, bounce: 0.4 }}
          >
            <ChevronDown size={16} className={`transition duration-300 ${open ? '' : 'group-hover:translate-y-0.5'}`} />
          </m.span>
        </m.button>
      ) : null}
    </section>
  )
}

/** Collapsed height, in em: about five lines of body text, enough to read the start of the story. */
const COLLAPSED_LINES_EM = 8.25

function Contact({
  contact,
  story,
  preview,
  grain,
}: {
  contact: HomepageContact
  story: HomepageStory | null
  preview?: boolean
  grain?: boolean
}) {
  const [storyOpen, setStoryOpen] = useState(false)
  // Where the location button is on screen, so the story card can grow out of it.
  const [storyFrom, setStoryFrom] = useState<DOMRect | null>(null)
  const portfolio = contact.portfolioComingSoon ? undefined : safeHref(contact.portfolioUrl)
  const row =
    'group -mx-3 flex min-h-12 w-[calc(100%+1.5rem)] items-center gap-3 rounded-(--p-radius-inner) px-3 text-left text-(length:--p-text-body) text-(--p-fg) transition-no-transform duration-300'
  const interactive = 'hover:bg-(--p-card-hover) hover:text-(--p-accent-text)'
  const icon = 'shrink-0 text-(--p-accent-text) transition duration-300 group-hover:scale-110'
  return (
    <ul className="space-y-1">
      {contact.email ? (
        <li>
          <m.a {...tapSquishSoft} href={`mailto:${encodeURI(contact.email).replace(/[?#]/g, encodeURIComponent)}`} className={`${row} ${interactive}`}>
            <Mail size={18} className={icon} aria-hidden="true" />
            <span className="min-w-0 flex-1 break-words">{contact.email}</span>
            <ArrowRight size={16} aria-hidden="true" className="shrink-0 -translate-x-2 opacity-0 transition duration-300 group-hover:translate-x-0 group-hover:opacity-100" />
          </m.a>
        </li>
      ) : null}
      {contact.location ? (
        <li>
          {story ? (
            <>
              <m.button
                type="button"
                {...tapSquishSoft}
                onClick={(e) => {
                  setStoryFrom(e.currentTarget.getBoundingClientRect())
                  setStoryOpen(true)
                }}
                className={`${row} ${interactive}`}
                aria-haspopup="dialog"
              >
                <MapPin size={18} className={icon} aria-hidden="true" />
                <span>{contact.location}</span>
                <span className="ml-1 inline-flex min-w-0 items-center gap-2 rounded-(--p-radius-chip) border border-(--p-border) px-2.5 py-0.5 text-(length:--p-text-small) font-medium text-(--p-muted) transition group-hover:border-[color-mix(in_srgb,var(--p-accent)_45%,transparent)] group-hover:text-(--p-accent-text)">
                  <span className="relative flex size-2 shrink-0" aria-hidden="true">
                    <span className="absolute inline-flex size-full animate-ping-soft rounded-full bg-(--p-accent)" />
                    <span className="relative inline-flex size-2 rounded-full bg-(--p-accent)" />
                  </span>
                  <span className="max-w-[14rem] truncate">{story.title || SECTION_LABELS.story}</span>
                </span>
              </m.button>
              <StoryDialog
                story={story}
                location={contact.location}
                open={storyOpen}
                onClose={() => setStoryOpen(false)}
                grain={grain}
                from={storyFrom}
              />
            </>
          ) : (
            <p className={row}>
              <MapPin size={18} className={icon} aria-hidden="true" />
              {contact.location}
            </p>
          )}
        </li>
      ) : null}
      {portfolio ? (
        <li>
          <m.a {...tapSquishSoft} href={portfolio} target={preview ? '_blank' : undefined} rel="noopener noreferrer" className={`${row} ${interactive}`}>
            <ArrowUpRight size={18} className={`${icon} group-hover:translate-x-0.5 group-hover:-translate-y-0.5`} aria-hidden="true" />
            Portfolio
          </m.a>
        </li>
      ) : contact.portfolioComingSoon ? (
        <li className={`${row} text-(--p-muted)`}>
          <ArrowUpRight size={18} className="shrink-0 opacity-60" aria-hidden="true" />
          Portfolio
          <span className="rounded-(--p-radius-chip) bg-[color-mix(in_srgb,var(--p-accent)_14%,transparent)] px-2 py-0.5 text-[11px] font-semibold text-(--p-accent-text)">
            Coming soon
          </span>
        </li>
      ) : null}
    </ul>
  )
}
