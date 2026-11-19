/* eslint-disable react-refresh/only-export-components */
import { Loader2, X } from 'lucide-react'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react'

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

/* ---------------- Button ---------------- */

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 shadow-sm',
  secondary:
    'border border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800 shadow-xs',
  ghost: 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/70 dark:hover:text-zinc-100',
  danger: 'bg-red-600 text-white hover:bg-red-500 shadow-sm',
}

export function Button({
  variant = 'secondary',
  size = 'md',
  loading,
  icon,
  className,
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: 'sm' | 'md' | 'icon'
  loading?: boolean
  icon?: ReactNode
}) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50',
        size === 'sm' && 'h-8 px-3 text-[13px]',
        size === 'md' && 'h-9 px-3.5 text-sm',
        size === 'icon' && 'size-8',
        VARIANTS[variant],
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : icon}
      {children}
    </button>
  )
}

/* ---------------- Form fields ---------------- */

const inputBase =
  'w-full rounded-lg border bg-white px-3 text-sm text-zinc-900 shadow-xs outline-none transition placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-4 focus:ring-zinc-900/5 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:focus:border-zinc-600 dark:focus:ring-white/5'

export function Field({
  label,
  hint,
  error,
  children,
  htmlFor,
  counter,
}: {
  label: string
  hint?: ReactNode
  error?: string
  children: ReactNode
  htmlFor?: string
  counter?: { value: number; max: number }
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={htmlFor} className="text-[13px] font-medium text-zinc-700 dark:text-zinc-300">
          {label}
        </label>
        {counter ? (
          <span className={cx('text-xs tabular-nums', counter.value > counter.max ? 'text-red-500' : 'text-zinc-400')}>
            {counter.value}/{counter.max}
          </span>
        ) : null}
      </div>
      {children}
      {error ? (
        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
      ) : hint ? (
        <p className="text-xs text-zinc-500 dark:text-zinc-500">{hint}</p>
      ) : null}
    </div>
  )
}

export function Input({ invalid, className, ...rest }: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <input
      className={cx(inputBase, 'h-9', invalid ? 'border-red-400 dark:border-red-500/60' : 'border-zinc-200 dark:border-zinc-800', className)}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  )
}

export function Textarea({ invalid, className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return (
    <textarea
      className={cx(inputBase, 'min-h-[88px] resize-y py-2', invalid ? 'border-red-400' : 'border-zinc-200 dark:border-zinc-800', className)}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  )
}

export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(
        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 disabled:opacity-50',
        checked ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-700',
      )}
    >
      <span
        className={cx(
          'inline-block size-4 rounded-full bg-white shadow transition-transform duration-200',
          checked ? 'translate-x-[18px]' : 'translate-x-0.5',
        )}
      />
    </button>
  )
}

export function ColorInput({ value, onChange, id }: { value: string; onChange: (v: string) => void; id?: string }) {
  const [text, setText] = useState(value)
  const [synced, setSynced] = useState(value)
  if (value !== synced) {
    // External change (swatch click, discard): adopt it. Render-time sync avoids an extra effect pass.
    setSynced(value)
    setText(value)
  }
  return (
    <div className="flex items-center gap-2">
      <label className="relative size-9 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-zinc-200 shadow-xs dark:border-zinc-800">
        <span className="absolute inset-0" style={{ background: value }} />
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 cursor-pointer opacity-0"
          aria-label="Pick colour"
        />
      </label>
      <Input
        id={id}
        value={text}
        maxLength={7}
        spellCheck={false}
        className="font-mono uppercase"
        onChange={(e) => {
          const v = e.target.value.startsWith('#') ? e.target.value : `#${e.target.value}`
          setText(v)
          if (/^#[0-9a-fA-F]{6}$/.test(v)) onChange(v.toLowerCase())
        }}
        onBlur={() => setText(value)}
      />
    </div>
  )
}

/* ---------------- Card ---------------- */

export function Card({
  title,
  description,
  actions,
  children,
  className,
}: {
  title?: ReactNode
  description?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={cx(
        'rounded-2xl border border-zinc-200/80 bg-white shadow-xs dark:border-zinc-800/80 dark:bg-zinc-900/60',
        className,
      )}
    >
      {title || actions ? (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-100 px-5 py-4 dark:border-zinc-800/80">
          <div>
            {title ? <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2> : null}
            {description ? <p className="mt-0.5 text-[13px] text-zinc-500 dark:text-zinc-400">{description}</p> : null}
          </div>
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </header>
      ) : null}
      <div className="p-5">{children}</div>
    </section>
  )
}

/* ---------------- Modal (native <dialog>: focus trap + Esc for free) ---------------- */

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl border border-zinc-200 bg-white p-0 text-zinc-900 shadow-2xl backdrop:bg-zinc-950/40 backdrop:backdrop-blur-sm open:animate-pop-in dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
    >
      {open ? (
        <div className="flex max-h-[85dvh] flex-col">
          <header className="flex items-center justify-between border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
            <h2 id={titleId} className="text-[15px] font-semibold tracking-tight">
              {title}
            </h2>
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
              <X size={16} />
            </Button>
          </header>
          <div className="overflow-y-auto px-5 py-5">{children}</div>
          {footer ? (
            <footer className="flex justify-end gap-2 border-t border-zinc-100 px-5 py-3.5 dark:border-zinc-800">{footer}</footer>
          ) : null}
        </div>
      ) : null}
    </dialog>
  )
}

/* ---------------- Toasts ---------------- */

interface Toast {
  id: number
  message: string
  tone: 'success' | 'error'
}
const ToastContext = createContext<(message: string, tone?: Toast['tone']) => void>(() => {})
export const useToast = () => useContext(ToastContext)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const push = useCallback((message: string, tone: Toast['tone'] = 'success') => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, message, tone }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500)
  }, [])
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cx(
              'pointer-events-auto flex animate-pop-in items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium shadow-lg',
              t.tone === 'success' ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900' : 'bg-red-600 text-white',
            )}
          >
            <span className={cx('size-1.5 rounded-full', t.tone === 'success' ? 'bg-emerald-400' : 'bg-white')} />
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export { cx }
