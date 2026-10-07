import { useState } from 'react'
import { Play } from 'lucide-react'
import type { LinkPreview } from '../lib/types'

/* ─── Fallbacks ──────────────────────────────────────── */
function extractVideoId(preview: LinkPreview): string | null {
  if (preview.videoId) return preview.videoId
  const source = preview.embedUrl || preview.url || ''
  const match = source.match(/(?:embed\/|v=|youtu\.be\/)([A-Za-z0-9_-]{6,})/)
  return match?.[1] ?? null
}

function resolveThumbnail(preview: LinkPreview): string | null {
  if (preview.thumbnailUrl) return preview.thumbnailUrl
  if (preview.image) return preview.image
  const videoId = extractVideoId(preview)
  return videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : null
}

/** Append autoplay=1 without breaking any query string the embed URL already has. */
function withAutoplay(embedUrl: string): string {
  if (/[?&]autoplay=/.test(embedUrl)) return embedUrl
  return `${embedUrl}${embedUrl.includes('?') ? '&' : '?'}autoplay=1`
}

/* ─── Lite YouTube Embed ──────────────────────────────
   Renders only the thumbnail + play button. The real
   <iframe> is mounted exclusively on user click, so it
   never blocks first paint or the main thread.          */
export function LiteYouTubeEmbed({ preview, bare }: { preview: LinkPreview; bare?: boolean }) {
  const [playing, setPlaying] = useState(false)

  const embedUrl = preview.embedUrl
  if (!embedUrl) return null

  const thumbnail = resolveThumbnail(preview)
  const title = preview.title || 'YouTube video'

  // `bare`: se monta dentro de un marco (EmbedShell) que ya aporta bordes
  return (
    <div className={bare ? 'overflow-hidden rounded-lg' : 'mt-3 overflow-hidden rounded-xl border border-border'}>
      <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
        {playing ? (
          <iframe
            src={withAutoplay(embedUrl)}
            title={title}
            className="absolute inset-0 h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            aria-label={`Play video: ${title}`}
            className="group absolute inset-0 h-full w-full cursor-pointer overflow-hidden bg-bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            {thumbnail && (
              <img
                src={thumbnail}
                alt=""
                loading="lazy"
                decoding="async"
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
            )}

            {/* Subtle bottom fade so the play button reads over any thumbnail */}
            <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />

            {/* Play button — YouTube-style, centered */}
            <span className="pointer-events-none absolute left-1/2 top-1/2 flex h-12 w-[4.5rem] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-xl bg-[#ff0000] shadow-lg transition-transform duration-200 group-hover:scale-110 group-active:scale-95">
              <Play className="h-5 w-5 fill-white text-white" />
            </span>
          </button>
        )}
      </div>
    </div>
  )
}
