import { ArrowUpRight, Mail, MapPin } from 'lucide-react'
import type { ReactNode } from 'react'
import { SECTION_LABELS } from '../../shared/homepage'
import type { HomepageContact, PublicHomepage, PublicSection } from '../../shared/types'

/**
 * Published homepage sections, rendered below the links. Deliberately plain: short headings,
 * text rather than stacks of cards. Styling uses the public palette (--p-*) and the tokens in
 * src/index.css.
 */
export function HomepageSections({ homepage, preview }: { homepage: PublicHomepage; preview?: boolean }) {
  if (!homepage.sections.length) return null
  return (
    <div className="mt-(--p-section-gap) flex w-full flex-col gap-(--p-section-gap)">
      {homepage.sections.map((section, i) => (
        <div key={section.key} className="animate-fade-up" style={{ animationDelay: `${120 + i * 60}ms` }}>
          <Section section={section} preview={preview} />
        </div>
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

const chipClass =
  'rounded-(--p-radius-chip) border border-(--p-border) bg-(--p-card) px-3 py-1 text-(length:--p-text-small) font-medium text-(--p-fg)'

function Titled({ id, children }: { id: PublicSection['key']; children: ReactNode }) {
  return (
    <section aria-labelledby={`section-${id}`}>
      <h2 id={`section-${id}`} className="mb-3 text-(length:--p-text-title) font-semibold tracking-tight text-(--p-fg)">
        {SECTION_LABELS[id]}
      </h2>
      {children}
    </section>
  )
}

function Section({ section, preview }: { section: PublicSection; preview?: boolean }) {
  switch (section.key) {
    case 'intro':
      // The headline is shown under the name (ProfileView); this section is just the words.
      return section.intro.about ? (
        <Titled id="intro">
          <p className="text-(length:--p-text-body) leading-(--p-leading-body) whitespace-pre-line text-pretty text-(--p-fg)/85">
            {section.intro.about}
          </p>
        </Titled>
      ) : null
    case 'skills':
      return (
        <Titled id="skills">
          <ul className="flex flex-wrap gap-2">
            {section.items.map((s, i) => (
              <li key={i} className={chipClass}>
                {s.label}
              </li>
            ))}
          </ul>
        </Titled>
      )
    case 'opportunities':
      // One sentence, no heading.
      return (
        <p className="text-center text-[1.0625rem] leading-relaxed font-medium tracking-tight text-balance text-(--p-fg)">
          {section.sentence}
        </p>
      )
    case 'contact':
      return (
        <Titled id="contact">
          <Contact contact={section.contact} preview={preview} />
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

function Contact({ contact, preview }: { contact: HomepageContact; preview?: boolean }) {
  const portfolio = contact.portfolioComingSoon ? undefined : safeHref(contact.portfolioUrl)
  const rowClass = 'flex min-h-11 items-center gap-3 text-(length:--p-text-body) text-(--p-fg)'
  return (
    <ul className="space-y-0.5">
      {contact.email ? (
        <li>
          <a
            href={`mailto:${encodeURI(contact.email).replace(/[?#]/g, encodeURIComponent)}`}
            className={`${rowClass} -mx-2 rounded-(--p-radius-inner) px-2 transition hover:bg-(--p-card-hover) hover:text-(--p-accent)`}
          >
            <Mail size={17} className="shrink-0 text-(--p-accent)" aria-hidden="true" />
            <span className="min-w-0 break-words">{contact.email}</span>
          </a>
        </li>
      ) : null}
      {contact.location ? (
        <li className={rowClass}>
          <MapPin size={17} className="shrink-0 text-(--p-accent)" aria-hidden="true" />
          {contact.location}
        </li>
      ) : null}
      {portfolio ? (
        <li>
          <a
            href={portfolio}
            target={preview ? '_blank' : undefined}
            rel="noopener noreferrer"
            className={`${rowClass} group -mx-2 rounded-(--p-radius-inner) px-2 transition hover:bg-(--p-card-hover) hover:text-(--p-accent)`}
          >
            <ArrowUpRight size={17} className="shrink-0 text-(--p-accent)" aria-hidden="true" />
            Portfolio
          </a>
        </li>
      ) : contact.portfolioComingSoon ? (
        <li className={`${rowClass} text-(--p-muted)`}>
          <ArrowUpRight size={17} className="shrink-0 opacity-60" aria-hidden="true" />
          Portfolio
          <span className="rounded-(--p-radius-chip) bg-[color-mix(in_srgb,var(--p-accent)_14%,transparent)] px-2 py-0.5 text-[11px] font-semibold text-(--p-accent)">
            Coming soon
          </span>
        </li>
      ) : null}
    </ul>
  )
}
