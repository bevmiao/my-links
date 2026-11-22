import { ArrowUpRight, FileText, Mail, MapPin, Phone, Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'
import { SECTION_LABELS } from '../../shared/homepage'
import type { HomepageContact, HomepageIntro, PublicHomepage, PublicSection } from '../../shared/types'
import { getPlatform } from './icons'

/**
 * Published homepage sections, rendered below the links. All styling uses the public palette
 * (--p-*) and the design tokens in src/index.css.
 */
export function HomepageSections({ homepage, preview }: { homepage: PublicHomepage; preview?: boolean }) {
  if (!homepage.sections.length) return null
  return (
    <div className="mt-(--p-section-gap) flex w-full flex-col gap-(--p-section-gap)">
      {homepage.sections.map((section, i) => (
        <Section key={section.key} section={section} preview={preview} index={i} />
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

const cardClass =
  'rounded-(--p-radius-card) border border-(--p-border) bg-(--p-card) p-(--p-card-padding) shadow-(--p-shadow) backdrop-blur-md'
const chipClass =
  'rounded-(--p-radius-chip) border border-(--p-border) bg-(--p-card) px-3 py-1 text-(length:--p-text-small) font-medium text-(--p-fg)'

function SectionShell({ id, title, children, index }: { id: string; title: string; children: ReactNode; index: number }) {
  return (
    <section aria-labelledby={`section-${id}`} className="animate-fade-up" style={{ animationDelay: `${120 + index * 60}ms` }}>
      <h2
        id={`section-${id}`}
        className="mb-3 flex items-center gap-2 text-(length:--p-text-heading) font-semibold tracking-wider text-(--p-muted) uppercase"
      >
        <span className="size-1.5 rounded-full bg-(--p-accent)" aria-hidden="true" />
        {title}
      </h2>
      {children}
    </section>
  )
}

function Section({ section, preview, index }: { section: PublicSection; preview?: boolean; index: number }) {
  const title = SECTION_LABELS[section.key]
  switch (section.key) {
    case 'intro':
      return (
        <SectionShell id="intro" title={title} index={index}>
          <IntroCard intro={section.intro} />
        </SectionShell>
      )
    case 'experience':
      return (
        <SectionShell id="experience" title={title} index={index}>
          <ol className={`${cardClass} divide-y divide-(--p-border) py-1`}>
            {section.items.map((item, i) => (
              <li key={i} className="py-3.5 first:pt-3 last:pb-3">
                <p className="text-(length:--p-text-title) font-medium tracking-tight text-(--p-fg)">{item.role}</p>
                {item.organization || item.period ? (
                  <p className="mt-0.5 text-(length:--p-text-small) text-(--p-muted)">
                    {[item.organization, item.period].filter(Boolean).join(' · ')}
                  </p>
                ) : null}
                {item.description ? (
                  <p className="mt-2 text-(length:--p-text-small) leading-(--p-leading-body) whitespace-pre-line text-(--p-fg)/85">
                    {item.description}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
        </SectionShell>
      )
    case 'skills':
      return (
        <SectionShell id="skills" title={title} index={index}>
          <ul className="flex flex-wrap gap-2">
            {section.items.map((s, i) => (
              <li key={i} className={chipClass}>
                {s.label}
              </li>
            ))}
          </ul>
        </SectionShell>
      )
    case 'opportunities':
      return (
        <SectionShell id="opportunities" title={title} index={index}>
          <ul className="grid gap-3 sm:grid-cols-2">
            {section.items.map((o, i) => (
              <li key={i} className={`${cardClass} p-4`}>
                <p className="text-(length:--p-text-title) font-medium tracking-tight text-(--p-fg)">{o.title}</p>
                {o.description ? <p className="mt-1 text-(length:--p-text-small) text-(--p-muted)">{o.description}</p> : null}
              </li>
            ))}
          </ul>
        </SectionShell>
      )
    case 'contact':
      return (
        <SectionShell id="contact" title={title} index={index}>
          <ContactCard contact={section.contact} preview={preview} />
        </SectionShell>
      )
    case 'testimonials':
      return (
        <SectionShell id="testimonials" title={title} index={index}>
          <p className="rounded-(--p-radius-card) border border-dashed border-(--p-border) p-(--p-card-padding) text-center text-(length:--p-text-small) text-(--p-muted)">
            Kind words from people I’ve worked with will live here soon.
          </p>
        </SectionShell>
      )
  }
}

function IntroCard({ intro }: { intro: HomepageIntro }) {
  return (
    <div className={`${cardClass} space-y-4`}>
      {intro.intro ? (
        <p className="text-[1.0625rem] leading-relaxed font-medium tracking-tight text-pretty text-(--p-fg)">{intro.intro}</p>
      ) : null}
      {intro.about ? (
        <p className="text-(length:--p-text-body) leading-(--p-leading-body) whitespace-pre-line text-pretty text-(--p-fg)/85">{intro.about}</p>
      ) : null}
      {intro.background ? (
        <div>
          <h3 className="text-(length:--p-text-small) font-semibold text-(--p-fg)">My background</h3>
          <p className="mt-1 text-(length:--p-text-body) leading-(--p-leading-body) whitespace-pre-line text-pretty text-(--p-fg)/85">
            {intro.background}
          </p>
        </div>
      ) : null}
      {intro.interests.length ? (
        <div>
          <h3 className="text-(length:--p-text-small) font-semibold text-(--p-fg)">What I’m into</h3>
          <ul className="mt-2 flex flex-wrap gap-2">
            {intro.interests.map((t, i) => (
              <li key={i} className={chipClass}>
                {t}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

function ContactCard({ contact, preview }: { contact: HomepageContact; preview?: boolean }) {
  const linkedin = safeHref(contact.linkedinUrl)
  const resume = safeHref(contact.resumeUrl)
  const portfolio = contact.portfolioComingSoon ? undefined : safeHref(contact.portfolioUrl)
  const showPortfolio = contact.portfolioComingSoon || !!portfolio
  const LinkedIn = getPlatform('linkedin')?.Icon
  const external = { target: preview ? '_blank' : undefined, rel: 'noopener noreferrer' }

  const rows: { icon: ReactNode; label: string; href?: string }[] = []
  if (contact.email) rows.push({ icon: <Mail size={17} />, label: contact.email, href: `mailto:${encodeURI(contact.email).replace(/[?#]/g, encodeURIComponent)}` })
  if (contact.phone) rows.push({ icon: <Phone size={17} />, label: contact.phone, href: `tel:${contact.phone.replace(/[^\d+]/g, '')}` })
  if (contact.location) rows.push({ icon: <MapPin size={17} />, label: contact.location })

  return (
    <div className={`${cardClass} space-y-4`}>
      {rows.length ? (
        <ul className="space-y-1">
          {rows.map((r) => (
            <li key={r.label}>
              {r.href ? (
                <a
                  href={r.href}
                  className="-mx-2 flex min-h-11 items-center gap-3 rounded-(--p-radius-inner) px-2 text-(length:--p-text-body) text-(--p-fg) transition hover:bg-(--p-card-hover) hover:text-(--p-accent)"
                >
                  <span className="text-(--p-accent)" aria-hidden="true">
                    {r.icon}
                  </span>
                  <span className="min-w-0 break-words">{r.label}</span>
                </a>
              ) : (
                <p className="flex min-h-11 items-center gap-3 text-(length:--p-text-body) text-(--p-fg)">
                  <span className="text-(--p-accent)" aria-hidden="true">
                    {r.icon}
                  </span>
                  {r.label}
                </p>
              )}
            </li>
          ))}
        </ul>
      ) : null}

      {linkedin || resume || showPortfolio ? (
        <div className="flex flex-wrap gap-2">
          {linkedin ? (
            <ActionLink href={linkedin} {...external} icon={LinkedIn ? <LinkedIn size={16} /> : null}>
              LinkedIn
            </ActionLink>
          ) : null}
          {resume ? (
            <ActionLink href={resume} {...external} icon={<FileText size={16} />}>
              Resume
            </ActionLink>
          ) : null}
          {showPortfolio ? (
            portfolio ? (
              <ActionLink href={portfolio} {...external} icon={<Sparkles size={16} />}>
                Portfolio
              </ActionLink>
            ) : (
              <span
                aria-disabled="true"
                className="inline-flex min-h-11 items-center gap-2 rounded-(--p-radius-chip) border border-dashed border-(--p-border) px-4 text-(length:--p-text-small) font-medium text-(--p-muted)"
              >
                <Sparkles size={16} aria-hidden="true" />
                Portfolio
                <span className="rounded-(--p-radius-chip) bg-[color-mix(in_srgb,var(--p-accent)_14%,transparent)] px-2 py-0.5 text-[11px] font-semibold text-(--p-accent)">
                  Coming soon
                </span>
              </span>
            )
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function ActionLink({
  href,
  icon,
  children,
  target,
  rel,
}: {
  href: string
  icon: ReactNode
  children: ReactNode
  target?: string
  rel: string
}) {
  return (
    <a
      href={href}
      target={target}
      rel={rel}
      className="group inline-flex min-h-11 items-center gap-2 rounded-(--p-radius-chip) border border-(--p-border) bg-(--p-card) px-4 text-(length:--p-text-small) font-medium text-(--p-fg) transition hover:border-[color-mix(in_srgb,var(--p-accent)_45%,transparent)] hover:bg-(--p-card-hover) hover:text-(--p-accent)"
    >
      <span aria-hidden="true">{icon}</span>
      {children}
      <ArrowUpRight size={14} className="text-(--p-muted) transition group-hover:text-(--p-accent)" aria-hidden="true" />
    </a>
  )
}
