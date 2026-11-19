interface AvatarProps {
  src: string | null
  name: string
  size?: number
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts[parts.length - 1][0] ?? '') : '')).toUpperCase() || '?'
}

export function Avatar({ src, name, size = 96 }: AvatarProps) {
  return (
    <div
      className="relative shrink-0 rounded-full p-[3px]"
      style={{
        width: size,
        height: size,
        background: 'linear-gradient(135deg, var(--p-accent), color-mix(in srgb, var(--p-accent) 35%, var(--p-bg)))',
      }}
    >
      <div className="h-full w-full overflow-hidden rounded-full bg-(--p-bg) p-[2px]">
        {src ? (
          <img src={src} alt={name} className="h-full w-full rounded-full object-cover" draggable={false} />
        ) : (
          <div
            className="grid h-full w-full place-items-center rounded-full font-semibold tracking-tight"
            style={{
              background: 'color-mix(in srgb, var(--p-accent) 16%, var(--p-bg))',
              color: 'var(--p-accent)',
              fontSize: size * 0.34,
            }}
            aria-label={name}
          >
            {initials(name)}
          </div>
        )}
      </div>
    </div>
  )
}
