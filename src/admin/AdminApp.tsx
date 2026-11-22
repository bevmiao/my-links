import { BarChart3, ExternalLink, Eye, House, Link2, Palette, ShieldAlert, UserRound } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toPublicHomepage } from '../../shared/homepage'
import type { AdminIdentity, HomepageAdminState, HomepageContent, Link, Profile, ProfileInput } from '../../shared/types'
import { ThemeToggle } from '../components/ThemeToggle'
import { adminApi, ApiRequestError } from '../lib/api'
import { RouterLink } from '../components/RouterLink'
import { navigate, usePathname } from '../lib/router'
import { useThemeMode } from '../lib/theme'
import { Analytics } from './Analytics'
import { AppearanceEditor } from './AppearanceEditor'
import { HomepageEditor } from './HomepageEditor'
import { changedParts } from './homepageParts'
import { LinkManager } from './LinkManager'
import { LivePreview } from './LivePreview'
import { ProfileEditor } from './ProfileEditor'
import { Button, cx, Modal, ToastProvider, useToast } from './ui'

const NAV = [
  { href: '/admin', label: 'Profile', Icon: UserRound },
  { href: '/admin/homepage', label: 'Homepage', Icon: House },
  { href: '/admin/links', label: 'Links', Icon: Link2 },
  { href: '/admin/appearance', label: 'Appearance', Icon: Palette },
  { href: '/admin/analytics', label: 'Analytics', Icon: BarChart3 },
] as const

export default function AdminApp() {
  const theme = useThemeMode('admin-theme', 'system')
  useEffect(() => {
    document.title = 'Dashboard'
    document.documentElement.style.backgroundColor = ''
  }, [])
  return (
    <ToastProvider>
      <Dashboard theme={theme} />
    </ToastProvider>
  )
}

type LoadState =
  | { status: 'loading' }
  | { status: 'denied'; message: string }
  | { status: 'error'; message: string }
  | { status: 'ready'; me: AdminIdentity }

function toInput(p: Profile): ProfileInput {
  return {
    username: p.username,
    displayName: p.displayName,
    bio: p.bio,
    themeMode: p.themeMode,
    accentColor: p.accentColor,
    backgroundLight: p.backgroundLight,
    backgroundDark: p.backgroundDark,
    buttonStyle: p.buttonStyle,
    socials: p.socials,
  }
}

function Dashboard({ theme }: { theme: ReturnType<typeof useThemeMode> }) {
  const path = usePathname()
  const toast = useToast()
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [saved, setSaved] = useState<Profile | null>(null)
  const [draft, setDraft] = useState<Profile | null>(null)
  const [links, setLinks] = useState<Link[]>([])
  const [saving, setSaving] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [previewOpen, setPreviewOpen] = useState(false)
  // Homepage sections: server state (saved draft + published) and local, unsaved edits.
  const [homepage, setHomepage] = useState<HomepageAdminState | null>(null)
  const [homeDraft, setHomeDraft] = useState<HomepageContent | null>(null)
  const [homepageError, setHomepageError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const me = await adminApi.me()
        const [profile, links, home] = await Promise.all([
          adminApi.getProfile(),
          adminApi.listLinks(),
          // The rest of the dashboard still works if this fails (e.g. migration 0002 not applied yet).
          adminApi.getHomepage().catch((e: unknown) => (e instanceof Error ? e : new Error('Failed to load'))),
        ])
        if (cancelled) return
        setSaved(profile)
        setDraft(profile)
        setLinks(links)
        if (home instanceof Error) setHomepageError(home.message)
        else {
          setHomepage(home)
          setHomeDraft(home.draft)
        }
        setState({ status: 'ready', me })
      } catch (e) {
        if (cancelled) return
        if (e instanceof ApiRequestError && (e.status === 401 || e.status === 403))
          setState({ status: 'denied', message: e.message })
        else setState({ status: 'error', message: e instanceof Error ? e.message : 'Failed to load' })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const dirty = useMemo(
    () => !!saved && !!draft && JSON.stringify(toInput(saved)) !== JSON.stringify(toInput(draft)),
    [saved, draft],
  )

  const homeDirty = !!homepage && !!homeDraft && changedParts(homepage.draft, homeDraft).length > 0
  const previewHomepage = useMemo(() => (homeDraft ? toPublicHomepage(homeDraft) : null), [homeDraft])

  const onHomepageSaved = useCallback((s: HomepageAdminState) => {
    setHomepage(s)
    setHomeDraft(s.draft)
  }, [])

  useEffect(() => {
    if (!dirty && !homeDirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty, homeDirty])

  const updateDraft = useCallback((patch: Partial<Profile>) => {
    setDraft((d) => (d ? { ...d, ...patch } : d))
    setFieldErrors((errs) => {
      const next = { ...errs }
      for (const k of Object.keys(patch)) delete next[k]
      if ('socials' in patch) for (const k of Object.keys(next)) if (k.startsWith('socials')) delete next[k]
      return next
    })
  }, [])

  /** Image uploads persist immediately; merge only the image URLs so other unsaved edits survive. */
  const applyImageUpdate = useCallback((p: Profile) => {
    setSaved((s) => (s ? { ...s, avatarUrl: p.avatarUrl, backgroundUrl: p.backgroundUrl } : p))
    setDraft((d) => (d ? { ...d, avatarUrl: p.avatarUrl, backgroundUrl: p.backgroundUrl } : p))
  }, [])

  async function save() {
    if (!draft) return
    setSaving(true)
    try {
      const updated = await adminApi.saveProfile(toInput(draft))
      setSaved(updated)
      setDraft(updated)
      setFieldErrors({})
      toast('Changes saved')
    } catch (e) {
      if (e instanceof ApiRequestError && e.fields) setFieldErrors(e.fields)
      toast(e instanceof Error ? e.message : 'Save failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (state.status === 'loading') return <FullScreen><div className="size-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-white" /></FullScreen>
  if (state.status === 'denied')
    return (
      <FullScreen>
        <div className="max-w-sm text-center">
          <ShieldAlert className="mx-auto text-zinc-400" size={28} />
          <h1 className="mt-3 text-lg font-semibold">Access required</h1>
          <p className="mt-1.5 text-sm text-zinc-500">
            The dashboard is protected by Cloudflare Access. Sign in through your admin hostname to continue.
          </p>
          <p className="mt-3 text-xs text-zinc-400">{state.message}</p>
        </div>
      </FullScreen>
    )
  if (state.status === 'error' || !draft || !saved)
    return (
      <FullScreen>
        <div className="text-center">
          <h1 className="text-lg font-semibold">Couldn’t load the dashboard</h1>
          <p className="mt-1.5 text-sm text-zinc-500">{state.status === 'error' ? state.message : ''}</p>
          <Button className="mt-4" onClick={() => location.reload()}>
            Retry
          </Button>
        </div>
      </FullScreen>
    )

  const section = NAV.find((n) => n.href === path) ? path : '/admin'
  if (section !== path) queueMicrotask(() => navigate('/admin', { replace: true }))
  const showsDraft = section === '/admin' || section === '/admin/appearance'
  const publicUrl = state.me.publicUrl

  return (
    <div className="min-h-dvh bg-zinc-50 dark:bg-zinc-950">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-zinc-200/80 bg-white/80 backdrop-blur-xl dark:border-zinc-800/80 dark:bg-zinc-950/80">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <img src="/favicon.svg" alt="" className="size-7" />
            <span className="hidden text-[15px] font-semibold tracking-tight sm:inline">Dashboard</span>
          </div>
          <nav className="ml-2 hidden items-center gap-0.5 md:flex" aria-label="Sections">
            {NAV.map(({ href, label, Icon }) => (
              <RouterLink
                key={href}
                href={href}
                aria-current={section === href ? 'page' : undefined}
                className={cx(
                  'inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition',
                  section === href
                    ? 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800/80 dark:text-white'
                    : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white',
                )}
              >
                <Icon size={15} aria-hidden="true" />
                {label}
              </RouterLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1.5">
            {state.me.devBypass ? (
              <span className="hidden rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-800 sm:inline dark:bg-amber-500/15 dark:text-amber-300">
                Local dev · auth bypassed
              </span>
            ) : (
              <span className="hidden max-w-48 truncate text-xs text-zinc-500 lg:inline" title={state.me.email}>
                {state.me.email}
              </span>
            )}
            <a
              href={publicUrl}
              target="_blank"
              rel="noopener"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
            >
              <ExternalLink size={14} aria-hidden="true" />
              <span className="hidden sm:inline">View site</span>
            </a>
            <ThemeToggle
              mode={theme.mode}
              onToggle={theme.toggle}
              className="size-8 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            />
          </div>
        </div>
        {/* Mobile nav */}
        <nav className="flex gap-1 overflow-x-auto px-3 pb-2 md:hidden" aria-label="Sections">
          {NAV.map(({ href, label, Icon }) => (
            <RouterLink
              key={href}
              href={href}
              aria-current={section === href ? 'page' : undefined}
              className={cx(
                'inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium',
                section === href ? 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-white' : 'text-zinc-500',
              )}
            >
              <Icon size={14} aria-hidden="true" />
              {label}
            </RouterLink>
          ))}
        </nav>
      </header>

      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-6 sm:px-6 sm:py-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        <main className={cx('min-w-0', section === '/admin/analytics' && 'lg:col-span-2')}>
          {section === '/admin' && (
            <ProfileEditor draft={draft} onChange={updateDraft} errors={fieldErrors} onImageUpdated={applyImageUpdate} />
          )}
          {section === '/admin/homepage' &&
            (homepage && homeDraft ? (
              <HomepageEditor state={homepage} draft={homeDraft} setDraft={setHomeDraft} onSaved={onHomepageSaved} />
            ) : (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                <p className="font-medium">The homepage editor couldn’t load.</p>
                <p className="mt-1">
                  If this database hasn’t had the latest migrations applied yet, that’s expected. Ask for migration 0002 to be applied,
                  then reload. {homepageError ? `(${homepageError})` : null}
                </p>
              </div>
            ))}
          {section === '/admin/links' && <LinkManager links={links} setLinks={setLinks} />}
          {section === '/admin/appearance' && (
            <AppearanceEditor draft={draft} onChange={updateDraft} errors={fieldErrors} onImageUpdated={applyImageUpdate} />
          )}
          {section === '/admin/analytics' && <Analytics />}
        </main>

        {section !== '/admin/analytics' ? (
          <aside className="hidden lg:block">
            <div className="sticky top-20">
              <LivePreview profile={draft} links={links} homepage={previewHomepage} />
            </div>
          </aside>
        ) : null}
      </div>

      {/* Mobile preview */}
      {section !== '/admin/analytics' ? (
        <>
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            className={cx(
              'fixed right-4 z-30 inline-flex items-center gap-2 rounded-full bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white shadow-lg lg:hidden dark:bg-white dark:text-zinc-900',
              dirty && showsDraft ? 'bottom-20' : 'bottom-4',
            )}
          >
            <Eye size={16} aria-hidden="true" /> Preview
          </button>
          <Modal open={previewOpen} onClose={() => setPreviewOpen(false)} title="Live preview">
            <LivePreview profile={draft} links={links} homepage={previewHomepage} compact />
          </Modal>
        </>
      ) : null}

      {/* Unsaved changes bar */}
      {dirty ? (
        <div className="fixed inset-x-0 bottom-0 z-40 animate-pop-in p-3 sm:bottom-4 sm:p-0">
          <div className="mx-auto flex max-w-xl items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white/95 px-4 py-3 shadow-xl backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95">
            <p className="text-sm">
              <span className="font-medium">Unsaved changes</span>
              <span className="hidden text-zinc-500 sm:inline"> — the preview shows your edits.</span>
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setDraft(saved)
                  setFieldErrors({})
                }}
              >
                Discard
              </Button>
              <Button size="sm" variant="primary" loading={saving} onClick={save}>
                Save changes
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function FullScreen({ children }: { children: React.ReactNode }) {
  return <div className="grid min-h-dvh place-items-center bg-zinc-50 px-6 dark:bg-zinc-950">{children}</div>
}
