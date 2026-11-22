import { ArrowDown, ArrowUp, CircleDot, Plus, RotateCcw, Trash2, X } from 'lucide-react'
import { useState, type KeyboardEvent, type ReactNode } from 'react'
import {
  HOMEPAGE_LIMITS as L,
  SECTION_LABELS,
  validateContact,
  validateExperience,
  validateIntro,
  validateOpportunities,
  validateSections,
  validateSkills,
} from '../../shared/homepage'
import type { HomepageAdminState, HomepageContent, SectionKey } from '../../shared/types'
import { adminApi, ApiRequestError, type HomepageSectionRoute } from '../lib/api'
import { changedParts } from './homepageParts'
import { PageTitle } from './ProfileEditor'
import { Button, Card, cx, Field, Input, Modal, Switch, Textarea, useToast } from './ui'

interface Props {
  state: HomepageAdminState
  draft: HomepageContent
  setDraft: (d: HomepageContent) => void
  onSaved: (s: HomepageAdminState) => void
}

const VALIDATORS: Record<HomepageSectionRoute, (b: unknown) => { ok: boolean; fields?: Record<string, string> }> = {
  sections: validateSections,
  intro: validateIntro,
  contact: validateContact,
  skills: validateSkills,
  experience: validateExperience,
  opportunities: validateOpportunities,
}

const SECTION_HINTS: Record<SectionKey, string> = {
  intro: 'Your intro, bio, background, and interests.',
  experience: 'Roles and projects.',
  skills: 'What you’re good at.',
  opportunities: 'The kinds of work and connections you’re open to.',
  contact: 'Email, phone, LinkedIn, resume, and portfolio.',
  testimonials: 'A placeholder for now. Shows a short “coming soon” note.',
}

export function HomepageEditor({ state, draft, setDraft, onSaved }: Props) {
  const toast = useToast()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<'save' | 'publish' | 'revert' | null>(null)
  const [confirmRevert, setConfirmRevert] = useState(false)

  const unsaved = changedParts(state.draft, draft)
  const hasUnsaved = unsaved.length > 0
  const canPublish = hasUnsaved || state.hasUnpublishedChanges

  function patch<K extends keyof HomepageContent>(key: K, value: HomepageContent[K]) {
    setDraft({ ...draft, [key]: value })
    setErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => !k.startsWith(`${routeFor(key)}.`))))
  }

  /** Validate and save every changed part. Returns the new server state, or null if something failed. */
  async function saveDraft(): Promise<HomepageAdminState | null> {
    const fieldErrors: Record<string, string> = {}
    for (const part of unsaved) {
      const r = VALIDATORS[part.route](part.body(draft))
      if (!r.ok) for (const [k, v] of Object.entries(r.fields ?? {})) fieldErrors[`${part.route}.${k}`] = v
    }
    if (Object.keys(fieldErrors).length) {
      setErrors(fieldErrors)
      toast('A few fields need a look first', 'error')
      return null
    }
    let latest = state
    for (const part of unsaved) {
      try {
        latest = await adminApi.saveHomepageSection(part.route, part.body(draft))
      } catch (e) {
        if (e instanceof ApiRequestError && e.fields)
          setErrors(Object.fromEntries(Object.entries(e.fields).map(([k, v]) => [`${part.route}.${k}`, v])))
        toast(e instanceof Error ? e.message : 'Could not save', 'error')
        onSaved(latest)
        return null
      }
    }
    setErrors({})
    onSaved(latest)
    return latest
  }

  async function run(kind: 'save' | 'publish' | 'revert') {
    setBusy(kind)
    try {
      if (kind === 'save') {
        if (await saveDraft()) toast('Draft saved. Only you can see it.')
      } else if (kind === 'publish') {
        if (hasUnsaved && !(await saveDraft())) return
        onSaved(await adminApi.publishHomepage())
        toast('Published! Your homepage is live.')
      } else {
        onSaved(await adminApi.discardHomepageDraft())
        setErrors({})
        setConfirmRevert(false)
        toast('Draft reset to the published version')
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Something went wrong', 'error')
    } finally {
      setBusy(null)
    }
  }

  const err = (route: HomepageSectionRoute, field: string) => errors[`${route}.${field}`]

  return (
    <div className="space-y-6">
      <PageTitle
        title="Homepage"
        description="Your story, experience, and how to reach you. Save drafts as you go and check the preview. Nothing goes public until you press Publish."
      />

      <StatusBar
        state={state}
        hasUnsaved={hasUnsaved}
        canPublish={canPublish}
        busy={busy}
        onSave={() => run('save')}
        onPublish={() => run('publish')}
        onDiscardLocal={() => {
          setDraft(state.draft)
          setErrors({})
        }}
        onRevert={() => setConfirmRevert(true)}
      />

      {/* Sections: visibility and order */}
      <Card title="Sections" description="Choose what shows on your homepage and in what order. Hidden sections stay saved but are never public.">
        <ul className="space-y-2">
          {draft.sections.map((s, i) => (
            <li
              key={s.key}
              className={cx(
                'flex items-center gap-3 rounded-xl border border-zinc-200/80 px-3 py-2 dark:border-zinc-800',
                !s.visible && 'opacity-60',
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{SECTION_LABELS[s.key]}</p>
                <p className="truncate text-xs text-zinc-500">{SECTION_HINTS[s.key]}</p>
              </div>
              <MoveButtons
                label={SECTION_LABELS[s.key]}
                index={i}
                count={draft.sections.length}
                onMove={(to) => patch('sections', move(draft.sections, i, to))}
              />
              <Switch
                checked={s.visible}
                label={s.visible ? `${SECTION_LABELS[s.key]} is shown. Click to hide.` : `${SECTION_LABELS[s.key]} is hidden. Click to show.`}
                onChange={(visible) => patch('sections', draft.sections.map((x, j) => (j === i ? { ...x, visible } : x)))}
              />
            </li>
          ))}
        </ul>
        {errors['sections.items'] ? <p className="mt-2 text-xs text-red-600 dark:text-red-400">{errors['sections.items']}</p> : null}
      </Card>

      {/* About me */}
      <Card title="About me" description="Your photo and name come from the Profile tab. The headline shows under your name.">
        <div className="space-y-5">
          <Field label="Headline" htmlFor="hp-headline" error={err('intro', 'headline')} counter={{ value: draft.intro.headline.length, max: L.headline }}>
            <Input
              id="hp-headline"
              value={draft.intro.headline}
              invalid={!!err('intro', 'headline')}
              placeholder="Photographer and videographer in Pasadena"
              onChange={(e) => patch('intro', { ...draft.intro, headline: e.target.value })}
            />
          </Field>
          <Field label="Short intro" htmlFor="hp-intro" error={err('intro', 'intro')} counter={{ value: draft.intro.intro.length, max: L.intro }} hint="One or two friendly sentences. It opens the About section.">
            <Textarea
              id="hp-intro"
              rows={2}
              value={draft.intro.intro}
              invalid={!!err('intro', 'intro')}
              onChange={(e) => patch('intro', { ...draft.intro, intro: e.target.value })}
            />
          </Field>
          <Field label="Bio" htmlFor="hp-about" error={err('intro', 'about')} counter={{ value: draft.intro.about.length, max: L.about }}>
            <Textarea
              id="hp-about"
              rows={5}
              value={draft.intro.about}
              invalid={!!err('intro', 'about')}
              onChange={(e) => patch('intro', { ...draft.intro, about: e.target.value })}
            />
          </Field>
          <Field
            label="Professional background"
            htmlFor="hp-background"
            error={err('intro', 'background')}
            counter={{ value: draft.intro.background.length, max: L.background }}
          >
            <Textarea
              id="hp-background"
              rows={4}
              value={draft.intro.background}
              invalid={!!err('intro', 'background')}
              onChange={(e) => patch('intro', { ...draft.intro, background: e.target.value })}
            />
          </Field>
          <TagEditor
            label="Areas of interest"
            id="hp-interests"
            values={draft.intro.interests}
            max={L.interests}
            maxLength={L.interest}
            placeholder="Add an interest and press Enter"
            error={err('intro', 'interests') ?? firstError(errors, 'intro.interests.')}
            onChange={(interests) => patch('intro', { ...draft.intro, interests })}
          />
        </div>
      </Card>

      {/* Contact and professional links */}
      <Card title="Contact and links" description="Leave anything blank to hide it. LinkedIn is a plain link; nothing connects to your account.">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Email" htmlFor="hp-email" error={err('contact', 'email')}>
            <Input
              id="hp-email"
              type="email"
              inputMode="email"
              autoCapitalize="off"
              spellCheck={false}
              value={draft.contact.email}
              invalid={!!err('contact', 'email')}
              onChange={(e) => patch('contact', { ...draft.contact, email: e.target.value })}
            />
          </Field>
          <Field label="Phone (optional)" htmlFor="hp-phone" error={err('contact', 'phone')}>
            <Input
              id="hp-phone"
              type="tel"
              inputMode="tel"
              value={draft.contact.phone}
              invalid={!!err('contact', 'phone')}
              onChange={(e) => patch('contact', { ...draft.contact, phone: e.target.value })}
            />
          </Field>
          <Field label="Location" htmlFor="hp-location" error={err('contact', 'location')}>
            <Input
              id="hp-location"
              value={draft.contact.location}
              invalid={!!err('contact', 'location')}
              placeholder="Pasadena, CA"
              onChange={(e) => patch('contact', { ...draft.contact, location: e.target.value })}
            />
          </Field>
          <Field label="LinkedIn profile" htmlFor="hp-linkedin" error={err('contact', 'linkedinUrl')}>
            <UrlInput
              id="hp-linkedin"
              value={draft.contact.linkedinUrl}
              invalid={!!err('contact', 'linkedinUrl')}
              placeholder="linkedin.com/in/you"
              onChange={(linkedinUrl) => patch('contact', { ...draft.contact, linkedinUrl })}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field
              label="Resume link"
              htmlFor="hp-resume"
              error={err('contact', 'resumeUrl')}
              hint="Paste a share link, for example from Google Drive. Set sharing to “Anyone with the link” so visitors can open it."
            >
              <UrlInput
                id="hp-resume"
                value={draft.contact.resumeUrl}
                invalid={!!err('contact', 'resumeUrl')}
                placeholder="drive.google.com/file/d/…/view"
                onChange={(resumeUrl) => patch('contact', { ...draft.contact, resumeUrl })}
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Portfolio link" htmlFor="hp-portfolio" error={err('contact', 'portfolioUrl')} hint="Your portfolio will be its own site. Until then, keep it marked as coming soon.">
              <UrlInput
                id="hp-portfolio"
                value={draft.contact.portfolioUrl}
                invalid={!!err('contact', 'portfolioUrl')}
                placeholder="portfolio.example.com"
                onChange={(portfolioUrl) => patch('contact', { ...draft.contact, portfolioUrl })}
              />
            </Field>
            <div className="mt-3 flex items-center justify-between rounded-xl border border-zinc-200 px-4 py-3 dark:border-zinc-800">
              <div>
                <p className="text-sm font-medium">Show as “Coming soon”</p>
                <p className="text-xs text-zinc-500">Visitors see a badge instead of a link. The link above stays private.</p>
              </div>
              <Switch
                checked={draft.contact.portfolioComingSoon}
                label="Show portfolio as coming soon"
                onChange={(portfolioComingSoon) => patch('contact', { ...draft.contact, portfolioComingSoon })}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Skills */}
      <Card title="Skills" description="Short labels work best. They show as tags.">
        <TagEditor
          label="Skills"
          id="hp-skills"
          values={draft.skills.map((s) => s.label)}
          max={L.skills}
          maxLength={L.skill}
          placeholder="Add a skill and press Enter"
          error={err('skills', 'items') ?? firstError(errors, 'skills.items.')}
          onChange={(labels) => patch('skills', labels.map((label) => ({ label })))}
        />
      </Card>

      {/* Experience */}
      <Card
        title="Experience"
        description="Newest first usually reads best."
        actions={
          <Button
            size="sm"
            icon={<Plus size={14} />}
            disabled={draft.experience.length >= L.experience}
            onClick={() => patch('experience', [...draft.experience, { role: '', organization: '', period: '', description: '' }])}
          >
            Add
          </Button>
        }
      >
        <ItemList
          empty="No experience added yet."
          items={draft.experience}
          label={(item, i) => item.role || `Entry ${i + 1}`}
          onChange={(items) => patch('experience', items)}
          error={err('experience', 'items')}
          render={(item, i, update) => (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Role" htmlFor={`exp-role-${i}`} error={err('experience', `items.${i}.role`)}>
                <Input id={`exp-role-${i}`} value={item.role} maxLength={L.role} invalid={!!err('experience', `items.${i}.role`)} onChange={(e) => update({ role: e.target.value })} />
              </Field>
              <Field label="Organisation" htmlFor={`exp-org-${i}`} error={err('experience', `items.${i}.organization`)}>
                <Input id={`exp-org-${i}`} value={item.organization} maxLength={L.organization} onChange={(e) => update({ organization: e.target.value })} />
              </Field>
              <Field label="When" htmlFor={`exp-period-${i}`} error={err('experience', `items.${i}.period`)} hint="For example: 2021 – now">
                <Input id={`exp-period-${i}`} value={item.period} maxLength={L.period} onChange={(e) => update({ period: e.target.value })} />
              </Field>
              <div className="sm:col-span-2">
                <Field
                  label="What I did"
                  htmlFor={`exp-desc-${i}`}
                  error={err('experience', `items.${i}.description`)}
                  counter={{ value: item.description.length, max: L.experienceDescription }}
                >
                  <Textarea id={`exp-desc-${i}`} rows={3} value={item.description} onChange={(e) => update({ description: e.target.value })} />
                </Field>
              </div>
            </div>
          )}
        />
      </Card>

      {/* Opportunities */}
      <Card
        title="Open to"
        description="The kinds of opportunities you’re interested in. These six are placeholders: rename, remove, or add your own."
        actions={
          <Button
            size="sm"
            icon={<Plus size={14} />}
            disabled={draft.opportunities.length >= L.opportunities}
            onClick={() => patch('opportunities', [...draft.opportunities, { title: '', description: '' }])}
          >
            Add
          </Button>
        }
      >
        <ItemList
          empty="Nothing here yet."
          items={draft.opportunities}
          label={(item, i) => item.title || `Item ${i + 1}`}
          onChange={(items) => patch('opportunities', items)}
          error={err('opportunities', 'items')}
          render={(item, i, update) => (
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
              <Field label="Title" htmlFor={`opp-title-${i}`} error={err('opportunities', `items.${i}.title`)}>
                <Input id={`opp-title-${i}`} value={item.title} maxLength={L.opportunityTitle} invalid={!!err('opportunities', `items.${i}.title`)} onChange={(e) => update({ title: e.target.value })} />
              </Field>
              <Field label="Short description" htmlFor={`opp-desc-${i}`} error={err('opportunities', `items.${i}.description`)}>
                <Input id={`opp-desc-${i}`} value={item.description} maxLength={L.opportunityDescription} onChange={(e) => update({ description: e.target.value })} />
              </Field>
            </div>
          )}
        />
      </Card>

      <Modal
        open={confirmRevert}
        onClose={() => setConfirmRevert(false)}
        title="Go back to the published version?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmRevert(false)}>
              Keep my draft
            </Button>
            <Button variant="danger" loading={busy === 'revert'} onClick={() => run('revert')}>
              Reset draft
            </Button>
          </>
        }
      >
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Your saved draft will be replaced with what’s live on your homepage right now. Your public page doesn’t change.
        </p>
      </Modal>
    </div>
  )
}

function routeFor(key: keyof HomepageContent): HomepageSectionRoute {
  return key
}

function firstError(errors: Record<string, string>, prefix: string) {
  return Object.entries(errors).find(([k]) => k.startsWith(prefix))?.[1]
}

function move<T>(list: T[], from: number, to: number): T[] {
  const next = [...list]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

/* ---------------- Pieces ---------------- */

function StatusBar({
  state,
  hasUnsaved,
  canPublish,
  busy,
  onSave,
  onPublish,
  onDiscardLocal,
  onRevert,
}: {
  state: HomepageAdminState
  hasUnsaved: boolean
  canPublish: boolean
  busy: 'save' | 'publish' | 'revert' | null
  onSave: () => void
  onPublish: () => void
  onDiscardLocal: () => void
  onRevert: () => void
}) {
  let tone: 'live' | 'pending' | 'never'
  let text: string
  if (!state.published) {
    tone = 'never'
    text = 'Not published yet. Visitors don’t see these sections.'
  } else if (hasUnsaved || state.hasUnpublishedChanges) {
    tone = 'pending'
    text = hasUnsaved ? 'You have unsaved edits.' : 'Draft saved. It isn’t public yet.'
  } else {
    tone = 'live'
    text = `Live. Published ${formatWhen(state.publishedAt)}.`
  }
  return (
    <div className="sticky top-16 z-20 rounded-2xl border border-zinc-200/80 bg-white/95 p-3 shadow-sm backdrop-blur sm:p-4 dark:border-zinc-800/80 dark:bg-zinc-900/95">
      <div className="flex flex-wrap items-center gap-3">
        <p className="flex min-w-0 flex-1 items-center gap-2 text-sm" role="status">
          <CircleDot
            size={15}
            aria-hidden="true"
            className={cx(
              'shrink-0',
              tone === 'live' && 'text-emerald-500',
              tone === 'pending' && 'text-amber-500',
              tone === 'never' && 'text-zinc-400',
            )}
          />
          <span>{text}</span>
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {hasUnsaved ? (
            <Button size="sm" variant="ghost" onClick={onDiscardLocal} disabled={!!busy}>
              Undo edits
            </Button>
          ) : state.published && state.hasUnpublishedChanges ? (
            <Button size="sm" variant="ghost" icon={<RotateCcw size={14} />} onClick={onRevert} disabled={!!busy}>
              Reset to live
            </Button>
          ) : null}
          <Button size="sm" onClick={onSave} loading={busy === 'save'} disabled={!hasUnsaved || !!busy}>
            Save draft
          </Button>
          <Button size="sm" variant="primary" onClick={onPublish} loading={busy === 'publish'} disabled={!canPublish || !!busy}>
            Publish
          </Button>
        </div>
      </div>
    </div>
  )
}

function formatWhen(iso: string | null) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return iso
  }
}

function MoveButtons({ label, index, count, onMove }: { label: string; index: number; count: number; onMove: (to: number) => void }) {
  return (
    <div className="flex shrink-0">
      <Button variant="ghost" size="icon" aria-label={`Move ${label} up`} disabled={index === 0} onClick={() => onMove(index - 1)}>
        <ArrowUp size={14} />
      </Button>
      <Button variant="ghost" size="icon" aria-label={`Move ${label} down`} disabled={index === count - 1} onClick={() => onMove(index + 1)}>
        <ArrowDown size={14} />
      </Button>
    </div>
  )
}

function UrlInput({ id, value, invalid, placeholder, onChange }: { id: string; value: string; invalid?: boolean; placeholder?: string; onChange: (v: string) => void }) {
  return (
    <Input
      id={id}
      value={value}
      invalid={invalid}
      placeholder={placeholder}
      inputMode="url"
      autoCapitalize="off"
      spellCheck={false}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

function TagEditor({
  label,
  id,
  values,
  max,
  maxLength,
  placeholder,
  error,
  onChange,
}: {
  label: string
  id: string
  values: string[]
  max: number
  maxLength: number
  placeholder: string
  error?: string
  onChange: (v: string[]) => void
}) {
  const [text, setText] = useState('')
  const full = values.length >= max
  function add() {
    const v = text.trim()
    if (!v || full) return
    if (!values.some((x) => x.toLowerCase() === v.toLowerCase())) onChange([...values, v])
    setText('')
  }
  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      add()
    } else if (e.key === 'Backspace' && !text && values.length) {
      onChange(values.slice(0, -1))
    }
  }
  return (
    <Field label={label} htmlFor={id} error={error} hint={`${values.length}/${max}. Press Enter to add.`}>
      <div className="space-y-2">
        {values.length ? (
          <ul className="flex flex-wrap gap-1.5" aria-label={label}>
            {values.map((v, i) => (
              <li key={`${v}-${i}`} className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 py-0.5 pr-1 pl-3 text-[13px] dark:border-zinc-700 dark:bg-zinc-800">
                {v}
                <button
                  type="button"
                  aria-label={`Remove ${v}`}
                  onClick={() => onChange(values.filter((_, j) => j !== i))}
                  className="grid size-5 place-items-center rounded-full text-zinc-500 hover:bg-zinc-200 hover:text-zinc-900 dark:hover:bg-zinc-700 dark:hover:text-white"
                >
                  <X size={12} />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="flex gap-2">
          <Input id={id} value={text} maxLength={maxLength} disabled={full} placeholder={full ? 'That’s the maximum' : placeholder} onChange={(e) => setText(e.target.value)} onKeyDown={onKeyDown} onBlur={add} />
          <Button icon={<Plus size={14} />} onClick={add} disabled={full || !text.trim()}>
            Add
          </Button>
        </div>
      </div>
    </Field>
  )
}

function ItemList<T>({
  items,
  empty,
  label,
  error,
  onChange,
  render,
}: {
  items: T[]
  empty: string
  label: (item: T, i: number) => string
  error?: string
  onChange: (items: T[]) => void
  render: (item: T, i: number, update: (patch: Partial<T>) => void) => ReactNode
}) {
  if (!items.length) return <p className="py-4 text-center text-sm text-zinc-500">{empty}</p>
  return (
    <>
      <ol className="space-y-4">
        {items.map((item, i) => (
          <li key={i} className="rounded-xl border border-zinc-200/80 p-4 dark:border-zinc-800">
            <div className="mb-3 flex items-center gap-2">
              <p className="min-w-0 flex-1 truncate text-[13px] font-semibold text-zinc-600 dark:text-zinc-300">{label(item, i)}</p>
              <MoveButtons label={label(item, i)} index={i} count={items.length} onMove={(to) => onChange(move(items, i, to))} />
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Remove ${label(item, i)}`}
                className="hover:text-red-600 dark:hover:text-red-400"
                onClick={() => onChange(items.filter((_, j) => j !== i))}
              >
                <Trash2 size={14} />
              </Button>
            </div>
            {render(item, i, (patch) => onChange(items.map((x, j) => (j === i ? { ...x, ...patch } : x))))}
          </li>
        ))}
      </ol>
      {error ? <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p> : null}
    </>
  )
}
