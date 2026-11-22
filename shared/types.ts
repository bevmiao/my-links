/** Types shared by the Worker (API) and the React frontend. */

export type ThemeMode = 'light' | 'dark' | 'system'
export type ButtonStyle = 'rounded' | 'pill' | 'square'

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

export const SECTION_KEYS = ['intro', 'experience', 'skills', 'opportunities', 'contact', 'testimonials'] as const
export type SectionKey = (typeof SECTION_KEYS)[number]

export interface HomepageIntro {
  headline: string
  intro: string
  about: string
  background: string
  interests: string[]
}

export interface HomepageContact {
  email: string
  phone: string
  location: string
  linkedinUrl: string
  /** Link to a hosted resume (for example a Google Drive file). Never an upload. */
  resumeUrl: string
  portfolioUrl: string
  /** Show the portfolio as "coming soon" instead of a live link. */
  portfolioComingSoon: boolean
}

export interface SkillItem {
  label: string
}

export interface ExperienceItem {
  role: string
  organization: string
  period: string
  description: string
}

export interface OpportunityItem {
  title: string
  description: string
}

export interface SectionSetting {
  key: SectionKey
  visible: boolean
}

/** One complete copy of the homepage content (the draft or the published version). */
export interface HomepageContent {
  intro: HomepageIntro
  contact: HomepageContact
  skills: SkillItem[]
  experience: ExperienceItem[]
  opportunities: OpportunityItem[]
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
  | { key: 'experience'; items: ExperienceItem[] }
  | { key: 'skills'; items: SkillItem[] }
  | { key: 'opportunities'; items: OpportunityItem[] }
  | { key: 'contact'; contact: HomepageContact }
  | { key: 'testimonials' }

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
