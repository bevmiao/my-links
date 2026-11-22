import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'

/**
 * Fades and lifts its children in the first time they scroll into view (styles: `.reveal` in
 * src/index.css). `instant` shows them immediately, e.g. in the dashboard preview.
 * Visitors who ask for reduced motion always see content immediately (CSS media query).
 */
export function Reveal({
  children,
  delay = 0,
  instant,
  className = '',
}: {
  children: ReactNode
  delay?: number
  instant?: boolean
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(!!instant)

  useEffect(() => {
    if (instant) return
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true)
          io.disconnect()
        }
      },
      { rootMargin: '0px 0px -6% 0px', threshold: 0.1 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [instant])

  return (
    <div
      ref={ref}
      className={`reveal ${className}`}
      data-revealed={shown || instant ? '' : undefined}
      style={{ '--reveal-delay': `${delay}ms` } as CSSProperties}
    >
      {children}
    </div>
  )
}

/** Splits a short line into words that pop in one after another once the parent Reveal shows. */
export function Words({ text, step = 45 }: { text: string; step?: number }) {
  return (
    <>
      {text.split(/(\s+)/).map((part, i) =>
        /^\s+$/.test(part) ? (
          part
        ) : (
          <span key={i} className="word" style={{ '--word-delay': `${(i / 2) * step}ms` } as CSSProperties}>
            {part}
          </span>
        ),
      )}
    </>
  )
}
