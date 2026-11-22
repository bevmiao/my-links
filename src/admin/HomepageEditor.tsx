import { ArrowDown, ArrowUp, CircleDot, Plus, RotateCcw, X } from 'lucide-react'
import { useState, type KeyboardEvent } from 'react'
import {
  HOMEPAGE_LIMITS as L,
  SECTION_LABELS,
  validateContact,
  validateIntro,
  validateOpenTo,
  validateSections,
  validateSkills,
  validateStory,
  PAGE_LABELS,
} from '../../shared/homepage'
import { SECTION_PAGE, type HomepageAdminState, type HomepageContent, type SectionKey } from '../../shared/types'
import { adminApi, ApiRequestError, type HomepageSectionRoute } from '../lib/api'
import { changedParts, ROUTE_FOR } from './homepageParts'
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
  'open-to': validateOpenTo,
  story: validateStory,
}

const SECTION_HINTS: Record<SectionKey, string> = {
  intro: 'A few sentences about you.',
  story: 'Where you grew up. Also opens when someone taps your location.',
  skills: 'Tags.',
  opportunities: 'One line about what you’re up for. Shows without a heading.',
  contact: 'Email, location, and portfolio.',
  testimonials: 'Placeholder for now. Shows “Coming soon.”',
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
    setErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => !k.startsWith(`${ROUTE_FOR[key]}.`))))
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
        toast('Published. It’s live.')
      } else {
        onSaved(await adminApi.discardHomepageDraft())
        setErrors({})
        setConfirmRevert(false)
        toast('Draft reset to what’s live')
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
      <PageTitle title="Homepage" description="Edit, check the preview, then publish. Drafts stay private." />

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

      <Card title="Sections" description="Your links live on Home. Turn sections on or off and move them up or down within their page.">
        <div className="space-y-5">
          {(['about', 'work'] as const).map((pageKey) => {
            const onPage = draft.sections.map((s, i) => ({ s, i })).filter(({ s }) => SECTION_PAGE[s.key] === pageKey)
            return (
              <div key={pageKey}>
                <p className="mb-2 text-xs font-semibold text-zinc-500">{PAGE_LABELS[pageKey]} page</p>
                <ul className="space-y-2">
                  {onPage.map(({ s, i }, pos) => (
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
                        index={pos}
                        count={onPage.length}
                        onMove={(to) => patch('sections', move(draft.sections, i, onPage[to].i))}
                      />
                      <Switch
                        checked={s.visible}
                        label={s.visible ? `${SECTION_LABELS[s.key]} is shown. Click to hide.` : `${SECTION_LABELS[s.key]} is hidden. Click to show.`}
                        onChange={(visible) => patch('sections', draft.sections.map((x, j) => (j === i ? { ...x, visible } : x)))}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
        {errors['sections.items'] ? <p className="mt-2 text-xs text-red-600 dark:text-red-400">{errors['sections.items']}</p> : null}
      </Card>

      <Card title="About" description="Your photo and name come from the Profile tab.">
        <div className="space-y-5">
          <Field
            label="Line under your name"
            htmlFor="hp-headline"
            error={err('intro', 'headline')}
            counter={{ value: draft.intro.headline.length, max: L.headline }}
          >
            <Input
              id="hp-headline"
              value={draft.intro.headline}
              invalid={!!err('intro', 'headline')}
              placeholder="Photographer and videographer in Pasadena"
              onChange={(e) => patch('intro', { ...draft.intro, headline: e.target.value })}
            />
          </Field>
          <Field
            label="About you"
            htmlFor="hp-about"
            error={err('intro', 'about')}
            counter={{ value: draft.intro.about.length, max: L.about }}
            hint="A few sentences, the way you’d say it out loud."
          >
            <Textarea
              id="hp-about"
              rows={5}
              value={draft.intro.about}
              invalid={!!err('intro', 'about')}
              onChange={(e) => patch('intro', { ...draft.intro, about: e.target.value })}
            />
          </Field>
        </div>
      </Card>

      <Card title="My story" description="Where you grew up and what it means to you. It shows on your About page, and pops up when someone taps your location.">
        <div className="space-y-5">
          <Field label="Title" htmlFor="hp-story-title" error={err('story', 'title')} counter={{ value: draft.story.title.length, max: L.storyTitle }}>
            <Input
              id="hp-story-title"
              value={draft.story.title}
              invalid={!!err('story', 'title')}
              placeholder="Where I grew up"
              onChange={(e) => patch('story', { ...draft.story, title: e.target.value })}
            />
          </Field>
          <Field
            label="Your story"
            htmlFor="hp-story-body"
            error={err('story', 'body')}
            counter={{ value: draft.story.body.length, max: L.storyBody }}
            hint="Longer stories get a “Read more” button on the About page."
          >
            <Textarea
              id="hp-story-body"
              rows={7}
              value={draft.story.body}
              invalid={!!err('story', 'body')}
              onChange={(e) => patch('story', { ...draft.story, body: e.target.value })}
            />
          </Field>
        </div>
      </Card>

      <Card title="Skills">
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

      <Card title={SECTION_LABELS.opportunities}>
        <Field
          label="One line"
          htmlFor="hp-open-to"
          error={err('open-to', 'sentence')}
          counter={{ value: draft.openTo.length, max: L.openTo }}
          hint="For example: Always up for freelance shoots, collabs, or just a coffee."
        >
          <Input id="hp-open-to" value={draft.openTo} invalid={!!err('open-to', 'sentence')} onChange={(e) => patch('openTo', e.target.value)} />
        </Field>
      </Card>

      <Card title={SECTION_LABELS.contact} description="Leave anything blank to hide it. LinkedIn stays in your social icons.">
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
          <Field label="Location" htmlFor="hp-location" error={err('contact', 'location')}>
            <Input
              id="hp-location"
              value={draft.contact.location}
              invalid={!!err('contact', 'location')}
              placeholder="Pasadena, CA"
              onChange={(e) => patch('contact', { ...draft.contact, location: e.target.value })}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Portfolio link" htmlFor="hp-portfolio" error={err('contact', 'portfolioUrl')}>
              <Input
                id="hp-portfolio"
                value={draft.contact.portfolioUrl}
                invalid={!!err('contact', 'portfolioUrl')}
                placeholder="portfolio.example.com"
                inputMode="url"
                autoCapitalize="off"
                spellCheck={false}
                onChange={(e) => patch('contact', { ...draft.contact, portfolioUrl: e.target.value })}
              />
            </Field>
            <div className="mt-3 flex items-center justify-between rounded-xl border border-zinc-200 px-4 py-3 dark:border-zinc-800">
              <div>
                <p className="text-sm font-medium">Show as “Coming soon”</p>
                <p className="text-xs text-zinc-500">Visitors see a badge instead of a link.</p>
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

      <Modal
        open={confirmRevert}
        onClose={() => setConfirmRevert(false)}
        title="Go back to what’s live?"
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
          Your saved draft gets replaced with what’s live right now. The public page doesn’t change.
        </p>
      </Modal>
    </div>
  )
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
  if (hasUnsaved) {
    tone = 'pending'
    text = 'Unsaved edits.'
  } else if (!state.published) {
    tone = 'never'
    text = 'Not published yet.'
  } else if (state.hasUnpublishedChanges) {
    tone = 'pending'
    text = 'Draft saved, not live yet.'
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
              <li
                key={`${v}-${i}`}
                className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 py-0.5 pr-1 pl-3 text-[13px] dark:border-zinc-700 dark:bg-zinc-800"
              >
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
          <Input
            id={id}
            value={text}
            maxLength={maxLength}
            disabled={full}
            placeholder={full ? 'That’s the max' : placeholder}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            onBlur={add}
          />
          <Button icon={<Plus size={14} />} onClick={add} disabled={full || !text.trim()}>
            Add
          </Button>
        </div>
      </div>
    </Field>
  )
}
