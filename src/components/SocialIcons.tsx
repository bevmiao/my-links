import type { SocialLink } from '../../shared/types'
import { getPlatform } from './icons'

export function SocialIcons({ socials, preview }: { socials: SocialLink[]; preview?: boolean }) {
  const items = socials.map((s) => ({ ...s, platform: getPlatform(s.platform) })).filter((s) => s.platform)
  if (!items.length) return null
  return (
    <ul className="flex flex-wrap items-center justify-center gap-1.5">
      {items.map(({ platform, url }, i) => {
        const { Icon, label } = platform!
        return (
          <li key={`${platform!.key}-${i}`}>
            <a
              href={url}
              target={preview ? '_blank' : undefined}
              rel="me noopener noreferrer"
              aria-label={label}
              title={label}
              className="grid size-10 place-items-center rounded-full text-(--p-muted) transition duration-200 hover:-translate-y-0.5 hover:bg-(--p-card-hover) hover:text-(--p-accent)"
            >
              <Icon size={19} />
            </a>
          </li>
        )
      })}
    </ul>
  )
}
