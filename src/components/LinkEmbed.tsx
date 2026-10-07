import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { ExternalLink, Link2, Loader2 } from 'lucide-react'
import { links as linksApi } from '../lib/api'
import { LiteYouTubeEmbed } from './LiteYouTubeEmbed'
import { classifyUrl, detectEmbeds, embedUrlFor, type MediaEmbed, type MediaPlatform } from '../lib/embeds'
import type { LinkPreview } from '../lib/types'

/* ─── Identidad visual por plataforma (cyberpunk/oscuro) ─── */
const PLATFORM_META: Record<MediaPlatform, { label: string; color: string }> = {
  youtube: { label: 'YouTube', color: '#ff4d4d' },
  tiktok: { label: 'TikTok', color: '#25f4ee' },
  twitter: { label: 'X / Twitter', color: '#8b6cff' },
  spotify: { label: 'Spotify', color: '#1db954' },
  link: { label: 'Enlace', color: '#9d7cff' },
}

/**
 * Marco oscuro compartido: chip de plataforma + hostname + icono abrir.
 * Bordes redondeados, borde púrpura tenue y fondo negro, acorde a CodeBuds.
 */
function EmbedShell({
  platform,
  hostname,
  href,
  children,
  className = '',
}: {
  platform: MediaPlatform
  hostname: string
  href: string
  children: ReactNode
  className?: string
}) {
  const meta = PLATFORM_META[platform] ?? PLATFORM_META.link
  return (
    <div
      className={`overflow-hidden rounded-xl border border-border bg-black/60 shadow-[0_0_18px_rgba(124,58,237,0.10)] transition-colors hover:border-accent/40 ${className}`}
    >
      <div className="flex items-center gap-2 border-b border-border-light bg-bg-card/70 px-3 py-1.5">
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: meta.color, boxShadow: `0 0 8px ${meta.color}` }}
          aria-hidden="true"
        />
        <span className="truncate text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
          {meta.label}
        </span>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="ml-auto flex shrink-0 items-center gap-1 text-[10px] text-text-muted transition-colors hover:text-accent"
        >
          <span className="max-w-[140px] truncate">{hostname || 'abrir'}</span>
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
      {children}
    </div>
  )
}

/* ─── Reproductor por plataforma ─────────────────────────── */

function PlatformPlayer({ embed, compact }: { embed: MediaEmbed; compact?: boolean }) {
  const src = embedUrlFor(embed)
  if (!src) return null

  // YouTube: miniatura + botón play, el iframe sólo se monta al hacer click
  if (embed.platform === 'youtube') {
    return (
      <div className="p-2">
        <LiteYouTubeEmbed
          bare
          preview={{
            type: 'youtube',
            url: embed.url,
            embedUrl: src,
            thumbnailUrl: `https://i.ytimg.com/vi/${embed.videoId}/hqdefault.jpg`,
          }}
        />
      </div>
    )
  }

  // TikTok: vertical (562×750), centrado para que no estire en el feed
  if (embed.platform === 'tiktok') {
    return (
      <div className="flex justify-center bg-black/40 p-2">
        <iframe
          src={src}
          title="TikTok video"
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          className="h-[420px] w-[315px] max-w-full rounded-lg border-0 bg-black"
        />
      </div>
    )
  }

  // Twitter/X: tweet incrustado en tema oscuro
  if (embed.platform === 'twitter') {
    return (
      <iframe
        src={src}
        title="Tweet"
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
        className={`w-full border-0 bg-black ${compact ? 'h-[400px]' : 'h-[470px]'}`}
      />
    )
  }

  // Spotify: 152px para pistas/episodios, 352px para álbumes/listas
  if (embed.platform === 'spotify') {
    const tall = embed.spotifyKind === 'album' || embed.spotifyKind === 'playlist' || embed.spotifyKind === 'show'
    return (
      <iframe
        src={src}
        title="Spotify player"
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        className={`w-full border-0 bg-black ${tall ? 'h-[352px]' : 'h-[152px]'}`}
      />
    )
  }

  return null
}

/* ─── Link Preview genérico (Open Graph) ─────────────────── */

type PreviewState = { status: 'loading' | 'ready' | 'error'; data?: LinkPreview }

/** Caché en módulo: el mismo enlace no se vuelve a pedir al re-renderizar. */
const previewCache = new Map<string, PreviewState>()

function LinkPreviewBox({
  url,
  hostname,
  initial,
  compact,
}: {
  url: string
  hostname: string
  initial?: LinkPreview | null
  compact?: boolean
}) {
  const [state, setState] = useState<PreviewState>(() => {
    if (initial && (initial.title || initial.image)) return { status: 'ready', data: initial }
    return previewCache.get(url) ?? { status: 'loading' }
  })

  useEffect(() => {
    if (previewCache.get(url)) return
    let cancelled = false
    linksApi
      .preview(url)
      .then((data) => {
        const next: PreviewState = { status: 'ready', data }
        previewCache.set(url, next)
        if (!cancelled) setState(next)
      })
      .catch((err) => {
        // Nunca rompe el render: se muestra el fallback con el dominio
        console.error('[LinkEmbed] Link preview failed:', err)
        const next: PreviewState = { status: 'error' }
        previewCache.set(url, next)
        if (!cancelled) setState(next)
      })
    return () => {
      cancelled = true
    }
  }, [url])

  const data = state.status === 'ready' ? state.data : initial ?? undefined
  const title = data?.title || null
  const image = data?.image || null
  const description = data?.description || null
  const siteName = data?.siteName || hostname

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-bg-card/80 transition-all hover:border-accent/50 hover:shadow-[0_0_18px_rgba(124,58,237,0.18)]"
    >
      {state.status === 'loading' && !title ? (
        <div className="flex items-center gap-2 px-3 py-3">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />
          <span className="text-[11px] text-text-muted">Cargando enlace…</span>
        </div>
      ) : (
        <>
          {image && (
            <div className="relative max-h-[200px] w-full overflow-hidden bg-bg-primary">
              <img
                src={image}
                alt=""
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                onError={(e) => {
                  ;(e.target as HTMLImageElement).style.display = 'none'
                }}
              />
              <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
            </div>
          )}
          <div className={`flex items-start gap-2.5 px-3 ${compact ? 'py-2' : 'py-2.5'}`}>
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-border bg-bg-primary text-accent">
              <Link2 className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-medium uppercase tracking-wider text-text-muted">
                {siteName || hostname}
              </p>
              <p className="truncate text-sm font-semibold text-text-primary transition-colors group-hover:text-accent">
                {title || hostname}
              </p>
              {description && (
                <p className="mt-0.5 line-clamp-2 text-xs text-text-muted">{description}</p>
              )}
            </div>
            <ExternalLink className="mt-1 h-3.5 w-3.5 shrink-0 text-text-muted transition-colors group-hover:text-accent" />
          </div>
        </>
      )}
    </a>
  )
}

/* ─── API pública: embeds de un texto (posts y chats) ─────── */

interface ContentEmbedsProps {
  text: string
  /** Preview ya calculado por el backend (posts); evita una petición extra. */
  preview?: LinkPreview | null
  /** Nº máximo de embeds (2 en feed, 1 en burbujas de chat). */
  max?: number
  /** Burbuja de chat: márgenes/alturas más compactos. */
  compact?: boolean
  className?: string
}

/**
 * Detecta las URLs del texto y renderiza el reproductor de la plataforma
 * (YouTube/TikTok/X/Spotify) o una tarjeta Open Graph para el resto.
 * Devuelve `null` si el texto no contiene enlaces → cero coste en render.
 */
export function ContentEmbeds({ text, preview, max = 2, compact, className = '' }: ContentEmbedsProps) {
  const embeds = useMemo(() => {
    const list = detectEmbeds(text, max)
    if (list.length === 0 && preview?.url && preview.type && preview.type !== 'link') {
      // El backend ya clasificó el enlace pero el texto no se pudo analizar aquí
      const fallback = classifyUrl(preview.url)
      if (fallback.platform !== 'link') list.push(fallback)
    }
    return list
  }, [text, preview, max])

  if (embeds.length === 0) return null

  return (
    <div className={`mt-2.5 space-y-2.5 ${className}`}>
      {embeds.map((embed) => {
        if (embed.platform === 'link') {
          const stored = preview && preview.url === embed.url ? preview : null
          return (
            <LinkPreviewBox
              key={embed.url}
              url={embed.url}
              hostname={embed.hostname}
              initial={stored}
              compact={compact}
            />
          )
        }
        return (
          <EmbedShell key={embed.url} platform={embed.platform} hostname={embed.hostname} href={embed.url}>
            <PlatformPlayer embed={embed} compact={compact} />
          </EmbedShell>
        )
      })}
    </div>
  )
}
