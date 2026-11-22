import { ChevronDown, ChevronLeft, ChevronRight, ImagePlus, Plus, Trash2, UploadCloud, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { clientHasDetails, clientLogoUrl, HOMEPAGE_LIMITS as L } from '../../shared/homepage'
import type { ClientItem } from '../../shared/types'
import { IMAGE_RULES } from '../../shared/validation'
import { adminApi } from '../lib/api'
import { isPhotoFile, openableImage } from '../lib/heic'
import { suggestOneColour } from '../lib/logoTone'
import { MAX_INPUT_BYTES, SHRINK_MAX_SIDE, shrinkImage } from '../lib/shrinkImage'
import { MoveButtons } from './MoveButtons'
import { Button, cx, Field, Input, Switch, useToast } from './ui'

const isPlaceholder = (c: ClientItem) =>
  c.logoKey?.startsWith('placeholder/') || c.name.startsWith('Placeholder ') || c.title.startsWith('Placeholder')

const newClient = (name: string): ClientItem => ({ name, logoKey: null, logoMono: false, title: '', bullets: [], images: [] })

/**
 * Shrink in the browser, then check type and size, so the visitor gets a fast answer. The Worker
 * re-checks everything (real type from the file's bytes, size) before storing it.
 */
async function prepare(picked: File, kind: 'client-logo' | 'client-photo'): Promise<File> {
  const rules = IMAGE_RULES[kind]
  if (picked.type === 'image/svg+xml') throw new Error('SVG files aren’t supported. Use PNG, JPEG or WebP.')
  if (!isPhotoFile(picked) || picked.size > MAX_INPUT_BYTES) throw new Error('Use a PNG, JPEG, WebP or iPhone (HEIC) photo.')
  // iPhone HEIC photos become JPEG first where the browser can't open them (src/lib/heic.ts).
  const original = await openableImage(picked)
  const file = await shrinkImage(original, SHRINK_MAX_SIDE[kind], rules.maxBytes, { keepAlpha: kind === 'client-logo' })
  if (!(rules.types as readonly string[]).includes(file.type)) throw new Error('Use a PNG, JPEG or WebP image (no GIFs or SVGs).')
  if (file.size > rules.maxBytes) throw new Error(`That image is still larger than ${rules.label}.`)
  return file
}

/**
 * The "Worked with" strip. Each client has a name (the logo's alt text), an optional logo, and
 * optional details (title, bullet points, photos) that turn it into a pop-up card on the site.
 * Uploads go to R2 straight away so the preview can show them, but nothing is public until the
 * draft is published.
 */
export function ClientEditor({
  clients,
  errors,
  onChange,
}: {
  clients: ClientItem[]
  errors: Record<string, string>
  onChange: (c: ClientItem[]) => void
}) {
  const [name, setName] = useState('')
  const full = clients.length >= L.clients

  const update = (i: number, patch: Partial<ClientItem>) => onChange(clients.map((c, j) => (j === i ? { ...c, ...patch } : c)))
  const move = (from: number, to: number) => {
    const next = [...clients]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    onChange(next)
  }

  function add() {
    const v = name.trim()
    if (!v || full) return
    onChange([...clients, newClient(v)])
    setName('')
  }

  return (
    <div className="space-y-4">
      {clients.some(isPlaceholder) ? (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
          Anything marked “Placeholder” is an example. Replace or remove it before you turn this section on.
        </p>
      ) : null}
      {clients.length ? (
        <ul className="space-y-3">
          {clients.map((c, i) => (
            <ClientRow
              key={i}
              client={c}
              index={i}
              count={clients.length}
              errors={errors}
              onChange={(patch) => update(i, patch)}
              onMove={(to) => move(i, to)}
              onRemove={() => onChange(clients.filter((_, j) => j !== i))}
            />
          ))}
        </ul>
      ) : null}
      <Field
        label="Add a client"
        htmlFor="hp-client-new"
        error={errors['clients.items']}
        hint={`${clients.length}/${L.clients}. Clients without a logo show their name.`}
      >
        <div className="flex gap-2">
          <Input
            id="hp-client-new"
            value={name}
            maxLength={L.clientName}
            disabled={full}
            placeholder={full ? 'That’s the max' : 'Client name'}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                add()
              }
            }}
          />
          <Button icon={<Plus size={14} />} onClick={add} disabled={full || !name.trim()}>
            Add
          </Button>
        </div>
      </Field>
    </div>
  )
}

function ClientRow({
  client: c,
  index: i,
  count,
  errors,
  onChange,
  onMove,
  onRemove,
}: {
  client: ClientItem
  index: number
  count: number
  errors: Record<string, string>
  onChange: (patch: Partial<ClientItem>) => void
  onMove: (to: number) => void
  onRemove: () => void
}) {
  const toast = useToast()
  const [open, setOpen] = useState(() => clientHasDetails(c))
  const [busy, setBusy] = useState(false)
  const logoInput = useRef<HTMLInputElement>(null)
  const label = c.name.trim() || `Client ${i + 1}`
  const url = clientLogoUrl(c.logoKey)
  const e = (field: string) => errors[`clients.items.${i}.${field}`]
  const detailsId = `hp-client-${i}-details`

  async function uploadLogo(original: File) {
    setBusy(true)
    try {
      const file = await prepare(original, 'client-logo')
      const [{ key }, logoMono] = await Promise.all([adminApi.uploadClientLogo(file), suggestOneColour(file)])
      // One colour only when it would work for this logo (see src/lib/logoTone.ts); you can still switch it.
      onChange({ logoKey: key, logoMono })
      toast(
        logoMono
          ? 'Logo uploaded. It will follow your text colour. Save or publish to use it.'
          : 'Logo uploaded in its own colours. Save or publish to use it.',
      )
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Upload failed', 'error')
    } finally {
      setBusy(false)
      if (logoInput.current) logoInput.current.value = ''
    }
  }

  return (
    <li className="rounded-xl border border-zinc-200/80 dark:border-zinc-800">
      <div className="flex flex-wrap items-start gap-3 p-3 sm:flex-nowrap">
        <div className="relative grid h-16 w-28 shrink-0 place-items-center rounded-lg bg-zinc-100 px-3 dark:bg-zinc-800">
          {url ? (
            <img src={url} alt="" className={cx('max-h-10 max-w-full object-contain', c.logoMono && 'dark:invert')} />
          ) : (
            <span className="text-center text-xs font-medium text-zinc-500">Name only</span>
          )}
          {busy ? <div className="absolute inset-0 animate-pulse rounded-lg bg-white/60 dark:bg-black/40" /> : null}
        </div>
        <div className="min-w-0 flex-1">
          <Field label="Name" htmlFor={`hp-client-${i}`} error={e('name') ?? e('logoKey')} counter={{ value: c.name.length, max: L.clientName }}>
            <Input id={`hp-client-${i}`} value={c.name} invalid={!!e('name')} placeholder="Client name" onChange={(ev) => onChange({ name: ev.target.value })} />
          </Field>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button size="sm" variant="secondary" icon={url ? <UploadCloud size={14} /> : <ImagePlus size={14} />} loading={busy} onClick={() => logoInput.current?.click()}>
              {url ? 'Replace logo' : 'Upload logo'}
            </Button>
            {c.logoKey ? (
              <Button size="sm" variant="ghost" icon={<X size={14} />} disabled={busy} onClick={() => onChange({ logoKey: null })}>
                Use name only
              </Button>
            ) : null}
            {isPlaceholder(c) ? (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">Placeholder</span>
            ) : null}
          </div>
          {url ? (
            <div className="mt-3 flex items-start justify-between gap-3 rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-800">
              <div>
                <p className="text-sm font-medium">One colour</p>
                <p className="text-xs text-zinc-500">
                  Draws the logo in your text colour so it fits light and dark mode. Needs a transparent background; turn off for full-colour logos.
                </p>
                {c.logoMono && c.logoKey?.endsWith('.jpg') ? (
                  <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">JPEGs have no transparency, so this shows a solid block. Use a PNG or turn it off.</p>
                ) : null}
              </div>
              <Switch checked={c.logoMono} label={`Show ${label}’s logo in one colour`} onChange={(logoMono) => onChange({ logoMono })} />
            </div>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col items-center">
          <MoveButtons label={label} index={i} count={count} onMove={onMove} />
          <Button variant="ghost" size="icon" aria-label={`Remove ${label}`} onClick={onRemove}>
            <Trash2 size={14} />
          </Button>
        </div>
      </div>

      <button
        type="button"
        aria-expanded={open}
        aria-controls={detailsId}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between border-t border-zinc-200/80 px-3 py-2.5 text-left text-sm font-medium hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/40"
      >
        <span>
          Details{' '}
          <span className="font-normal text-zinc-500">
            {clientHasDetails(c)
              ? `· ${[c.title ? 'title' : '', c.bullets.length ? `${c.bullets.length} point${c.bullets.length > 1 ? 's' : ''}` : '', c.images.length ? `${c.images.length} photo${c.images.length > 1 ? 's' : ''}` : ''].filter(Boolean).join(', ')}`
              : '· none yet, so the logo isn’t clickable'}
          </span>
        </span>
        <ChevronDown size={16} aria-hidden="true" className={cx('transition', open && 'rotate-180')} />
      </button>
      {open ? (
        <div id={detailsId} className="space-y-5 border-t border-zinc-200/80 p-3 dark:border-zinc-800">
          <Field label="Title" htmlFor={`hp-client-${i}-title`} error={e('title')} counter={{ value: c.title.length, max: L.clientTitle }} hint="What the project was, in a few words.">
            <Input
              id={`hp-client-${i}-title`}
              value={c.title}
              invalid={!!e('title')}
              placeholder="Brand film and launch photos"
              onChange={(ev) => onChange({ title: ev.target.value })}
            />
          </Field>
          <BulletEditor index={i} bullets={c.bullets} errors={errors} onChange={(bullets) => onChange({ bullets })} />
          <PhotoEditor index={i} name={label} images={c.images} errors={errors} onChange={(images) => onChange({ images })} />
        </div>
      ) : null}

      <input
        ref={logoInput}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(ev) => {
          const f = ev.target.files?.[0]
          if (f) uploadLogo(f)
        }}
      />
    </li>
  )
}

function BulletEditor({
  index: i,
  bullets,
  errors,
  onChange,
}: {
  index: number
  bullets: string[]
  errors: Record<string, string>
  onChange: (b: string[]) => void
}) {
  const [text, setText] = useState('')
  const full = bullets.length >= L.clientBullets
  const add = () => {
    const v = text.trim()
    if (!v || full) return
    onChange([...bullets, v])
    setText('')
  }
  return (
    <Field label="What you worked on" htmlFor={`hp-client-${i}-bullet`} error={errors[`clients.items.${i}.bullets`]} hint={`${bullets.length}/${L.clientBullets} points. Short lines work best.`}>
      <div className="space-y-2">
        {bullets.map((b, j) => {
          const err = errors[`clients.items.${i}.bullets.${j}`]
          return (
            <div key={j} className="flex items-center gap-2">
              <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-zinc-400" />
              <Input
                aria-label={`Point ${j + 1}`}
                value={b}
                maxLength={L.clientBullet}
                invalid={!!err}
                onChange={(ev) => onChange(bullets.map((x, k) => (k === j ? ev.target.value : x)))}
                // A cleared point is removed when you leave it.
                onBlur={() => {
                  if (!b.trim()) onChange(bullets.filter((_, k) => k !== j))
                }}
              />
              <Button variant="ghost" size="icon" aria-label={`Remove point ${j + 1}`} onClick={() => onChange(bullets.filter((_, k) => k !== j))}>
                <X size={14} />
              </Button>
            </div>
          )
        })}
        <div className="flex gap-2">
          <Input
            id={`hp-client-${i}-bullet`}
            value={text}
            maxLength={L.clientBullet}
            disabled={full}
            placeholder={full ? 'That’s the max' : 'Directed and shot a 60-second brand film'}
            onChange={(ev) => setText(ev.target.value)}
            onKeyDown={(ev) => {
              if (ev.key === 'Enter') {
                ev.preventDefault()
                add()
              }
            }}
          />
          <Button icon={<Plus size={14} />} onClick={add} disabled={full || !text.trim()}>
            Add
          </Button>
        </div>
      </div>
    </Field>
  )
}

function PhotoEditor({
  index: i,
  name,
  images,
  errors,
  onChange,
}: {
  index: number
  name: string
  images: ClientItem['images']
  errors: Record<string, string>
  onChange: (imgs: ClientItem['images']) => void
}) {
  const toast = useToast()
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const room = L.clientImages - images.length

  async function upload(files: File[]) {
    if (!files.length) return
    setBusy(true)
    let next = images
    try {
      for (const original of files.slice(0, room)) {
        const { key } = await adminApi.uploadClientPhoto(await prepare(original, 'client-photo'))
        next = [...next, { key, alt: '' }]
        onChange(next)
      }
      if (files.length > room) toast(`Only ${L.clientImages} photos fit. The rest were skipped.`, 'error')
      else toast(files.length > 1 ? 'Photos uploaded. Save or publish to use them.' : 'Photo uploaded. Save or publish to use it.')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Upload failed', 'error')
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  const swap = (a: number, b: number) => {
    const next = [...images]
    ;[next[a], next[b]] = [next[b], next[a]]
    onChange(next)
  }

  return (
    <div>
      <p className="text-sm font-medium">Photos</p>
      <p className="mt-0.5 text-xs text-zinc-500">
        Up to {L.clientImages}. Any size works; they’re resized automatically (PNG, JPEG or WebP, no GIFs or SVGs). Describe each one for people using screen readers.
      </p>
      {errors[`clients.items.${i}.images`] ? <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors[`clients.items.${i}.images`]}</p> : null}
      {images.length ? (
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {images.map((img, j) => {
            const err = errors[`clients.items.${i}.images.${j}.alt`] ?? errors[`clients.items.${i}.images.${j}.key`]
            return (
              <li key={img.key} className="rounded-lg border border-zinc-200 p-2 dark:border-zinc-800">
                <img src={`/media/${img.key}`} alt="" className="aspect-[4/3] w-full rounded-md bg-zinc-100 object-cover dark:bg-zinc-800" />
                <div className="mt-2 flex items-center gap-1">
                  <Button variant="ghost" size="icon" aria-label={`Move photo ${j + 1} earlier`} disabled={j === 0} onClick={() => swap(j, j - 1)}>
                    <ChevronLeft size={14} />
                  </Button>
                  <Button variant="ghost" size="icon" aria-label={`Move photo ${j + 1} later`} disabled={j === images.length - 1} onClick={() => swap(j, j + 1)}>
                    <ChevronRight size={14} />
                  </Button>
                  <span className="flex-1" />
                  <Button variant="ghost" size="icon" aria-label={`Remove photo ${j + 1}`} onClick={() => onChange(images.filter((_, k) => k !== j))}>
                    <Trash2 size={14} />
                  </Button>
                </div>
                <Field label="Description" htmlFor={`hp-client-${i}-img-${j}`} error={err}>
                  <Input
                    id={`hp-client-${i}-img-${j}`}
                    value={img.alt}
                    maxLength={L.clientImageAlt}
                    invalid={!!err}
                    placeholder={`Photo from my work with ${name}`}
                    onChange={(ev) => onChange(images.map((x, k) => (k === j ? { ...x, alt: ev.target.value } : x)))}
                  />
                </Field>
              </li>
            )
          })}
        </ul>
      ) : null}
      <div className="mt-3">
        <Button size="sm" variant="secondary" icon={<ImagePlus size={14} />} loading={busy} disabled={room <= 0} onClick={() => input.current?.click()}>
          {room <= 0 ? 'That’s the max' : 'Add photos'}
        </Button>
      </div>
      <input
        ref={input}
        type="file"
        multiple
        accept="image/png,image/jpeg,image/webp,image/heic,image/heif,.heic,.heif"
        className="hidden"
        onChange={(ev) => upload(Array.from(ev.target.files ?? []))}
      />
    </div>
  )
}
