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
  isActive: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export type LinkInput = Pick<Link, 'title' | 'url' | 'description' | 'icon' | 'isActive'>

/** Link shape exposed publicly (no timestamps / ordering internals). */
export interface PublicLink {
  id: number
  title: string
  url: string
  description: string
  icon: string
}

export interface PublicPageData {
  profile: Profile
  links: PublicLink[]
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
