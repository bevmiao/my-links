import { ImagePlus, Plus, Trash2, UploadCloud, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { clientLogoUrl, HOMEPAGE_LIMITS as L } from '../../shared/homepage'
import type { ClientItem } from '../../shared/types'
import { IMAGE_RULES } from '../../shared/validation'
import { adminApi } from '../lib/api'
import { MAX_INPUT_BYTES, SHRINK_MAX_SIDE, shrinkImage } from '../lib/shrinkImage'
import { MoveButtons } from './MoveButtons'
import { Button, Field, Input, useToast } from './ui'

const RULES = IMAGE_RULES['client-logo']
const isPlaceholder = (c: ClientItem) => c.logoKey?.startsWith('placeholder/') || c.name.startsWith('Placeholder ')

/**
 * The "Worked with" logo strip. Logos upload to R2 straight away (so the preview can show them),
 * but only appear on the site once the draft is saved and published. The Worker re-checks every
 * upload (type from magic bytes, size) and every saved key.
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
  const toast = useToast()
  const [name, setName] = useState('')
  const [uploading, setUploading] = useState<number | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const target = useRef<number | null>(null)
  const full = clients.length >= L.clients

  const update = (i: number, patch: Partial<ClientItem>) => onChange(clients.map((c, j) => (j === i ? { ...c, ...patch } : c)))
  const move = (from: number, to: number) => {
    const next = [...clients]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    onChange(next)
  }

  function pick(i: number) {
    target.current = i
    fileRef.current?.click()
  }

  async function upload(original: File) {
    const i = target.current
    if (i === null) return
    if (original.type === 'image/svg+xml') {
      toast('SVG logos aren’t supported. Use PNG, JPEG or WebP.', 'error')
      return
    }
    if (!original.type.startsWith('image/') || original.size > MAX_INPUT_BYTES) {
      toast('Use a PNG, JPEG or WebP image.', 'error')
      return
    }
    setUploading(i)
    try {
      const file = await shrinkImage(original, SHRINK_MAX_SIDE['client-logo'], RULES.maxBytes, { keepAlpha: true })
      if (!(RULES.types as readonly string[]).includes(file.type)) {
        toast('Use a PNG, JPEG or WebP image (no GIFs or SVGs).', 'error')
        return
      }
      if (file.size > RULES.maxBytes) {
        toast(`That logo is still larger than ${RULES.label}.`, 'error')
        return
      }
      const { key } = await adminApi.uploadClientLogo(file)
      update(i, { logoKey: key })
      toast('Logo uploaded. Save or publish to use it.')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Upload failed', 'error')
    } finally {
      setUploading(null)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  function add() {
    const v = name.trim()
    if (!v || full) return
    onChange([...clients, { name: v, logoKey: null }])
    setName('')
  }

  return (
    <div className="space-y-4">
      {clients.some(isPlaceholder) ? (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
          The clients marked “Placeholder” are examples. Replace or remove them before you turn this section on.
        </p>
      ) : null}
      {clients.length ? (
        <ul className="space-y-3">
          {clients.map((c, i) => {
            const label = c.name.trim() || `Client ${i + 1}`
            const url = clientLogoUrl(c.logoKey)
            const nameError = errors[`clients.items.${i}.name`] ?? errors[`clients.items.${i}.logoKey`]
            return (
              <li key={i} className="flex flex-wrap items-start gap-3 rounded-xl border border-zinc-200/80 p-3 sm:flex-nowrap dark:border-zinc-800">
                {/* Same white tile the public page uses, so you see what visitors see. */}
                <div className="relative grid h-16 w-28 shrink-0 place-items-center rounded-lg border border-zinc-200 bg-white px-3 dark:border-zinc-700">
                  {url ? (
                    <img src={url} alt="" className="max-h-10 max-w-full object-contain" />
                  ) : (
                    <span className="line-clamp-2 text-center text-xs font-medium text-zinc-500">Text only</span>
                  )}
                  {uploading === i ? <div className="absolute inset-0 animate-pulse rounded-lg bg-white/70" /> : null}
                </div>
                <div className="min-w-0 flex-1">
                  <Field label="Name" htmlFor={`hp-client-${i}`} error={nameError} counter={{ value: c.name.length, max: L.clientName }}>
                    <Input
                      id={`hp-client-${i}`}
                      value={c.name}
                      invalid={!!nameError}
                      placeholder="Client name"
                      onChange={(e) => update(i, { name: e.target.value })}
                    />
                  </Field>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" icon={url ? <UploadCloud size={14} /> : <ImagePlus size={14} />} loading={uploading === i} disabled={uploading !== null} onClick={() => pick(i)}>
                      {url ? 'Replace logo' : 'Upload logo'}
                    </Button>
                    {c.logoKey ? (
                      <Button size="sm" variant="ghost" icon={<X size={14} />} disabled={uploading !== null} onClick={() => update(i, { logoKey: null })}>
                        Use name only
                      </Button>
                    ) : null}
                    {isPlaceholder(c) ? <span className="self-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">Placeholder</span> : null}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-center">
                  <MoveButtons label={label} index={i} count={clients.length} onMove={(to) => move(i, to)} />
                  <Button variant="ghost" size="icon" aria-label={`Remove ${label}`} onClick={() => onChange(clients.filter((_, j) => j !== i))}>
                    <Trash2 size={14} />
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      ) : null}
      <Field
        label="Add a client"
        htmlFor="hp-client-new"
        error={errors['clients.items']}
        hint={`${clients.length}/${L.clients}. Logos: PNG, JPEG or WebP, up to ${RULES.label}. Clients without a logo show their name.`}
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
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) upload(f)
        }}
      />
    </div>
  )
}
