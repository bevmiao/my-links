import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import type { Profile, ThemeMode } from '../../shared/types'

export type ResolvedMode = 'light' | 'dark'

function systemPrefersDark() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches
}

export function resolveMode(mode: ThemeMode): ResolvedMode {
  if (mode === 'system') return systemPrefersDark() ? 'dark' : 'light'
  return mode
}

function readStored(key: string): ResolvedMode | null {
  try {
    const v = localStorage.getItem(key)
    return v === 'light' || v === 'dark' ? v : null
  } catch {
    return null
  }
}

/**
 * Persisted light/dark toggle. `key` separates the visitor's preference on the public
 * page from the owner's dashboard preference.
 */
export function useThemeMode(key: string, fallback: ThemeMode, applyToDocument = true) {
  const [mode, setMode] = useState<ResolvedMode>(() => readStored(key) ?? resolveMode(fallback))

  // Follow the OS while the user hasn't chosen explicitly.
  useEffect(() => {
    if (readStored(key) || fallback !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => setMode(mq.matches ? 'dark' : 'light')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [key, fallback])

  useEffect(() => {
    if (!applyToDocument) return
    const root = document.documentElement
    root.classList.toggle('dark', mode === 'dark')
    root.style.colorScheme = mode
  }, [mode, applyToDocument])

  const toggle = useCallback(() => {
    setMode((m) => {
      const next = m === 'dark' ? 'light' : 'dark'
      try {
        localStorage.setItem(key, next)
      } catch {
        /* storage unavailable — keep in memory */
      }
      return next
    })
  }, [key])

  return { mode, toggle }
}

/* ---------- colour helpers for the customisable profile palette ---------- */

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.replace(/./g, (c) => c + c) : h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function luminance(hex: string) {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function isDarkColor(hex: string) {
  return luminance(hex) < 0.22
}

/** Readable text colour on top of `hex`: whichever of near-black or white has more contrast. */
export function onColor(hex: string) {
  const l = luminance(hex)
  const onWhite = 1.05 / (l + 0.05)
  const onBlack = (l + 0.05) / (luminance('#0a0a0a') + 0.05)
  return onBlack > onWhite ? '#0a0a0a' : '#ffffff'
}

function contrast(a: string, b: string) {
  const [x, y] = [luminance(a), luminance(b)]
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}

function mix(hex: string, toward: [number, number, number], t: number) {
  const c = hexToRgb(hex).map((v, i) => Math.round(v + (toward[i] - v) * t))
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

/**
 * The accent, nudged lighter (on dark backgrounds) or darker (on light ones) until it reaches
 * `min` contrast against `bg`. Used for accent-coloured text and icons, so any accent the owner
 * picks stays readable (WCAG AA 4.5:1) in both themes. Decorative fills keep the raw accent.
 */
export function readableAccent(accent: string, bg: string, min = 4.5) {
  const toward: [number, number, number] = isDarkColor(bg) ? [255, 255, 255] : [0, 0, 0]
  for (let t = 0; t <= 1; t += 0.05) {
    const c = mix(accent, toward, t)
    if (contrast(c, bg) >= min) return c
  }
  return isDarkColor(bg) ? '#ffffff' : '#000000'
}

/** Warm "cozy film" palette offered as a one-click preset in Appearance. */
export const COZY_PRESET = { accentColor: '#c06a3c', backgroundLight: '#f6efe5', backgroundDark: '#16120f' } as const

/**
 * CSS custom properties consumed by ProfileView. Derived from the owner's chosen colours so
 * any background colour stays readable in both themes.
 */
/**
 * Link cards are white with dark text in both themes (owner decision, 2026-11-22), which reads
 * more cleanly on a dark page or background photo. They use the light-mode card colours; on a dark
 * page the card is nearly opaque, because the light-mode 78% white would let the dark page show
 * through and look grey. Applied as CSS variables on each card only, so the page around the cards
 * keeps its own theme. In light mode nothing changes.
 */
export function linkCardSurface(profile: Pick<Profile, 'accentColor' | 'backgroundLight' | 'backgroundDark'>, mode: ResolvedMode): CSSProperties {
  const light = profilePalette(profile, 'light') as Record<string, string>
  const keys = ['--p-card', '--p-card-hover', '--p-border', '--p-shadow', '--p-fg', '--p-muted', '--p-accent-text'] as const
  const surface: Record<string, string> = Object.fromEntries(keys.map((k) => [k, light[k]]))
  if (mode === 'dark') {
    surface['--p-card'] = 'rgba(255,255,255,0.95)'
    surface['--p-card-hover'] = 'rgba(255,255,255,1)'
    surface['--p-border'] = 'rgba(255,255,255,0.6)'
  }
  return surface as CSSProperties
}

export function profilePalette(profile: Pick<Profile, 'accentColor' | 'backgroundLight' | 'backgroundDark'>, mode: ResolvedMode) {
  const bg = mode === 'dark' ? profile.backgroundDark : profile.backgroundLight
  const darkSurface = isDarkColor(bg)
  return {
    '--p-bg': bg,
    '--p-accent': profile.accentColor,
    '--p-accent-text': readableAccent(profile.accentColor, bg),
    '--p-on-accent': onColor(profile.accentColor),
    '--p-fg': darkSurface ? '#f4f4f5' : '#0a0a0a',
    '--p-muted': darkSurface ? 'rgba(244,244,245,0.62)' : 'rgba(10,10,10,0.56)',
    '--p-card': darkSurface ? 'rgba(255,255,255,0.045)' : 'rgba(255,255,255,0.78)',
    '--p-card-hover': darkSurface ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,1)',
    '--p-border': darkSurface ? 'rgba(255,255,255,0.09)' : 'rgba(10,10,10,0.08)',
    '--p-shadow': darkSurface ? '0 1px 0 rgba(255,255,255,0.04) inset' : '0 1px 2px rgba(10,10,10,0.04)',
    '--p-grain-opacity': darkSurface ? '0.15' : '0.11',
    // Soft film vignette at the edges: a little darker in dark mode, a faint warm tone in light mode.
    '--p-vignette': darkSurface ? 'rgba(0,0,0,0.38)' : 'rgba(120,84,48,0.10)',
  } as CSSProperties
}
