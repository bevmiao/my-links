/**
 * Icon registries.
 *  - SOCIAL_PLATFORMS: brand icons for the social row (from simple-icons, CC0).
 *  - LINK_ICONS: optional icons for link cards (generic lucide icons + all brand icons).
 * Unknown keys render nothing, so stale data can never break the page.
 */
import {
  BookOpen,
  Briefcase,
  Calendar,
  Camera,
  Code,
  Coffee,
  FileText,
  Gamepad2,
  Gift,
  Globe,
  GraduationCap,
  Heart,
  Link as LinkIcon,
  Mail,
  MapPin,
  Mic,
  Music,
  Newspaper,
  Palette,
  PenTool,
  Play,
  Podcast,
  Rocket,
  ShoppingBag,
  Sparkles,
  Star,
  Video,
  type LucideIcon,
} from 'lucide-react'
import {
  siBehance,
  siBluesky,
  siDiscord,
  siDribbble,
  siFacebook,
  siGithub,
  siInstagram,
  siKofi,
  siMastodon,
  siMedium,
  siPatreon,
  siPinterest,
  siReddit,
  siSoundcloud,
  siSpotify,
  siSubstack,
  siTelegram,
  siThreads,
  siTiktok,
  siTwitch,
  siX,
  siYoutube,
} from 'simple-icons'
import type { SVGProps } from 'react'

// LinkedIn is not distributed by simple-icons; this is the standard 24×24 glyph.
const LINKEDIN_PATH =
  'M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z'

type IconComponent = (props: SVGProps<SVGSVGElement> & { size?: number }) => React.ReactElement

function brand(path: string): IconComponent {
  return function BrandIcon({ size = 20, ...props }) {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true" {...props}>
        <path d={path} />
      </svg>
    )
  }
}

function lucide(Icon: LucideIcon): IconComponent {
  return function LucideWrapped({ size = 20, ...props }) {
    return <Icon size={size} strokeWidth={1.8} aria-hidden="true" {...(props as object)} />
  }
}

export interface Platform {
  key: string
  label: string
  Icon: IconComponent
  placeholder: string
}

export const SOCIAL_PLATFORMS: Platform[] = [
  { key: 'instagram', label: 'Instagram', Icon: brand(siInstagram.path), placeholder: 'https://instagram.com/you' },
  { key: 'x', label: 'X', Icon: brand(siX.path), placeholder: 'https://x.com/you' },
  { key: 'tiktok', label: 'TikTok', Icon: brand(siTiktok.path), placeholder: 'https://tiktok.com/@you' },
  { key: 'youtube', label: 'YouTube', Icon: brand(siYoutube.path), placeholder: 'https://youtube.com/@you' },
  { key: 'github', label: 'GitHub', Icon: brand(siGithub.path), placeholder: 'https://github.com/you' },
  { key: 'linkedin', label: 'LinkedIn', Icon: brand(LINKEDIN_PATH), placeholder: 'https://linkedin.com/in/you' },
  { key: 'bluesky', label: 'Bluesky', Icon: brand(siBluesky.path), placeholder: 'https://bsky.app/profile/you' },
  { key: 'threads', label: 'Threads', Icon: brand(siThreads.path), placeholder: 'https://threads.net/@you' },
  { key: 'mastodon', label: 'Mastodon', Icon: brand(siMastodon.path), placeholder: 'https://mastodon.social/@you' },
  { key: 'facebook', label: 'Facebook', Icon: brand(siFacebook.path), placeholder: 'https://facebook.com/you' },
  { key: 'twitch', label: 'Twitch', Icon: brand(siTwitch.path), placeholder: 'https://twitch.tv/you' },
  { key: 'discord', label: 'Discord', Icon: brand(siDiscord.path), placeholder: 'https://discord.gg/invite' },
  { key: 'spotify', label: 'Spotify', Icon: brand(siSpotify.path), placeholder: 'https://open.spotify.com/artist/…' },
  { key: 'soundcloud', label: 'SoundCloud', Icon: brand(siSoundcloud.path), placeholder: 'https://soundcloud.com/you' },
  { key: 'dribbble', label: 'Dribbble', Icon: brand(siDribbble.path), placeholder: 'https://dribbble.com/you' },
  { key: 'behance', label: 'Behance', Icon: brand(siBehance.path), placeholder: 'https://behance.net/you' },
  { key: 'pinterest', label: 'Pinterest', Icon: brand(siPinterest.path), placeholder: 'https://pinterest.com/you' },
  { key: 'reddit', label: 'Reddit', Icon: brand(siReddit.path), placeholder: 'https://reddit.com/user/you' },
  { key: 'medium', label: 'Medium', Icon: brand(siMedium.path), placeholder: 'https://medium.com/@you' },
  { key: 'substack', label: 'Substack', Icon: brand(siSubstack.path), placeholder: 'https://you.substack.com' },
  { key: 'patreon', label: 'Patreon', Icon: brand(siPatreon.path), placeholder: 'https://patreon.com/you' },
  { key: 'kofi', label: 'Ko-fi', Icon: brand(siKofi.path), placeholder: 'https://ko-fi.com/you' },
  { key: 'telegram', label: 'Telegram', Icon: brand(siTelegram.path), placeholder: 'https://t.me/you' },
  { key: 'email', label: 'Email', Icon: lucide(Mail), placeholder: 'mailto:you@example.com' },
  { key: 'website', label: 'Website', Icon: lucide(Globe), placeholder: 'https://example.com' },
]

const PLATFORM_MAP = new Map(SOCIAL_PLATFORMS.map((p) => [p.key, p]))
export const getPlatform = (key: string) => PLATFORM_MAP.get(key)

export interface LinkIconDef {
  key: string
  label: string
  Icon: IconComponent
}

const GENERIC_ICONS: LinkIconDef[] = [
  { key: 'link', label: 'Link', Icon: lucide(LinkIcon) },
  { key: 'globe', label: 'Website', Icon: lucide(Globe) },
  { key: 'mail', label: 'Mail', Icon: lucide(Mail) },
  { key: 'calendar', label: 'Calendar', Icon: lucide(Calendar) },
  { key: 'book', label: 'Book', Icon: lucide(BookOpen) },
  { key: 'newspaper', label: 'Article', Icon: lucide(Newspaper) },
  { key: 'file', label: 'Document', Icon: lucide(FileText) },
  { key: 'music', label: 'Music', Icon: lucide(Music) },
  { key: 'video', label: 'Video', Icon: lucide(Video) },
  { key: 'play', label: 'Play', Icon: lucide(Play) },
  { key: 'podcast', label: 'Podcast', Icon: lucide(Podcast) },
  { key: 'mic', label: 'Mic', Icon: lucide(Mic) },
  { key: 'camera', label: 'Photo', Icon: lucide(Camera) },
  { key: 'palette', label: 'Art', Icon: lucide(Palette) },
  { key: 'pen', label: 'Design', Icon: lucide(PenTool) },
  { key: 'code', label: 'Code', Icon: lucide(Code) },
  { key: 'rocket', label: 'Launch', Icon: lucide(Rocket) },
  { key: 'sparkles', label: 'New', Icon: lucide(Sparkles) },
  { key: 'star', label: 'Star', Icon: lucide(Star) },
  { key: 'heart', label: 'Heart', Icon: lucide(Heart) },
  { key: 'shop', label: 'Shop', Icon: lucide(ShoppingBag) },
  { key: 'gift', label: 'Gift', Icon: lucide(Gift) },
  { key: 'coffee', label: 'Coffee', Icon: lucide(Coffee) },
  { key: 'briefcase', label: 'Work', Icon: lucide(Briefcase) },
  { key: 'education', label: 'Course', Icon: lucide(GraduationCap) },
  { key: 'game', label: 'Game', Icon: lucide(Gamepad2) },
  { key: 'location', label: 'Location', Icon: lucide(MapPin) },
]

export const LINK_ICONS: LinkIconDef[] = [
  ...GENERIC_ICONS,
  ...SOCIAL_PLATFORMS.filter((p) => p.key !== 'email' && p.key !== 'website').map(({ key, label, Icon }) => ({
    key,
    label,
    Icon,
  })),
]
const LINK_ICON_MAP = new Map(LINK_ICONS.map((i) => [i.key, i]))
export const getLinkIcon = (key: string) => (key ? LINK_ICON_MAP.get(key) : undefined)
