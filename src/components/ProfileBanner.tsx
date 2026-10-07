import type { ReactNode } from 'react'
import { isVideoBanner } from '../lib/utils'

/**
 * Banner media only:
 *  - .mp4 / .webm  → <video autoPlay loop muted playsInline>
 *  - anything else (.jpg .png .webp .gif …) → <img>
 * Both fill their container with `object-cover`.
 */
export function BannerMedia({ url }: { url: string }) {
  return isVideoBanner(url) ? (
    <video autoPlay loop muted playsInline className="w-full h-full object-cover" src={url} />
  ) : (
    <img src={url} alt="" className="w-full h-full object-cover" />
  )
}

/**
 * Profile header banner: fixed container + media + contrast gradient so the
 * avatar, name and action buttons on top of it always stay readable.
 * Falls back to the default cyberpunk grid when no banner is set.
 */
export function ProfileBanner({ url, children }: { url?: string | null; children?: ReactNode }) {
  return (
    <div className="h-44 sm:h-52 w-full relative overflow-hidden rounded-t-2xl">
      {url ? (
        <BannerMedia url={url} />
      ) : (
        <div className="banner-grid w-full h-full" />
      )}

      {/* Contrast layer: keeps avatar / name / buttons readable */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/20 to-[#0e0e11]" />

      {children}
    </div>
  )
}
