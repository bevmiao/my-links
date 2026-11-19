import { ImagePlus, Trash2, UploadCloud } from 'lucide-react'
import { useRef, useState, type DragEvent } from 'react'
import type { Profile } from '../../shared/types'
import { ALLOWED_IMAGE_TYPES, IMAGE_RULES, type ImageKind } from '../../shared/validation'
import { adminApi } from '../lib/api'
import { Button, cx, useToast } from './ui'

interface ImageUploaderProps {
  kind: ImageKind
  currentUrl: string | null
  onUpdated: (p: Profile) => void
  shape?: 'circle' | 'wide'
}

/**
 * Uploads straight to R2 through the Worker. The client checks type/size for fast feedback;
 * the Worker re-validates (size + magic-byte sniffing) before storing anything.
 */
export function ImageUploader({ kind, currentUrl, onUpdated, shape = 'circle' }: ImageUploaderProps) {
  const toast = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  const rules = IMAGE_RULES[kind]

  async function upload(file: File) {
    if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
      toast('Use a PNG, JPEG, WebP or GIF image.', 'error')
      return
    }
    if (file.size > rules.maxBytes) {
      toast(`That image is larger than ${rules.label}.`, 'error')
      return
    }
    setBusy(true)
    try {
      onUpdated(await adminApi.uploadImage(kind, file))
      toast(kind === 'avatar' ? 'Profile photo updated' : 'Background updated')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Upload failed', 'error')
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function remove() {
    setBusy(true)
    try {
      onUpdated(await adminApi.removeImage(kind))
      toast('Image removed')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not remove image', 'error')
    } finally {
      setBusy(false)
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) upload(file)
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={cx(
        'flex flex-col gap-4 rounded-xl border border-dashed p-4 transition sm:flex-row sm:items-center',
        dragging ? 'border-zinc-900 bg-zinc-50 dark:border-white dark:bg-zinc-800/50' : 'border-zinc-200 dark:border-zinc-800',
      )}
    >
      <div
        className={cx(
          'relative grid shrink-0 place-items-center overflow-hidden bg-zinc-100 text-zinc-400 dark:bg-zinc-800',
          shape === 'circle' ? 'size-20 rounded-full' : 'h-20 w-full rounded-lg sm:w-36',
        )}
      >
        {currentUrl ? <img src={currentUrl} alt="" className="h-full w-full object-cover" /> : <ImagePlus size={22} />}
        {busy ? <div className="absolute inset-0 animate-pulse bg-white/60 dark:bg-black/50" /> : null}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{currentUrl ? 'Replace image' : 'Upload an image'}</p>
        <p className="mt-0.5 text-xs text-zinc-500">Drag & drop or browse · PNG, JPEG, WebP or GIF · up to {rules.label}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" icon={<UploadCloud size={14} />} loading={busy} onClick={() => inputRef.current?.click()}>
            Choose file
          </Button>
          {currentUrl ? (
            <Button size="sm" variant="ghost" icon={<Trash2 size={14} />} disabled={busy} onClick={remove}>
              Remove
            </Button>
          ) : null}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={ALLOWED_IMAGE_TYPES.join(',')}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) upload(f)
          }}
        />
      </div>
    </div>
  )
}
