/**
 * Detección de enlaces multimedia para publicaciones y chats.
 *
 * Mismo módulo lo usan el feed (PostCard) y los mensajes (MessageBubble):
 * clasifica la primera URL de un texto en plataforma embebible (YouTube,
 * TikTok, Twitter/X, Spotify) o enlace genérico (que se resuelve con
 * metadata Open Graph desde el backend).
 */

export type MediaPlatform = 'youtube' | 'tiktok' | 'twitter' | 'spotify' | 'link'

export interface MediaEmbed {
  platform: MediaPlatform
  /** URL original (sin puntuación final) */
  url: string
  /** Host sin "www." (para el preview / el chip de la tarjeta) */
  hostname: string
  /** YouTube: id de vídeo de 11 caracteres */
  videoId?: string
  /** TikTok: id numérico del vídeo */
  tiktokId?: string
  /** Twitter/X: id del tweet */
  tweetId?: string
  /** Spotify: tipo de recurso */
  spotifyKind?: 'track' | 'album' | 'playlist' | 'episode' | 'show'
  /** Spotify: id del recurso */
  spotifyId?: string
}

/** http(s) seguido de cualquier cosa que no sea espacio o cierre de markup. */
const URL_REGEX = /https?:\/\/[^\s<>"'`]+/g
/** Puntuación/cierre que suele pegarse al final de un enlace en texto plano. */
const TRAILING = /[.,;:!?)\]}>'"]+$/

/** Extrae y normaliza las URLs de un texto (sin duplicados, sin basura final). */
export function extractUrls(text: string): string[] {
  if (typeof text !== 'string' || !text) return []
  const out: string[] = []
  for (const raw of text.match(URL_REGEX) ?? []) {
    const url = raw.replace(TRAILING, '')
    if (url.length > 'https://x.io'.length && !out.includes(url)) out.push(url)
  }
  return out
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

function youtubeId(url: string): string | null {
  const patterns = [
    /youtube\.com\/watch\?(?:.*&)?v=([\w-]{11})/,
    /youtu\.be\/([\w-]{11})/,
    /youtube\.com\/embed\/([\w-]{11})/,
    /youtube\.com\/shorts\/([\w-]{11})/,
    /youtube\.com\/live\/([\w-]{11})/,
    /youtube-nocookie\.com\/embed\/([\w-]{11})/,
  ]
  for (const p of patterns) {
    const m = url.match(p)
    if (m) return m[1]
  }
  return null
}

function tiktokId(url: string): string | null {
  const patterns = [
    /tiktok\.com\/@[\w.-]+\/video\/(\d+)/,
    /tiktok\.com\/v\/(\d+)/,
    /tiktok\.com\/embed\/v2\/(\d+)/,
    /tiktok\.com\/embed\/(\d+)/,
  ]
  for (const p of patterns) {
    const m = url.match(p)
    if (m) return m[1]
  }
  // Enlaces cortos (vm.tiktok.com/XXXX): sin id resoluble en cliente → link preview
  return null
}

function tweetId(url: string): string | null {
  const m = url.match(/(?:twitter\.com|x\.com|mobile\.twitter\.com|mobile\.x\.com)\/[\w.-]+\/status\/(\d+)/)
  return m ? m[1] : null
}

function spotifyResource(url: string): { kind: string; id: string } | null {
  const m = url.match(/open\.spotify\.com\/(track|album|playlist|episode|show)\/([\w]+)/)
  return m ? { kind: m[1], id: m[2] } : null
}

/** URL de incrustación nativa de cada plataforma. */
export function embedUrlFor(embed: MediaEmbed): string | null {
  switch (embed.platform) {
    case 'youtube':
      return `https://www.youtube.com/embed/${embed.videoId}?rel=0`
    case 'tiktok':
      return `https://www.tiktok.com/player/v1/${embed.tiktokId}`
    case 'twitter':
      // theme=dark → el tweet se integra con la interfaz oscura de CodeBuds
      return `https://platform.twitter.com/embed/Tweet.html?id=${embed.tweetId}&theme=dark&dnt=true`
    case 'spotify':
      return `https://open.spotify.com/embed/${embed.spotifyKind}/${embed.spotifyId}?theme=0`
    default:
      return null
  }
}

/** Clasifica una única URL. Devuelve siempre un embed (`platform:'link'` si no es multimedia). */
export function classifyUrl(url: string): MediaEmbed {
  const hostname = hostnameOf(url)
  const base: MediaEmbed = { platform: 'link', url, hostname }

  const yt = youtubeId(url)
  if (yt) return { ...base, platform: 'youtube', videoId: yt }

  const tt = tiktokId(url)
  if (tt) return { ...base, platform: 'tiktok', tiktokId: tt }

  const tw = tweetId(url)
  if (tw) return { ...base, platform: 'twitter', tweetId: tw }

  const sp = spotifyResource(url)
  if (sp) return { ...base, platform: 'spotify', spotifyKind: sp.kind as MediaEmbed['spotifyKind'], spotifyId: sp.id }

  return base
}

/**
 * Detecta los embeds de un texto (posts y chats).
 * `limit` por defecto 2: un reproductor + un link preview no deben comerse
 * la pantalla ni en el feed ni dentro de una burbuja de chat.
 */
export function detectEmbeds(text: string, limit = 2): MediaEmbed[] {
  const embeds: MediaEmbed[] = []
  const seen = new Set<string>()
  for (const url of extractUrls(text)) {
    const embed = classifyUrl(url)
    if (seen.has(embed.url)) continue
    seen.add(embed.url)
    // Un enlace genérico sólo merece tarjeta si no hay otro embed en su sitio
    if (embed.platform === 'link' && embeds.some((e) => e.platform !== 'link')) continue
    embeds.push(embed)
    if (embeds.length >= limit) break
  }
  return embeds
}

/** ¿Es una plataforma con reproductor propio (no un enlace genérico)? */
export function isPlatformEmbed(embed: MediaEmbed): boolean {
  return embed.platform !== 'link'
}
