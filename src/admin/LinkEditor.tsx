import { Ban } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import type { Link, LinkInput } from '../../shared/types'
import { LIMITS, validateLinkInput } from '../../shared/validation'
import { LINK_ICONS } from '../components/icons'
import { ApiRequestError } from '../lib/api'
import { Button, cx, Field, Input, Modal, Switch } from './ui'

const EMPTY: LinkInput = { title: '', url: '', description: '', icon: '', category: '', isActive: true }

interface Props {
  open: boolean
  initial: Link | null
  /** Existing category names, offered as suggestions. */
  categories: string[]
  onClose: () => void
  onSubmit: (input: LinkInput) => Promise<void>
}

export function LinkEditor({ open, initial, categories, onClose, onSubmit }: Props) {
  // State starts fresh for each edit session: the parent passes a `key` per link / "new".
  const [form, setForm] = useState<LinkInput>(() =>
    initial
      ? {
          title: initial.title,
          url: initial.url,
          description: initial.description,
          icon: initial.icon,
          category: initial.category,
          isActive: initial.isActive,
        }
      : EMPTY,
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [iconQuery, setIconQuery] = useState('')

  const set = (patch: Partial<LinkInput>) => {
    setForm((f) => ({ ...f, ...patch }))
    setErrors((e) => {
      const n = { ...e }
      for (const k of Object.keys(patch)) delete n[k]
      return n
    })
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const result = validateLinkInput(form)
    if (!result.ok) {
      setErrors(result.fields)
      return
    }
    setBusy(true)
    try {
      await onSubmit(result.value)
    } catch (err) {
      if (err instanceof ApiRequestError && err.fields) setErrors(err.fields)
      else setErrors({ form: err instanceof Error ? err.message : 'Save failed' })
    } finally {
      setBusy(false)
    }
  }

  const q = iconQuery.trim().toLowerCase()
  const icons = q ? LINK_ICONS.filter((i) => i.label.toLowerCase().includes(q) || i.key.includes(q)) : LINK_ICONS

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? 'Edit link' : 'Add link'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="link-form" loading={busy}>
            {initial ? 'Save' : 'Add link'}
          </Button>
        </>
      }
    >
      <form id="link-form" onSubmit={handleSubmit} className="space-y-5" noValidate>
        <Field label="Title" htmlFor="link-title" error={errors.title} counter={{ value: form.title.length, max: LIMITS.linkTitle }}>
          <Input id="link-title" autoFocus value={form.title} invalid={!!errors.title} onChange={(e) => set({ title: e.target.value })} placeholder="My latest project" />
        </Field>
        <Field label="URL" htmlFor="link-url" error={errors.url} hint="https:// is added automatically. mailto: links work too.">
          <Input
            id="link-url"
            value={form.url}
            invalid={!!errors.url}
            inputMode="url"
            autoCapitalize="off"
            spellCheck={false}
            onChange={(e) => set({ url: e.target.value })}
            placeholder="example.com/page"
          />
        </Field>
        <Field
          label="Description (optional)"
          htmlFor="link-desc"
          error={errors.description}
          counter={{ value: form.description.length, max: LIMITS.linkDescription }}
        >
          <Input id="link-desc" value={form.description} invalid={!!errors.description} onChange={(e) => set({ description: e.target.value })} placeholder="A short line under the title" />
        </Field>

        <Field
          label="Category (optional)"
          htmlFor="link-category"
          error={errors.category}
          hint="Links with the same category are grouped under one heading. Leave blank to keep it at the top."
        >
          <Input
            id="link-category"
            list="link-category-options"
            value={form.category}
            maxLength={LIMITS.linkCategory}
            invalid={!!errors.category}
            onChange={(e) => set({ category: e.target.value })}
            placeholder="Social, Work, Elsewhere…"
          />
          <datalist id="link-category-options">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>

        <Field label="Icon (optional)" error={errors.icon}>
          <div className="rounded-xl border border-zinc-200 p-2 dark:border-zinc-800">
            <Input value={iconQuery} onChange={(e) => setIconQuery(e.target.value)} placeholder="Search icons…" aria-label="Search icons" className="mb-2 h-8" />
            <div className="grid max-h-40 grid-cols-7 gap-1 overflow-y-auto sm:grid-cols-9" role="radiogroup" aria-label="Icon">
              <IconOption label="No icon" selected={form.icon === ''} onClick={() => set({ icon: '' })}>
                <Ban size={16} />
              </IconOption>
              {icons.map(({ key, label, Icon }) => (
                <IconOption key={key} label={label} selected={form.icon === key} onClick={() => set({ icon: key })}>
                  <Icon size={16} />
                </IconOption>
              ))}
            </div>
          </div>
        </Field>

        <div className="flex items-center justify-between rounded-xl border border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <div>
            <p className="text-sm font-medium">Visible on profile</p>
            <p className="text-xs text-zinc-500">Turn off to hide without deleting.</p>
          </div>
          <Switch checked={form.isActive} onChange={(isActive) => set({ isActive })} label="Visible on profile" />
        </div>

        {errors.form ? <p className="text-sm text-red-600 dark:text-red-400">{errors.form}</p> : null}
      </form>
    </Modal>
  )
}

function IconOption({ label, selected, onClick, children }: { label: string; selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cx(
        'grid aspect-square place-items-center rounded-lg transition',
        selected
          ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
          : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800',
      )}
    >
      {children}
    </button>
  )
}
