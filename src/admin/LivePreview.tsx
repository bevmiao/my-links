import { Moon, Sun } from 'lucide-react'
import { useState } from 'react'
import type { Link, Profile } from '../../shared/types'
import { ProfileView } from '../components/ProfileView'
import { resolveMode, type ResolvedMode } from '../lib/theme'
import { cx } from './ui'

/** Phone-framed render of the real public ProfileView, fed with unsaved draft data. */
export function LivePreview({ profile, links, compact }: { profile: Profile; links: Link[]; compact?: boolean }) {
  const [mode, setMode] = useState<ResolvedMode>(() => resolveMode(profile.themeMode))
  const visible = links
    .filter((l) => l.isActive)
    .map(({ id, title, url, description, icon, category }) => ({ id, title, url, description, icon, category }))

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[13px] font-medium text-zinc-500 dark:text-zinc-400">
          {compact ? 'Unsaved edits are shown.' : 'Live preview'}
        </p>
        <div className="flex rounded-lg border border-zinc-200 bg-white p-0.5 dark:border-zinc-800 dark:bg-zinc-900" role="group" aria-label="Preview theme">
          {(['light', 'dark'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={cx(
                'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium capitalize transition',
                mode === m ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white',
              )}
            >
              {m === 'light' ? <Sun size={12} /> : <Moon size={12} />}
              {m}
            </button>
          ))}
        </div>
      </div>
      <div
        className={cx(
          'mx-auto overflow-hidden rounded-[2.2rem] border-[7px] border-zinc-900 bg-zinc-900 shadow-2xl shadow-zinc-900/20 dark:border-zinc-800 dark:shadow-black/40',
          compact ? 'max-w-[340px]' : 'w-full max-w-[360px]',
        )}
      >
        <div className="relative h-[min(680px,70dvh)] overflow-y-auto rounded-[1.7rem] [scrollbar-width:none]">
          <ProfileView profile={profile} links={visible} mode={mode} preview />
        </div>
      </div>
    </div>
  )
}
