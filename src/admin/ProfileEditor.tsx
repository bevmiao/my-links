import { Plus, Trash2 } from 'lucide-react'
import type { Profile, SocialLink } from '../../shared/types'
import { LIMITS } from '../../shared/validation'
import { getPlatform, SOCIAL_PLATFORMS } from '../components/icons'
import { ImageUploader } from './ImageUploader'
import { Button, Card, Field, Input, Textarea } from './ui'

interface Props {
  draft: Profile
  onChange: (patch: Partial<Profile>) => void
  errors: Record<string, string>
  onImageUpdated: (p: Profile) => void
}

export function ProfileEditor({ draft, onChange, errors, onImageUpdated }: Props) {
  return (
    <div className="space-y-6">
      <PageTitle title="Profile" description="Your name, photo, bio and social accounts." />

      <Card title="Profile photo" description="Shown at the top of your page. Square images look best.">
        <ImageUploader kind="avatar" currentUrl={draft.avatarUrl} onUpdated={onImageUpdated} />
      </Card>

      <Card title="Details">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Display name" htmlFor="displayName" error={errors.displayName}>
            <Input
              id="displayName"
              value={draft.displayName}
              maxLength={LIMITS.displayName}
              invalid={!!errors.displayName}
              onChange={(e) => onChange({ displayName: e.target.value })}
            />
          </Field>
          <Field label="Username" htmlFor="username" error={errors.username} hint="Shown as @username.">
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-400">@</span>
              <Input
                id="username"
                value={draft.username}
                maxLength={LIMITS.username}
                invalid={!!errors.username}
                className="pl-7"
                autoCapitalize="off"
                spellCheck={false}
                onChange={(e) => onChange({ username: e.target.value.replace(/^@/, '') })}
              />
            </div>
          </Field>
          <div className="sm:col-span-2">
            <Field
              label="Bio"
              htmlFor="bio"
              error={errors.bio}
              counter={{ value: draft.bio.length, max: LIMITS.bio }}
            >
              <Textarea
                id="bio"
                rows={3}
                value={draft.bio}
                invalid={!!errors.bio}
                onChange={(e) => onChange({ bio: e.target.value })}
              />
            </Field>
          </div>
        </div>
      </Card>

      <SocialsEditor socials={draft.socials} onChange={(socials) => onChange({ socials })} errors={errors} />
    </div>
  )
}

function SocialsEditor({
  socials,
  onChange,
  errors,
}: {
  socials: SocialLink[]
  onChange: (s: SocialLink[]) => void
  errors: Record<string, string>
}) {
  const used = new Set(socials.map((s) => s.platform))
  const nextPlatform = SOCIAL_PLATFORMS.find((p) => !used.has(p.key))?.key ?? 'website'

  function update(i: number, patch: Partial<SocialLink>) {
    onChange(socials.map((s, j) => (j === i ? { ...s, ...patch } : s)))
  }

  return (
    <Card
      title="Social icons"
      description="Displayed as a row of icons under your bio."
      actions={
        <Button
          size="sm"
          icon={<Plus size={14} />}
          disabled={socials.length >= LIMITS.socials}
          onClick={() => onChange([...socials, { platform: nextPlatform, url: '' }])}
        >
          Add
        </Button>
      }
    >
      {socials.length === 0 ? (
        <p className="py-4 text-center text-sm text-zinc-500">No social accounts yet.</p>
      ) : (
        <ul className="space-y-3">
          {socials.map((s, i) => {
            const platform = getPlatform(s.platform)
            const err = errors[`socials.${i}`]
            return (
              <li key={i} className="space-y-1">
                <div className="flex gap-2">
                  <div className="relative">
                    <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500">
                      {platform ? <platform.Icon size={15} /> : null}
                    </span>
                    <select
                      aria-label="Platform"
                      value={s.platform}
                      onChange={(e) => update(i, { platform: e.target.value })}
                      className="h-9 w-36 appearance-none rounded-lg border border-zinc-200 bg-white pl-8 pr-2 text-sm shadow-xs outline-none focus:border-zinc-400 sm:w-40 dark:border-zinc-800 dark:bg-zinc-900"
                    >
                      {SOCIAL_PLATFORMS.map((p) => (
                        <option key={p.key} value={p.key}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Input
                    aria-label={`${platform?.label ?? 'Social'} URL`}
                    value={s.url}
                    placeholder={platform?.placeholder}
                    invalid={!!err}
                    inputMode="url"
                    autoCapitalize="off"
                    spellCheck={false}
                    onChange={(e) => update(i, { url: e.target.value })}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 shrink-0"
                    aria-label="Remove"
                    onClick={() => onChange(socials.filter((_, j) => j !== i))}
                  >
                    <Trash2 size={15} />
                  </Button>
                </div>
                {err ? <p className="text-xs text-red-600 dark:text-red-400">{err}</p> : null}
              </li>
            )
          })}
        </ul>
      )}
      {errors.socials ? <p className="mt-2 text-xs text-red-600">{errors.socials}</p> : null}
    </Card>
  )
}

export function PageTitle({ title, description, actions }: { title: string; description: string; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{description}</p>
      </div>
      {actions}
    </div>
  )
}
