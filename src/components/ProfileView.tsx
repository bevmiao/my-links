import { Check, Share2 } from 'lucide-react'
import { useState } from 'react'
import type { Profile, PublicHomepage, PublicLink } from '../../shared/types'
import { profilePalette, type ResolvedMode } from '../lib/theme'
import { Avatar } from './Avatar'
import { HomepageSections } from './HomepageSections'
import { LinkCard } from './LinkCard'
import { SocialIcons } from './SocialIcons'
import { ThemeToggle } from './ThemeToggle'

interface ProfileViewProps {
  profile: Profile
  links: PublicLink[]
  /** Published homepage sections (or the draft, in the dashboard preview). */
  homepage?: PublicHomepage | null
  mode: ResolvedMode
  onToggleTheme?: () => void
  /** Rendered inside the dashboard's live preview frame. */
  preview?: boolean
}

/** Uncategorised links first, then one group per category in the order categories first appear. */
function groupLinks(links: PublicLink[]) {
  const groups: { category: string; links: PublicLink[] }[] = [{ category: '', links: [] }]
  for (const link of links) {
    let group = groups.find((g) => g.category === link.category)
    if (!group) groups.push((group = { category: link.category, links: [] }))
    group.links.push(link)
  }
  return groups.filter((g) => g.links.length)
}

export function ProfileView({ profile, links, homepage, mode, onToggleTheme, preview }: ProfileViewProps) {
  const palette = profilePalette(profile, mode)
  const glowStrength = mode === 'dark' ? 22 : 14
  const introSection = homepage?.sections.find((s) => s.key === 'intro')
  const headline = introSection?.key === 'intro' ? introSection.intro.headline : ''
  let linkIndex = 0

  return (
    <div
      style={palette}
      className={`relative isolate flex flex-col overflow-hidden bg-(--p-bg) text-(--p-fg) transition-colors duration-500 ${preview ? 'min-h-full' : 'min-h-dvh'}`}
    >
      {/* Background: optional image (dimmed with the theme colour for legibility) + soft accent glow */}
      {profile.backgroundUrl ? (
        <div aria-hidden="true" className="absolute inset-0 -z-10">
          <img src={profile.backgroundUrl} alt="" className="h-full w-full scale-105 object-cover blur-[2px]" />
          <div className="absolute inset-0 bg-(--p-bg) opacity-80" />
        </div>
      ) : null}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px]"
        style={{
          background: `radial-gradient(60% 55% at 50% 0%, color-mix(in srgb, var(--p-accent) ${glowStrength}%, transparent), transparent 70%)`,
        }}
      />
      {mode === 'dark' ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-80"
          style={{ background: 'radial-gradient(50% 60% at 50% 100%, rgba(255,255,255,0.035), transparent 70%)' }}
        />
      ) : null}

      <header className={`flex items-center justify-between ${preview ? 'p-3' : 'p-4 sm:p-6'}`}>
        <ShareButton preview={preview} title={profile.displayName} />
        {onToggleTheme ? (
          <ThemeToggle
            mode={mode}
            onToggle={onToggleTheme}
            className="border border-(--p-border) bg-(--p-card) text-(--p-fg) backdrop-blur-md hover:bg-(--p-card-hover)"
          />
        ) : (
          <span />
        )}
      </header>

      <main className={`mx-auto flex w-full max-w-(--p-content-width) flex-1 flex-col items-center ${preview ? 'px-4 pb-6' : 'px-5 pb-10 sm:px-6'}`}>
        <section className="flex animate-fade-up flex-col items-center text-center">
          <Avatar src={profile.avatarUrl} name={profile.displayName} size={preview ? 84 : 104} />
          <h1 className={`mt-5 font-semibold tracking-tight text-balance ${preview ? 'text-xl' : 'text-2xl sm:text-[28px]'}`}>
            {profile.displayName}
          </h1>
          {headline ? (
            <p className={`mt-1.5 font-medium text-balance text-(--p-fg)/80 ${preview ? 'text-sm' : 'text-(length:--p-text-body)'}`}>{headline}</p>
          ) : null}
          <p className="mt-1 text-sm font-medium text-(--p-muted)">@{profile.username}</p>
          {profile.bio ? (
            <p className={`mt-4 max-w-md whitespace-pre-line text-pretty text-(--p-fg)/85 ${preview ? 'text-sm' : 'text-[15px] leading-relaxed'}`}>
              {profile.bio}
            </p>
          ) : null}
          <div className="mt-4">
            <SocialIcons socials={profile.socials} preview={preview} />
          </div>
        </section>

        <nav aria-label="Links" className="mt-8 flex w-full flex-col gap-6">
          {groupLinks(links).map((group) => (
            <div key={group.category || '__ungrouped'} className="flex flex-col gap-3">
              {group.category ? (
                <h2 className="text-center text-(length:--p-text-heading) font-semibold tracking-wider text-(--p-muted) uppercase">
                  {group.category}
                </h2>
              ) : null}
              {group.links.map((link) => (
                <LinkCard key={link.id} link={link} buttonStyle={profile.buttonStyle} preview={preview} index={linkIndex++} />
              ))}
            </div>
          ))}
          {links.length === 0 && !homepage?.sections.length ? (
            <p className="rounded-(--p-radius-card) border border-dashed border-(--p-border) p-6 text-center text-sm text-(--p-muted)">
              No links yet.
            </p>
          ) : null}
        </nav>

        {homepage ? <HomepageSections homepage={homepage} preview={preview} /> : null}
      </main>

      <footer className="pb-6 text-center text-xs text-(--p-muted)">
        <a
          href={preview ? undefined : '/'}
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 transition hover:text-(--p-fg)"
        >
          <span className="size-1.5 rounded-full bg-(--p-accent)" aria-hidden="true" />
          <span className="font-medium tracking-tight">{profile.displayName}</span>
          <span aria-hidden="true">·</span>
          <span>© {new Date().getFullYear()}</span>
        </a>
      </footer>
    </div>
  )
}

function ShareButton({ preview, title }: { preview?: boolean; title: string }) {
  const [copied, setCopied] = useState(false)
  async function share() {
    if (preview) return
    const url = window.location.origin + '/'
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
      className="grid size-10 place-items-center rounded-full border border-(--p-border) bg-(--p-card) text-(--p-fg) backdrop-blur-md transition hover:bg-(--p-card-hover) active:scale-95"
    >
      {copied ? <Check size={17} aria-hidden="true" /> : <Share2 size={17} aria-hidden="true" />}
    </button>
  )
}
