import { Check, Coffee, Monitor, Moon, Sun } from 'lucide-react'
import type { ButtonStyle, Profile, ThemeMode } from '../../shared/types'
import { COZY_PRESET } from '../lib/theme'
import { ImageUploader } from './ImageUploader'
import { PageTitle } from './ProfileEditor'
import { Card, ColorInput, cx, Field } from './ui'

const ACCENTS = ['#c06a3c', '#b08a4e', '#7c8b5a', '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316', '#eab308', '#10b981', '#06b6d4', '#3b82f6', '#18181b']
const LIGHT_BGS = ['#f6efe5', '#ffffff', '#fafafa', '#f5f5f4', '#fdf8f3', '#f0f4ff', '#f3faf7']
const DARK_BGS = ['#16120f', '#09090b', '#0a0a0a', '#111113', '#0c0a14', '#0a1210', '#14100c']

const MODES: { value: ThemeMode; label: string; Icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
  { value: 'system', label: 'System', Icon: Monitor },
]

const STYLES: { value: ButtonStyle; label: string; radius: string }[] = [
  { value: 'rounded', label: 'Rounded', radius: 'rounded-xl' },
  { value: 'pill', label: 'Pill', radius: 'rounded-full' },
  { value: 'square', label: 'Square', radius: 'rounded-sm' },
]

interface Props {
  draft: Profile
  onChange: (patch: Partial<Profile>) => void
  errors: Record<string, string>
  onImageUpdated: (p: Profile) => void
}

export function AppearanceEditor({ draft, onChange, errors, onImageUpdated }: Props) {
  return (
    <div className="space-y-6">
      <PageTitle title="Appearance" description="Theme, colours, button style and background." />

      <Card title="Default theme" description="Visitors can still switch with the toggle on your page; their choice is remembered.">
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Default theme">
          {MODES.map(({ value, label, Icon }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={draft.themeMode === value}
              onClick={() => onChange({ themeMode: value })}
              className={cx(
                'flex flex-col items-center gap-2 rounded-xl border px-3 py-4 text-sm font-medium transition',
                draft.themeMode === value
                  ? 'border-zinc-900 bg-zinc-50 dark:border-white dark:bg-zinc-800/60'
                  : 'border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700',
              )}
            >
              <Icon size={18} aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
      </Card>

      <Card
        title="Colours"
        actions={
          <button
            type="button"
            onClick={() => onChange({ ...COZY_PRESET })}
            className="inline-flex h-8 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-[13px] font-medium shadow-xs transition hover:bg-zinc-50 active:scale-[0.98] dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800"
          >
            <span className="flex -space-x-1" aria-hidden="true">
              {[COZY_PRESET.accentColor, COZY_PRESET.backgroundLight, COZY_PRESET.backgroundDark].map((c) => (
                <span key={c} className="size-3.5 rounded-full border border-black/10 dark:border-white/15" style={{ background: c }} />
              ))}
            </span>
            <Coffee size={14} aria-hidden="true" />
            Use “Cozy film” colours
          </button>
        }
      >
        <div className="space-y-6">
          <Field label="Accent colour" htmlFor="accent" error={errors.accentColor} hint="Used for highlights, icons and hover states.">
            <div className="space-y-3">
              <Swatches colors={ACCENTS} value={draft.accentColor} onPick={(accentColor) => onChange({ accentColor })} />
              <div className="max-w-56">
                <ColorInput id="accent" value={draft.accentColor} onChange={(accentColor) => onChange({ accentColor })} />
              </div>
            </div>
          </Field>
          <div className="grid gap-6 sm:grid-cols-2">
            <Field label="Light theme background" htmlFor="bgLight" error={errors.backgroundLight}>
              <div className="space-y-3">
                <Swatches colors={LIGHT_BGS} value={draft.backgroundLight} onPick={(backgroundLight) => onChange({ backgroundLight })} />
                <ColorInput id="bgLight" value={draft.backgroundLight} onChange={(backgroundLight) => onChange({ backgroundLight })} />
              </div>
            </Field>
            <Field label="Dark theme background" htmlFor="bgDark" error={errors.backgroundDark}>
              <div className="space-y-3">
                <Swatches colors={DARK_BGS} value={draft.backgroundDark} onPick={(backgroundDark) => onChange({ backgroundDark })} />
                <ColorInput id="bgDark" value={draft.backgroundDark} onChange={(backgroundDark) => onChange({ backgroundDark })} />
              </div>
            </Field>
          </div>
        </div>
      </Card>

      <Card title="Link style">
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Link style">
          {STYLES.map(({ value, label, radius }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={draft.buttonStyle === value}
              onClick={() => onChange({ buttonStyle: value })}
              className={cx(
                'flex flex-col items-center gap-3 rounded-xl border p-4 text-sm font-medium transition',
                draft.buttonStyle === value
                  ? 'border-zinc-900 bg-zinc-50 dark:border-white dark:bg-zinc-800/60'
                  : 'border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700',
              )}
            >
              <span className={cx('h-7 w-full border border-zinc-300 bg-white dark:border-zinc-600 dark:bg-zinc-800', radius)} />
              {label}
            </button>
          ))}
        </div>
      </Card>

      <Card title="Background image" description="Optional. It’s softly dimmed with your theme colour so text stays readable.">
        <ImageUploader kind="background" shape="wide" currentUrl={draft.backgroundUrl} onUpdated={onImageUpdated} />
      </Card>
    </div>
  )
}

function Swatches({ colors, value, onPick }: { colors: string[]; value: string; onPick: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {colors.map((c) => {
        const active = c.toLowerCase() === value.toLowerCase()
        return (
          <button
            key={c}
            type="button"
            onClick={() => onPick(c)}
            aria-label={`Use ${c}`}
            aria-pressed={active}
            className={cx(
              'grid size-8 place-items-center rounded-full border shadow-xs transition hover:scale-110',
              active ? 'ring-2 ring-zinc-900 ring-offset-2 ring-offset-white dark:ring-white dark:ring-offset-zinc-900' : '',
              'border-black/10 dark:border-white/10',
            )}
            style={{ background: c }}
          >
            {active ? <Check size={14} style={{ color: isLight(c) ? '#000' : '#fff' }} /> : null}
          </button>
        )
      })}
    </div>
  )
}

function isLight(hex: string) {
  const n = parseInt(hex.slice(1), 16)
  return ((n >> 16) & 255) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114 > 160
}
