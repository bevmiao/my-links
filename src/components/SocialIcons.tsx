import * as m from 'motion/react-m'
import type { SocialLink } from '../../shared/types'
import { tapSquishIcon } from '../lib/motion'
import { getPlatform } from './icons'

export function SocialIcons({ socials, preview, className = 'justify-center' }: { socials: SocialLink[]; preview?: boolean; className?: string }) {
  const items = socials.map((s) => ({ ...s, platform: getPlatform(s.platform) })).filter((s) => s.platform)
  if (!items.length) return null
  return (
    <ul className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {items.map(({ platform, url }, i) => {
        const { Icon, label } = platform!
        return (
          <li key={`${platform!.key}-${i}`}>
            <m.a
              {...tapSquishIcon}
              href={url}
              target={preview ? '_blank' : undefined}
              rel="me noopener noreferrer"
              aria-label={label}
              title={label}
              className="grid size-11 place-items-center rounded-full text-(--p-muted) transition-no-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:-translate-y-1 hover:scale-110 hover:bg-(--p-card-hover) hover:text-(--p-accent-text)"
            >
              <Icon size={19} />
            </m.a>
          </li>
        )
      })}
    </ul>
  )
}
