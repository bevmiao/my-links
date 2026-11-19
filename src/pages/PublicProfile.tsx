import { useEffect, useState } from 'react'
import type { PublicPageData } from '../../shared/types'
import { ProfileView } from '../components/ProfileView'
import { publicApi } from '../lib/api'
import { useThemeMode } from '../lib/theme'

/** Data the Worker embeds in the HTML (<script type="application/json" id="initial-data">). */
function readInitialData(): PublicPageData | null {
  try {
    const el = document.getElementById('initial-data')
    return el?.textContent ? (JSON.parse(el.textContent) as PublicPageData) : null
  } catch {
    return null
  }
}

export default function PublicProfile() {
  const [data, setData] = useState<PublicPageData | null>(readInitialData)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (data) return
    publicApi
      .page()
      .then(setData)
      .catch(() => setError(true))
  }, [data])

  // Record one view per browser session.
  useEffect(() => {
    try {
      if (sessionStorage.getItem('viewed')) return
      sessionStorage.setItem('viewed', '1')
    } catch {
      /* storage blocked — still count it */
    }
    publicApi.trackView()
  }, [])

  useEffect(() => {
    if (data) document.title = `${data.profile.displayName} (@${data.profile.username})`
  }, [data])

  if (error) return <Message title="Something went wrong" body="This page couldn’t be loaded. Please try again shortly." />
  if (!data) return <Skeleton />
  return <ProfilePage data={data} />
}

function ProfilePage({ data }: { data: PublicPageData }) {
  const { mode, toggle } = useThemeMode('profile-theme', data.profile.themeMode)
  useEffect(() => {
    document.documentElement.style.backgroundColor = mode === 'dark' ? data.profile.backgroundDark : data.profile.backgroundLight
  }, [mode, data.profile.backgroundDark, data.profile.backgroundLight])
  return <ProfileView profile={data.profile} links={data.links} mode={mode} onToggleTheme={toggle} />
}

function Skeleton() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-[580px] flex-col items-center px-5 pt-24" aria-busy="true" aria-label="Loading">
      <div className="size-[104px] animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-800" />
      <div className="mt-6 h-6 w-40 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="mt-3 h-4 w-24 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="mt-10 flex w-full flex-col gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-[66px] animate-pulse rounded-2xl bg-zinc-200/70 dark:bg-zinc-800/70" />
        ))}
      </div>
    </div>
  )
}

export function Message({ title, body }: { title: string; body: string }) {
  return (
    <div className="grid min-h-dvh place-items-center px-6 text-center">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{body}</p>
      </div>
    </div>
  )
}
