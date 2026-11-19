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

/** Readable text colour (near-black or near-white) on top of `hex`. */
export function onColor(hex: string) {
  return luminance(hex) > 0.45 ? '#0a0a0a' : '#ffffff'
}

/**
 * CSS custom properties consumed by ProfileView. Derived from the owner's chosen colours so
 * any background colour stays readable in both themes.
 */
export function profilePalette(profile: Pick<Profile, 'accentColor' | 'backgroundLight' | 'backgroundDark'>, mode: ResolvedMode) {
  const bg = mode === 'dark' ? profile.backgroundDark : profile.backgroundLight
  const darkSurface = isDarkColor(bg)
  return {
    '--p-bg': bg,
    '--p-accent': profile.accentColor,
    '--p-on-accent': onColor(profile.accentColor),
    '--p-fg': darkSurface ? '#f4f4f5' : '#0a0a0a',
    '--p-muted': darkSurface ? 'rgba(244,244,245,0.62)' : 'rgba(10,10,10,0.56)',
    '--p-card': darkSurface ? 'rgba(255,255,255,0.045)' : 'rgba(255,255,255,0.78)',
    '--p-card-hover': darkSurface ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,1)',
    '--p-border': darkSurface ? 'rgba(255,255,255,0.09)' : 'rgba(10,10,10,0.08)',
    '--p-shadow': darkSurface ? '0 1px 0 rgba(255,255,255,0.04) inset' : '0 1px 2px rgba(10,10,10,0.04)',
  } as CSSProperties
}
