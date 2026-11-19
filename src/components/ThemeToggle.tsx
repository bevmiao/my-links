import { Moon, Sun } from 'lucide-react'

interface ThemeToggleProps {
  mode: 'light' | 'dark'
  onToggle: () => void
  className?: string
}

/** Sun/moon toggle. Uses the surrounding palette via currentColor. */
export function ThemeToggle({ mode, onToggle, className = '' }: ThemeToggleProps) {
  const dark = mode === 'dark'
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={dark ? 'Light theme' : 'Dark theme'}
      className={`relative grid size-10 place-items-center overflow-hidden rounded-full transition duration-200 active:scale-95 ${className}`}
    >
      <Sun
        size={18}
        aria-hidden="true"
        className={`absolute transition duration-500 ${dark ? 'rotate-90 scale-50 opacity-0' : 'rotate-0 scale-100 opacity-100'}`}
      />
      <Moon
        size={18}
        aria-hidden="true"
        className={`absolute transition duration-500 ${dark ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-50 opacity-0'}`}
      />
    </button>
  )
}
