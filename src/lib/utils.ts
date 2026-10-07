/**
 * Returns a valid avatar URL for a user.
 * Falls back to DiceBear Bottts Neutral if no avatar_url is provided.
 */
export function getAvatarUrl(
  avatarUrl?: string | null,
  username?: string | null,
): string {
  return (
    avatarUrl ||
    `https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${username || 'user'}`
  )
}

/**
 * Converts a 2-letter ISO-3166 alpha-2 country code to a flag emoji.
 * e.g. 'PE' → '🇵🇪', 'US' → '🇺🇸'
 * Returns empty string if code is invalid.
 */
export function getFlagEmoji(countryCode?: string | null): string {
  if (!countryCode || countryCode.length !== 2) return ''
  const code = countryCode.toUpperCase()
  if (!/^[A-Z]{2}$/.test(code)) return ''
  const OFFSET = 127397 // 0x1F1A5
  const first = code.charCodeAt(0) + OFFSET
  const second = code.charCodeAt(1) + OFFSET
  return String.fromCodePoint(first, second)
}

/**
 * True when a banner URL points at an animated video file (.mp4 / .webm).
 * Query strings and hashes (signed CDN URLs) are ignored, so
 * `https://cdn/x/cover.mp4?sig=abc` still counts as video.
 * `.gif` is intentionally NOT a video: browsers animate GIFs natively.
 */
export function isVideoBanner(url?: string | null): boolean {
  if (!url) return false
  // Uploaded files are stored as data URLs — the mime tells us the type.
  if (url.startsWith('data:')) return url.startsWith('data:video/')
  const clean = url.split(/[?#]/)[0].toLowerCase()
  return clean.endsWith('.mp4') || clean.endsWith('.webm')
}

/**
 * Formats a display string from location fields.
 * e.g. '🇵🇪 Lima, Peru' or '🇵🇪 Peru' or ''
 */
export function formatLocation(country?: string | null, countryCode?: string | null, city?: string | null): string {
  const flag = getFlagEmoji(countryCode)
  const parts: string[] = []
  if (city) parts.push(city)
  if (country) parts.push(country)
  if (parts.length === 0) return ''
  const loc = parts.join(', ')
  return flag ? `${flag} ${loc}` : loc
}
