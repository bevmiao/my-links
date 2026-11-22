/**
 * Shared settings for the `motion` package. Components use `m.*` from 'motion/react-m' inside
 * the <LazyMotion features={domAnimation} strict> set up in ProfileView, never `motion.*`, to keep
 * the bundle small. MotionConfig reducedMotion="user" there turns transform animations off for
 * visitors who ask for reduced motion.
 */
import type { Transition } from 'motion/react'

/** Tap feedback: press in a little, spring back with a small bounce. Spread onto an m.* element. */
export const tapSquish = {
  whileTap: { scale: 0.95 },
  transition: { type: 'spring', stiffness: 600, damping: 17 } satisfies Transition,
} as const

/** Same, gentler, for wide rows where a big squish looks odd. */
export const tapSquishSoft = {
  whileTap: { scale: 0.98 },
  transition: { type: 'spring', stiffness: 600, damping: 20 } satisfies Transition,
} as const

/** Same, stronger, for small round icon buttons. */
export const tapSquishIcon = {
  whileTap: { scale: 0.85 },
  transition: { type: 'spring', stiffness: 600, damping: 15 } satisfies Transition,
} as const
