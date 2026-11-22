import { Check, Share2 } from 'lucide-react'
import { useState } from 'react'
import { PAGE_LABELS, PAGE_PATHS } from '../../shared/homepage'
import { SECTION_PAGE, type PageKey, type Profile, type PublicHomepage, type PublicLink, type PublicSection } from '../../shared/types'
import { profilePalette, type ResolvedMode } from '../lib/theme'
import { Avatar } from './Avatar'
import { PageSections } from './HomepageSections'
import { LinkCard } from './LinkCard'
import { RouterLink } from './RouterLink'
import { SocialIcons } from './SocialIcons'
import { ThemeToggle } from './ThemeToggle'

interface ProfileViewProps {
  profile: Profile
  links: PublicLink[]
  /** Published homepage sections (or the draft, in the dashboard preview). */
  homepage?: PublicHomepage | null
  mode: ResolvedMode
  onToggleTheme?: () => void
  /** Which page to show: Home (links), About, or Work. */
  page?: PageKey
  /** In the dashboard preview, tabs switch pages through this instead of the URL. */
  onNavigate?: (page: PageKey) => void
  /** Rendered inside the dashboard's live preview frame. */
  preview?: boolean
}

/** Uncategorised links first, then one group per category in the order categories first appear. */
function groupLinks(links: PublicLink[]) {
  const groups: { category: string; links: { link: PublicLink; index: number }[] }[] = [{ category: '', links: [] }]
  links.forEach((link, index) => {
    let group = groups.find((g) => g.category === link.category)
    if (!group) groups.push((group = { category: link.category, links: [] }))
    group.links.push({ link, index })
  })
  return groups.filter((g) => g.links.length)
}

/**
 * The public site. Layout follows the width of this component (CSS container queries), not the
 * window, so the dashboard's narrow preview shows the phone layout. From @4xl (56rem) up, the
 * profile is pinned in a left column and pages scroll on the right.
 */
export function ProfileView({ profile, links, homepage, mode, onToggleTheme, page = 'home', onNavigate, preview }: ProfileViewProps) {
  const palette = profilePalette(profile, mode)
  const glowStrength = mode === 'dark' ? 24 : 15
  const sections = homepage?.sections ?? []
  const intro = sections.find((s) => s.key === 'intro')
  const headline = intro?.key === 'intro' ? intro.intro.headline : ''
  const byPage = (p: PageKey): PublicSection[] => sections.filter((s) => SECTION_PAGE[s.key] === p)
  const pages = (['home', 'about', 'work'] as const).filter((p) => p === 'home' || byPage(p).length)
  const known = pages.includes(page)

  return (
    <div
      style={palette}
      className={`@container relative isolate flex flex-col overflow-hidden bg-(--p-bg) text-(--p-fg) transition-colors duration-500 ${preview ? 'min-h-full' : 'min-h-dvh'}`}
    >
      {/* Background: optional image, accent glow, two slowly drifting lights, and film grain. */}
      {profile.backgroundUrl ? (
        <div aria-hidden="true" className="absolute inset-0 -z-10">
          <img src={profile.backgroundUrl} alt="" className="h-full w-full scale-105 object-cover blur-[2px]" />
          <div className="absolute inset-0 bg-(--p-bg) opacity-80" />
        </div>
      ) : null}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[560px]"
        style={{ background: `radial-gradient(60% 55% at 50% 0%, color-mix(in srgb, var(--p-accent) ${glowStrength}%, transparent), transparent 70%)` }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 -left-40 -z-10 size-[520px] animate-drift rounded-full blur-3xl"
        style={{ background: `color-mix(in srgb, var(--p-accent) ${glowStrength - 8}%, transparent)` }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-[40%] -right-48 -z-10 size-[460px] animate-drift rounded-full blur-3xl [animation-delay:-9s]"
        style={{ background: `color-mix(in srgb, var(--p-accent) ${glowStrength - 10}%, transparent)` }}
      />
      {/* Film vignette: softly darker (or warmer, in light mode) towards the edges. */}
      <div
        aria-hidden="true"
        className={`pointer-events-none inset-0 -z-10 ${preview ? 'absolute' : 'fixed'}`}
        style={{ background: 'radial-gradient(ellipse 85% 75% at 50% 45%, transparent 55%, var(--p-vignette))' }}
      />
      <div aria-hidden="true" className={`grain z-50 ${preview ? 'absolute' : 'fixed'} animate-grain`} />

      <header className={`mx-auto flex w-full max-w-(--p-wide-width) items-center justify-between ${preview ? 'p-3' : 'p-4 sm:p-6'}`}>
        <ShareButton preview={preview} title={profile.displayName} />
        {onToggleTheme ? (
          <ThemeToggle
            mode={mode}
            onToggle={onToggleTheme}
            className="border border-(--p-border) bg-(--p-card) text-(--p-fg) backdrop-blur-md hover:rotate-12 hover:bg-(--p-card-hover)"
          />
        ) : (
          <span />
        )}
      </header>

      <div
        className={`mx-auto w-full max-w-(--p-content-width) flex-1 @4xl:grid @4xl:max-w-(--p-wide-width) @4xl:grid-cols-[var(--p-side-width)_minmax(0,1fr)] @4xl:gap-16 ${
          preview ? 'px-4 pb-6' : 'px-5 pb-12 sm:px-6'
        }`}
      >
        {/* Full profile: on phones only on Home; on wide screens always, pinned on the left. */}
        <aside className={`${page === 'home' || !known ? 'flex' : 'hidden'} @4xl:sticky @4xl:top-8 @4xl:flex @4xl:self-start`}>
          <FullHero profile={profile} headline={headline} preview={preview} />
        </aside>

        <main className="flex min-w-0 flex-col">
          {page !== 'home' && known ? <CompactHero profile={profile} headline={headline} /> : null}
          {pages.length > 1 ? (
            <PageTabs pages={pages} current={known ? page : 'home'} preview={preview} onNavigate={onNavigate} />
          ) : null}

          <div key={page} className="mt-8 animate-page-in @4xl:mt-10">
            {!known ? (
              <NothingHere preview={preview} onNavigate={onNavigate} />
            ) : page === 'home' ? (
              <HomeLinks links={links} profile={profile} preview={preview} empty={!sections.length} />
            ) : (
              <PageSections sections={byPage(page)} preview={preview} />
            )}
          </div>
        </main>
      </div>

      <footer className="pb-6 text-center text-xs text-(--p-muted)">
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5">
          <span className="size-1.5 rounded-full bg-(--p-accent)" aria-hidden="true" />
          <span className="font-medium tracking-tight">{profile.displayName}</span>
          <span aria-hidden="true">·</span>
          <span>© {new Date().getFullYear()}</span>
        </span>
      </footer>
    </div>
  )
}

function FullHero({ profile, headline, preview }: { profile: Profile; headline: string; preview?: boolean }) {
  return (
    <section className="flex w-full animate-fade-up flex-col items-center text-center @4xl:items-start @4xl:text-left">
      <LivelyAvatar src={profile.avatarUrl} name={profile.displayName} size={preview ? 88 : 112} />
      <h1 className={`mt-6 font-display font-medium text-balance ${preview ? 'text-2xl' : 'text-3xl sm:text-[34px] @4xl:text-[40px] @4xl:leading-tight'}`}>
        {profile.displayName}
      </h1>
      {headline ? (
        <p className={`mt-1.5 font-medium text-balance text-(--p-fg)/80 ${preview ? 'text-sm' : 'text-(length:--p-text-body)'}`}>{headline}</p>
      ) : null}
      <p className="mt-1 text-sm font-medium text-(--p-muted)">@{profile.username}</p>
      {profile.bio ? (
        <p className={`mt-4 max-w-md whitespace-pre-line text-pretty text-(--p-fg)/85 ${preview ? 'text-sm' : 'text-(length:--p-text-body) leading-relaxed'}`}>
          {profile.bio}
        </p>
      ) : null}
      <div className="mt-4 @4xl:-ml-2.5">
        <SocialIcons socials={profile.socials} preview={preview} className="justify-center @4xl:justify-start" />
      </div>
    </section>
  )
}

/** Small header for About and Work on phones, so the page content starts near the top. */
function CompactHero({ profile, headline }: { profile: Profile; headline: string }) {
  return (
    <div className="mb-6 flex animate-fade-up items-center gap-3.5 @4xl:hidden">
      <Avatar src={profile.avatarUrl} name={profile.displayName} size={52} />
      <div className="min-w-0">
        <p className="truncate font-display text-xl font-medium">{profile.displayName}</p>
        {headline ? <p className="truncate text-(length:--p-text-small) text-(--p-muted)">{headline}</p> : null}
      </div>
    </div>
  )
}

/** Avatar with a slowly turning accent halo; floats gently and tilts on hover or tap. */
function LivelyAvatar({ src, name, size }: { src: string | null; name: string; size: number }) {
  return (
    <div className="group relative" style={{ width: size, height: size }}>
      <div
        aria-hidden="true"
        className="absolute -inset-2 animate-spin-slow rounded-full opacity-70 blur-md transition-opacity duration-500 group-hover:opacity-100"
        style={{ background: 'conic-gradient(from 0deg, var(--p-accent), transparent 35%, color-mix(in srgb, var(--p-accent) 60%, white) 60%, transparent 85%, var(--p-accent))' }}
      />
      <div className="relative animate-float">
        <div className="transition duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover:scale-105 group-hover:-rotate-3 group-active:scale-95">
          <Avatar src={src} name={name} size={size} />
        </div>
      </div>
    </div>
  )
}

function PageTabs({
  pages,
  current,
  preview,
  onNavigate,
}: {
  pages: PageKey[]
  current: PageKey
  preview?: boolean
  onNavigate?: (p: PageKey) => void
}) {
  const index = Math.max(0, pages.indexOf(current))
  const item =
    'relative z-10 grid min-h-10 place-items-center rounded-full px-3 text-sm font-medium transition duration-300 active:scale-95'
  return (
    <nav aria-label="Pages" className="mx-auto w-full max-w-xs @4xl:mx-0">
      <div
        className="relative grid rounded-full border border-(--p-border) bg-(--p-card) p-1 shadow-(--p-shadow) backdrop-blur-md"
        style={{ gridTemplateColumns: `repeat(${pages.length}, minmax(0, 1fr))` }}
      >
        {/* Sliding highlight with a little overshoot. */}
        <span
          aria-hidden="true"
          className="absolute inset-y-1 left-1 rounded-full bg-(--p-accent) shadow-[0_6px_20px_-6px_var(--p-accent)] transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
          style={{ width: `calc((100% - 0.5rem) / ${pages.length})`, transform: `translateX(${index * 100}%)` }}
        />
        {pages.map((p) => {
          const active = p === current
          const cls = `${item} ${active ? 'text-(--p-on-accent)' : 'text-(--p-muted) hover:text-(--p-fg)'}`
          return preview || onNavigate ? (
            <button key={p} type="button" className={cls} aria-current={active ? 'page' : undefined} onClick={() => onNavigate?.(p)}>
              {PAGE_LABELS[p]}
            </button>
          ) : (
            <RouterLink key={p} href={PAGE_PATHS[p]} className={cls} aria-current={active ? 'page' : undefined}>
              {PAGE_LABELS[p]}
            </RouterLink>
          )
        })}
      </div>
    </nav>
  )
}

function HomeLinks({ links, profile, preview, empty }: { links: PublicLink[]; profile: Profile; preview?: boolean; empty: boolean }) {
  return (
    <nav aria-label="Links" className="flex w-full flex-col gap-7">
      {groupLinks(links).map((group) => (
        <div key={group.category || '__ungrouped'} className="flex flex-col gap-3">
          {group.category ? (
            <h2 className="text-center text-(length:--p-text-small) font-medium text-(--p-muted) @4xl:text-left">{group.category}</h2>
          ) : null}
          <div className="grid gap-3 @4xl:grid-cols-2">
            {group.links.map(({ link, index }) => (
              <LinkCard key={link.id} link={link} buttonStyle={profile.buttonStyle} preview={preview} index={index} />
            ))}
          </div>
        </div>
      ))}
      {links.length === 0 && empty ? (
        <p className="rounded-(--p-radius-card) border border-dashed border-(--p-border) p-6 text-center text-sm text-(--p-muted)">No links yet.</p>
      ) : null}
    </nav>
  )
}

function NothingHere({ preview, onNavigate }: { preview?: boolean; onNavigate?: (p: PageKey) => void }) {
  return (
    <div className="py-10 text-center @4xl:text-left">
      <p className="text-(--p-muted)">Nothing here yet.</p>
      {preview || onNavigate ? (
        <button type="button" onClick={() => onNavigate?.('home')} className="mt-2 font-medium text-(--p-accent-text)">
          Back home
        </button>
      ) : (
        <RouterLink href="/" className="mt-2 inline-block font-medium text-(--p-accent-text)">
          Back home
        </RouterLink>
      )}
    </div>
  )
}

function ShareButton({ preview, title }: { preview?: boolean; title: string }) {
  const [copied, setCopied] = useState(false)
  async function share() {
    if (preview) return
    const url = window.location.origin + window.location.pathname
    try {
      if (navigator.share) {
        await navigator.share({ title, url })
        return
      }
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      /* user cancelled */
    }
  }
  return (
    <button
      type="button"
      onClick={share}
      aria-label={copied ? 'Link copied' : 'Share this page'}
      title={copied ? 'Copied!' : 'Share'}
      className="grid size-10 place-items-center rounded-full border border-(--p-border) bg-(--p-card) text-(--p-fg) backdrop-blur-md transition duration-300 hover:-rotate-12 hover:bg-(--p-card-hover) active:scale-90"
    >
      {copied ? <Check size={17} aria-hidden="true" /> : <Share2 size={17} aria-hidden="true" />}
    </button>
  )
}
