import { Crop, ImagePlus, Trash2, UploadCloud } from 'lucide-react'
import { useRef, useState, type DragEvent } from 'react'
import type { Profile } from '../../shared/types'
import { ALLOWED_IMAGE_TYPES, IMAGE_RULES, type ProfileImageKind } from '../../shared/validation'
import { adminApi } from '../lib/api'
import { MAX_INPUT_BYTES, SHRINK_MAX_SIDE, shrinkImage } from '../lib/shrinkImage'
import { AvatarCropper } from './AvatarCropper'
import { Button, cx, useToast } from './ui'

interface ImageUploaderProps {
  kind: ProfileImageKind
  currentUrl: string | null
  onUpdated: (p: Profile) => void
  shape?: 'circle' | 'wide'
}

const isAllowed = (type: string) => (ALLOWED_IMAGE_TYPES as readonly string[]).includes(type)

/**
 * Shrinks the photo in the browser (src/lib/shrinkImage.ts), then uploads it to R2 through the
 * Worker. Profile photos first open the cropper (AvatarCropper) so the owner can position them
 * in the circle; "Adjust position" reopens it on the current photo. The client checks type/size for fast feedback; the Worker re-validates (size +
 * magic-byte sniffing) before storing anything.
 */
export function ImageUploader({ kind, currentUrl, onUpdated, shape = 'circle' }: ImageUploaderProps) {
  const toast = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [crop, setCrop] = useState<{ bitmap: ImageBitmap; name: string } | null>(null)
  const rules = IMAGE_RULES[kind]

  function closeCrop() {
    crop?.bitmap.close()
    setCrop(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  /** Profile photos (not GIFs, so animation is kept) go through the cropper first. */
  async function choose(original: File) {
    if (kind !== 'avatar' || original.type === 'image/gif' || !original.type.startsWith('image/') || original.type === 'image/svg+xml' || original.size > MAX_INPUT_BYTES) {
      return upload(original)
    }
    try {
      setCrop({ bitmap: await createImageBitmap(original), name: original.name })
    } catch {
      // The browser can't open it for editing; fall back to the normal checks and upload.
      return upload(original)
    }
  }

  /** Reopen the cropper on the photo that's already up. */
  async function adjust() {
    if (!currentUrl) return
    setBusy(true)
    try {
      const res = await fetch(currentUrl)
      if (!res.ok) throw new Error('Couldn’t load your current photo.')
      const blob = await res.blob()
      if (blob.type === 'image/gif') throw new Error('GIFs can’t be repositioned. Upload a new photo instead.')
      setCrop({ bitmap: await createImageBitmap(blob), name: 'avatar' })
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Couldn’t open that photo', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function saveCrop(file: File) {
    closeCrop()
    setBusy(true)
    try {
      onUpdated(await adminApi.uploadImage(kind, file))
      toast('Profile photo updated')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Upload failed', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function upload(original: File) {
    // Any image the browser can open is fine here (e.g. HEIC on iPhone); it's converted below.
    if (!original.type.startsWith('image/') || original.type === 'image/svg+xml') {
      toast('Use a photo: JPEG, PNG, WebP, HEIC or GIF.', 'error')
      return
    }
    if (original.size > MAX_INPUT_BYTES) {
      toast('That file is too big to process. Try one under 40 MB.', 'error')
      return
    }
    setBusy(true)
    try {
      const file = await shrinkImage(original, SHRINK_MAX_SIDE[kind], rules.maxBytes)
      if (!isAllowed(file.type)) {
        toast('This browser couldn’t convert that photo. Try a JPEG or PNG.', 'error')
        return
      }
      if (file.size > rules.maxBytes) {
        toast(file.type === 'image/gif' ? `GIFs aren’t resized, so they need to be under ${rules.label}.` : `That image is still larger than ${rules.label}.`, 'error')
        return
      }
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
    if (file) choose(file)
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
        <p className="mt-0.5 text-xs text-zinc-500">
          Drag & drop or browse. Any size photo works; it’s resized automatically so your page loads fast.
          {kind === 'avatar' ? ' You’ll get to position it in the circle.' : ''}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" icon={<UploadCloud size={14} />} loading={busy} onClick={() => inputRef.current?.click()}>
            Choose file
          </Button>
          {currentUrl && kind === 'avatar' ? (
            <Button size="sm" variant="secondary" icon={<Crop size={14} />} disabled={busy} onClick={adjust}>
              Adjust position
            </Button>
          ) : null}
          {currentUrl ? (
            <Button size="sm" variant="ghost" icon={<Trash2 size={14} />} disabled={busy} onClick={remove}>
              Remove
            </Button>
          ) : null}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) choose(f)
          }}
        />
      </div>
      {kind === 'avatar' ? (
        <AvatarCropper bitmap={crop?.bitmap ?? null} fileName={crop?.name ?? 'avatar'} maxBytes={rules.maxBytes} onCancel={closeCrop} onSave={saveCrop} />
      ) : null}
    </div>
  )
}
