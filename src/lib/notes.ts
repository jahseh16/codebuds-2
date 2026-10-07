/**
 * Notes / Voice-Music data layer.
 *
 * - Contact notes live in the backend (`GET /api/notes`).
 * - My note is cached in localStorage for instant paint and synced to the
 *   backend (POST /api/notes) on save.
 * - Saved songs (♥) stay in localStorage.
 * - iTunes Search API is consumed directly from the browser
 *   (it responds with `Access-Control-Allow-Origin: *`).
 */

export interface NoteTrack {
  id: string
  name: string
  artist: string
  artwork: string
  previewUrl?: string | null
  genre?: string
}

export interface VoiceNote {
  text: string
  track: NoteTrack | null
  updatedAt: number
}

export const NOTE_MAX_LEN = 60
export const PREVIEW_SECONDS = 30

// ─── Audio global (evita que se pisen los sonidos) ───
let activeAudio: HTMLAudioElement | null = null

/** Pausa y rebobina el audio activo. Si se pasa `el`, solo actúa si es el activo. */
export function stopNoteAudio(el?: HTMLAudioElement): void {
  if (!activeAudio || (el && activeAudio !== el)) return
  activeAudio.pause()
  try {
    activeAudio.currentTime = 0
  } catch {
    // elemento ya destruido
  }
  activeAudio = null
}

/** Registra un audio como activo y detiene el anterior (cambio de nota). */
export function setActiveNoteAudio(el: HTMLAudioElement): void {
  if (activeAudio && activeAudio !== el) stopNoteAudio()
  activeAudio = el
}

/** URL del preview de 30 s de iTunes (`previewUrl` o `audioUrl`). */
export function notePreviewUrl(
  track?: { previewUrl?: string | null; audioUrl?: string | null } | null
): string | null {
  if (!track) return null
  const url = track.previewUrl ?? track.audioUrl ?? null
  return typeof url === 'string' && url.length > 0 ? url : null
}

// ─── localStorage keys ──────────────────────────────────
const MY_NOTE_KEY = 'codebuds_my_note'
const SAVED_TRACKS_KEY = 'codebuds_saved_tracks'

/**
 * Cleans a note: collapses whitespace, trims and caps at 60 chars.
 * Used when PERSISTING/LOADING — while typing, the modal only strips
 * line breaks so a space you just typed is never eaten mid-sentence.
 */
export function clampNoteText(value: string): string {
  // Tolerante a payloads corruptos (localStorage o /api/notes con text ausente):
  // una nota sin texto no debe romper el carrusel de Messages.
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, NOTE_MAX_LEN)
}

// ─── My note ────────────────────────────────────────────

export function loadMyNote(): VoiceNote | null {
  try {
    const raw = localStorage.getItem(MY_NOTE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as VoiceNote
    if (!parsed || typeof parsed.text !== 'string') return null
    return {
      text: clampNoteText(parsed.text),
      track: parsed.track ?? null,
      updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : Date.now(),
    }
  } catch {
    return null
  }
}

export function saveMyNote(note: { text: string; track: NoteTrack | null }): VoiceNote {
  const payload: VoiceNote = {
    text: clampNoteText(note.text),
    track: note.track,
    updatedAt: Date.now(),
  }
  try {
    localStorage.setItem(MY_NOTE_KEY, JSON.stringify(payload))
  } catch {
    // storage full / private mode — note still lives in memory this session
  }
  return payload
}

export function clearMyNote(): void {
  try {
    localStorage.removeItem(MY_NOTE_KEY)
  } catch {
    // ignore
  }
}

// ─── Saved songs (♥) ────────────────────────────────────

export function loadSavedTracks(): NoteTrack[] {
  try {
    const raw = localStorage.getItem(SAVED_TRACKS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as NoteTrack[]
    return Array.isArray(parsed) ? parsed.filter((t) => t && typeof t.id === 'string') : []
  } catch {
    return []
  }
}

/** Adds the track if missing, removes it otherwise. Returns the new list. */
export function toggleSavedTrack(track: NoteTrack): NoteTrack[] {
  const current = loadSavedTracks()
  const exists = current.some((t) => t.id === track.id)
  const next = exists ? current.filter((t) => t.id !== track.id) : [track, ...current]
  try {
    localStorage.setItem(SAVED_TRACKS_KEY, JSON.stringify(next.slice(0, 100)))
  } catch {
    // ignore
  }
  return next
}

// ─── iTunes Search API ──────────────────────────────────

const ITUNES_URL = 'https://itunes.apple.com/search'

interface ITunesResult {
  trackId?: number
  trackName?: string
  artistName?: string
  artworkUrl100?: string
  previewUrl?: string
  primaryGenreName?: string
  kind?: string
}

function toTrack(r: ITunesResult): NoteTrack | null {
  if (!r.trackId || !r.trackName) return null
  return {
    id: String(r.trackId),
    name: r.trackName,
    artist: r.artistName || 'Unknown artist',
    // Upgrade artwork to a bigger size when possible
    artwork: (r.artworkUrl100 || '').replace('100x100', '200x200'),
    previewUrl: r.previewUrl || null,
    genre: r.primaryGenreName,
  }
}

async function itunesFetch(params: Record<string, string>): Promise<NoteTrack[]> {
  const qs = new URLSearchParams({ media: 'music', ...params }).toString()
  const res = await fetch(`${ITUNES_URL}?${qs}`)
  if (!res.ok) throw new Error(`iTunes API error ${res.status}`)
  const data = (await res.json()) as { results?: ITunesResult[] }
  return (data.results || [])
    .filter((r) => r.kind === 'song' || !r.kind)
    .map(toTrack)
    .filter((t): t is NoteTrack => t !== null)
}

/** Free-text search (debounced by the caller). */
export async function searchTracks(term: string, limit = 25): Promise<NoteTrack[]> {
  return itunesFetch({ term, limit: String(limit) })
}

/** "For you": hits from a given genre (Funk, Rock, Lo-Fi, Metal…). */
export async function fetchGenreTracks(genre: string, limit = 25): Promise<NoteTrack[]> {
  return itunesFetch({ term: genre, limit: String(limit), attribute: 'genreTerm' })
}
