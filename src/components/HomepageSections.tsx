import { ArrowRight, ArrowUpRight, ChevronDown, Mail, MapPin } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { SECTION_LABELS } from '../../shared/homepage'
import type { HomepageContact, HomepageStory, PublicSection } from '../../shared/types'
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
              <li
                key={i}
                className="cursor-default rounded-(--p-radius-chip) border border-(--p-border) bg-(--p-card) px-3.5 py-1.5 text-(length:--p-text-small) font-medium text-(--p-fg) transition duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] select-none hover:-translate-y-1 hover:border-[color-mix(in_srgb,var(--p-accent)_55%,transparent)] hover:text-(--p-accent-text) active:scale-90 even:hover:rotate-2 odd:hover:-rotate-2"
              >
                {s.label}
              </li>
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
    case 'testimonials':
      return (
        <Titled id="testimonials">
          <p className="text-(length:--p-text-small) text-(--p-muted)">Coming soon.</p>
        </Titled>
      )
  }
}

/** "My story": shows the start, expands to the full text. */
function StoryBlock({ story }: { story: HomepageStory }) {
  const [open, setOpen] = useState(false)
  const long = story.body.length > 260
  return (
    <section aria-labelledby="section-story">
      <h2 id="section-story" className={headingClass}>
        {story.title || SECTION_LABELS.story}
      </h2>
      <div className="relative">
        <p
          id="story-body"
          className={`overflow-hidden ${proseClass} transition-[max-height] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            long && !open ? 'max-h-[8.25em] mask-[linear-gradient(to_bottom,black_55%,transparent)]' : 'max-h-[200em]'
          }`}
        >
          {story.body}
        </p>
      </div>
      {long ? (
        <button
          type="button"
          aria-expanded={open}
          aria-controls="story-body"
          onClick={() => setOpen((o) => !o)}
          className="group mt-2 inline-flex min-h-11 items-center gap-1.5 rounded-(--p-radius-chip) text-(length:--p-text-small) font-semibold text-(--p-accent-text) transition active:scale-95"
        >
          {open ? 'Show less' : 'Read more'}
          <ChevronDown size={16} aria-hidden="true" className={`transition duration-500 ${open ? 'rotate-180' : 'group-hover:translate-y-0.5'}`} />
        </button>
      ) : null}
    </section>
  )
}

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
  const portfolio = contact.portfolioComingSoon ? undefined : safeHref(contact.portfolioUrl)
  const row =
    'group -mx-3 flex min-h-12 w-[calc(100%+1.5rem)] items-center gap-3 rounded-(--p-radius-inner) px-3 text-left text-(length:--p-text-body) text-(--p-fg) transition duration-300'
  const interactive = 'hover:bg-(--p-card-hover) hover:text-(--p-accent-text) active:scale-[0.98]'
  const icon = 'shrink-0 text-(--p-accent-text) transition duration-300 group-hover:scale-110'
  return (
    <ul className="space-y-1">
      {contact.email ? (
        <li>
          <a href={`mailto:${encodeURI(contact.email).replace(/[?#]/g, encodeURIComponent)}`} className={`${row} ${interactive}`}>
            <Mail size={18} className={icon} aria-hidden="true" />
            <span className="min-w-0 flex-1 break-words">{contact.email}</span>
            <ArrowRight size={16} aria-hidden="true" className="shrink-0 -translate-x-2 opacity-0 transition duration-300 group-hover:translate-x-0 group-hover:opacity-100" />
          </a>
        </li>
      ) : null}
      {contact.location ? (
        <li>
          {story ? (
            <>
              <button type="button" onClick={() => setStoryOpen(true)} className={`${row} ${interactive}`} aria-haspopup="dialog">
                <MapPin size={18} className={icon} aria-hidden="true" />
                <span>{contact.location}</span>
                <span className="ml-1 inline-flex min-w-0 items-center gap-2 rounded-(--p-radius-chip) border border-(--p-border) px-2.5 py-0.5 text-(length:--p-text-small) font-medium text-(--p-muted) transition group-hover:border-[color-mix(in_srgb,var(--p-accent)_45%,transparent)] group-hover:text-(--p-accent-text)">
                  <span className="relative flex size-2 shrink-0" aria-hidden="true">
                    <span className="absolute inline-flex size-full animate-ping-soft rounded-full bg-(--p-accent)" />
                    <span className="relative inline-flex size-2 rounded-full bg-(--p-accent)" />
                  </span>
                  <span className="max-w-[14rem] truncate">{story.title || SECTION_LABELS.story}</span>
                </span>
              </button>
              <StoryDialog story={story} location={contact.location} open={storyOpen} onClose={() => setStoryOpen(false)} grain={grain} />
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
          <a href={portfolio} target={preview ? '_blank' : undefined} rel="noopener noreferrer" className={`${row} ${interactive}`}>
            <ArrowUpRight size={18} className={`${icon} group-hover:translate-x-0.5 group-hover:-translate-y-0.5`} aria-hidden="true" />
            Portfolio
          </a>
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
