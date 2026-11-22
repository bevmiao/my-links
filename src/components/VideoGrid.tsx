import { Play } from 'lucide-react'
import { useState } from 'react'
import type { VideoItem } from '../../shared/types'

/**
 * YouTube videos, click to load. Until a visitor taps, only a thumbnail image is shown: no player,
 * no YouTube script, no cookies. Tapping swaps in the privacy-enhanced player
 * (youtube-nocookie.com), which then starts playing because the visitor asked it to.
 * The CSP allows exactly these two hosts (worker/lib/http.ts).
 */
export function VideoGrid({ items }: { items: VideoItem[] }) {
  return (
    <ul className={`grid gap-4 ${items.length > 1 ? '@xl:grid-cols-2' : ''}`}>
      {items.map((v) => (
        <li key={v.videoId}>
          <Video video={v} />
        </li>
      ))}
    </ul>
  )
}

function Video({ video }: { video: VideoItem }) {
  const [playing, setPlaying] = useState(false)
  const id = encodeURIComponent(video.videoId)
  return (
    <figure>
      <div className="relative aspect-video overflow-hidden rounded-(--p-radius-inner) border border-(--p-border) bg-black shadow-sm">
        {playing ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&playsinline=1`}
            title={video.title}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            className="absolute inset-0 size-full"
          />
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            aria-label={`Play video: ${video.title}`}
            className="group absolute inset-0 size-full"
          >
            <img
              src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`}
              alt=""
              loading="lazy"
              decoding="async"
              className="size-full object-cover opacity-90 transition duration-500 group-hover:scale-[1.03] group-hover:opacity-100"
            />
            <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
            <span
              aria-hidden="true"
              className="absolute top-1/2 left-1/2 grid size-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-(--p-accent) text-(--p-on-accent) shadow-lg transition duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover:scale-110 group-active:scale-95"
            >
              <Play size={22} className="translate-x-0.5" fill="currentColor" />
            </span>
          </button>
        )}
      </div>
      <figcaption className="mt-2 text-(length:--p-text-small) font-medium text-(--p-fg)/85">{video.title}</figcaption>
    </figure>
  )
}
