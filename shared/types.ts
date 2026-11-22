/** Types shared by the Worker (API) and the React frontend. */

export type ThemeMode = 'light' | 'dark' | 'system'
export type ButtonStyle = 'rounded' | 'pill' | 'square'
/** Film grain on the public site: animated, a still texture, or none. */
export type GrainMode = 'moving' | 'still' | 'off'

export interface SocialLink {
  platform: string
  url: string
}

export interface Profile {
  username: string
  displayName: string
  bio: string
  /** Public URL of the avatar (served from R2 via /media/…), or null. */
  avatarUrl: string | null
  /** Public URL of the optional background image, or null. */
  backgroundUrl: string | null
  themeMode: ThemeMode
  accentColor: string
  backgroundLight: string
  backgroundDark: string
  buttonStyle: ButtonStyle
  grain: GrainMode
  socials: SocialLink[]
  updatedAt: string
}

/** Fields an admin may edit through PUT /api/admin/profile. */
export type ProfileInput = Omit<Profile, 'avatarUrl' | 'backgroundUrl' | 'updatedAt'>

export interface Link {
  id: number
  title: string
  url: string
  description: string
  icon: string
  /** Optional group name shown as a heading on the public page. '' = uncategorised. */
  category: string
  isActive: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export type LinkInput = Pick<Link, 'title' | 'url' | 'description' | 'icon' | 'category' | 'isActive'>

/** Link shape exposed publicly (no timestamps / ordering internals). */
export interface PublicLink {
  id: number
  title: string
  url: string
  description: string
  icon: string
  category: string
}

export interface PublicPageData {
  profile: Profile
  links: PublicLink[]
  /** Published homepage sections, or null if nothing has been published yet. */
  homepage: PublicHomepage | null
}

/* ---------------- Homepage sections (draft / publish) ---------------- */

/**
 * 'opportunities' is the one-sentence "what I'm up for" section (the key predates the redesign).
 * 'experience' was removed in pass 1b; any stored row for it is ignored.
 */
export const SECTION_KEYS = ['intro', 'story', 'skills', 'opportunities', 'videos', 'contact', 'testimonials', 'clients'] as const
export type SectionKey = (typeof SECTION_KEYS)[number]

/** Public pages. Home holds the links; homepage sections live on About and Work. */
export const PAGES = ['home', 'about', 'work'] as const
export type PageKey = (typeof PAGES)[number]

/** Which page each section appears on. Order within a page follows the section order. Home shows sections under the links. */
export const SECTION_PAGE: Record<SectionKey, PageKey> = {
  intro: 'about',
  story: 'about',
  skills: 'about',
  opportunities: 'work',
  videos: 'work',
  contact: 'work',
  testimonials: 'work',
  clients: 'home',
}

/** "Where I grew up": shown on the About page and when a visitor taps the location. */
export interface HomepageStory {
  title: string
  body: string
}

export interface HomepageIntro {
  /** Short line shown under the name. */
  headline: string
  /** A few sentences in the owner's own words. */
  about: string
}

/**
 * Contact details. LinkedIn lives in the social icons, not here. (The table also has phone,
 * LinkedIn, and resume columns from pass 1; they are unused and kept to avoid deleting data.)
 */
export interface HomepageContact {
  email: string
  location: string
  portfolioUrl: string
  /** Show the portfolio as "coming soon" instead of a live link. */
  portfolioComingSoon: boolean
}

export interface SkillItem {
  label: string
}

/** A YouTube video. Only the ID is stored; the player loads when a visitor taps it. */
export interface VideoItem {
  /** The 11-character YouTube video ID. */
  videoId: string
  title: string
}

/** A photo in a client's pop-up card. `key` is an R2 key under client-photo/. */
export interface ClientImage {
  key: string
  /** Describes the photo for screen readers. Optional; a generic description is used if empty. */
  alt: string
}

/**
 * A client in the logo strip. `logoKey` is an R2 key under client-logo/ (an uploaded logo), a
 * bundled placeholder (placeholder/client-N.png), or null for a text-only name.
 * Clients with a title, bullets or images open into a pop-up card.
 */
export interface ClientItem {
  name: string
  logoKey: string | null
  /** Draw the logo in one colour that follows the light/dark theme (needs a transparent background). */
  logoMono: boolean
  title: string
  bullets: string[]
  images: ClientImage[]
}

/** Public shape of a client: URLs instead of storage keys. */
export interface PublicClient {
  name: string
  logoUrl: string | null
  logoMono: boolean
  title: string
  bullets: string[]
  images: { url: string; alt: string }[]
}

export interface SectionSetting {
  key: SectionKey
  visible: boolean
}

/** One complete copy of the homepage content (the draft or the published version). */
export interface HomepageContent {
  intro: HomepageIntro
  story: HomepageStory
  contact: HomepageContact
  skills: SkillItem[]
  /** One sentence about what the owner is up for (shown in the 'opportunities' section). */
  openTo: string
  videos: VideoItem[]
  clients: ClientItem[]
  /** Every section key exactly once, in display order. */
  sections: SectionSetting[]
}

/** What GET /api/admin/homepage returns. */
export interface HomepageAdminState {
  draft: HomepageContent
  published: HomepageContent | null
  publishedAt: string | null
  hasUnpublishedChanges: boolean
}

/** Public shape: only visible, non-empty sections, in order. Hidden content is never included. */
export type PublicSection =
  | { key: 'intro'; intro: HomepageIntro }
  | { key: 'story'; story: HomepageStory }
  | { key: 'skills'; items: SkillItem[] }
  | { key: 'opportunities'; sentence: string }
  | { key: 'videos'; items: VideoItem[] }
  /** `story` is set only when the story section is visible, so a hidden story never leaks through the location pop-up. */
  | { key: 'contact'; contact: HomepageContact; story: HomepageStory | null }
  | { key: 'testimonials' }
  | { key: 'clients'; items: PublicClient[] }

export interface PublicHomepage {
  sections: PublicSection[]
}

export interface AnalyticsSummary {
  rangeDays: number
  totals: {
    views: number
    clicks: number
    /** Clicks ÷ views, 0–1. */
    ctr: number
    allTimeViews: number
    allTimeClicks: number
  }
  /** One entry per day in the range (UTC), oldest first. */
  daily: { date: string; views: number; clicks: number }[]
  links: { id: number; title: string; url: string; isActive: boolean; clicks: number; allTimeClicks: number }[]
  referrers: { name: string; count: number }[]
  countries: { name: string; count: number }[]
  devices: { name: string; count: number }[]
}

export interface AdminIdentity {
  email: string
  /** True when running locally with DEV_AUTH_BYPASS — never true in production. */
  devBypass: boolean
  /** Where the public profile is served (absolute URL, or '/' in local dev). */
  publicUrl: string
}

export interface ApiError {
  error: string
  fields?: Record<string, string>
}
