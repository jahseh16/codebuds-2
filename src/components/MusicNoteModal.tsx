import { useCallback, useEffect, useRef, useState } from 'react'
import {
  X,
  Search,
  Play,
  Pause,
  Heart,
  Loader2,
  Music,
  Sparkles,
  PenLine,
} from 'lucide-react'
import { SafeModal } from './SafeModal'
import {
  clampNoteText,
  fetchGenreTracks,
  loadSavedTracks,
  searchTracks,
  toggleSavedTrack,
  setActiveNoteAudio,
  stopNoteAudio,
  NOTE_MAX_LEN,
  PREVIEW_SECONDS,
  type NoteTrack,
  type VoiceNote,
} from '../lib/notes'

interface MusicNoteModalProps {
  open: boolean
  onClose: () => void
  initialNote: VoiceNote | null
  onSave: (note: { text: string; track: NoteTrack | null }) => void
  onRemove: () => void
}

type Tab = 'forYou' | 'search' | 'saved'

const TABS: { id: Tab; label: string }[] = [
  { id: 'forYou', label: 'Para ti' },
  { id: 'search', label: 'Buscar' },
  { id: 'saved', label: 'Guardadas' },
]

const GENRES = ['Funk', 'Rock', 'Lo-Fi', 'Metal', 'Synthwave', 'Hip-Hop', 'Electronic', 'Jazz']

function pickRandomGenre(): string {
  return GENRES[Math.floor(Math.random() * GENRES.length)]
}

function fmtTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  return `0:${String(s).padStart(2, '0')}`
}

/* ═══════════════════════════════════════════════════════════
   Track row — artwork, title, 30s preview, favorite ♥
   ═══════════════════════════════════════════════════════════ */
function TrackRow({
  track,
  selected,
  playing,
  progress,
  saved,
  onSelect,
  onTogglePlay,
  onToggleSave,
}: {
  track: NoteTrack
  selected: boolean
  playing: boolean
  progress: number
  saved: boolean
  onSelect: () => void
  onTogglePlay: () => void
  onToggleSave: () => void
}) {
  const canPreview = Boolean(track.previewUrl)

  return (
    <div
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect()
        }
      }}
      className={`group flex w-full cursor-pointer items-center gap-3 rounded-xl border px-2.5 py-2 transition-all duration-200 hover:border-purple-500 hover:bg-purple-500/5 ${
        selected
          ? 'border-purple-500 bg-purple-500/10 shadow-[0_0_16px_rgba(168,85,247,0.18)]'
          : 'border-slate-800 bg-black/20'
      }`}
    >
      {/* Artwork */}
      {track.artwork ? (
        <img
          src={track.artwork}
          alt=""
          loading="lazy"
          className={`h-11 w-11 shrink-0 rounded-lg object-cover transition-all ${
            selected ? 'ring-2 ring-purple-500' : 'ring-1 ring-slate-800'
          }`}
        />
      ) : (
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-purple-500/10 ring-1 ring-slate-800">
          <Music className="h-4 w-4 text-purple-400" />
        </div>
      )}

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p
          className={`truncate text-xs font-semibold ${selected ? 'text-purple-200' : 'text-text-primary'}`}
        >
          {track.name}
        </p>
        <p className="truncate text-[10px] text-text-muted">
          {track.artist}
          {track.genre ? ` · ${track.genre}` : ''}
        </p>

        {/* 30s preview progress */}
        {playing && (
          <div className="mt-1 flex items-center gap-1.5">
            <div className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-purple-400 shadow-[0_0_6px_rgba(192,132,252,0.9)]"
                style={{ width: `${Math.min(progress * 100, 100)}%` }}
              />
            </div>
            <span className="shrink-0 text-[8px] tabular-nums text-purple-300">
              {fmtTime(progress * PREVIEW_SECONDS)}/{fmtTime(PREVIEW_SECONDS)}
            </span>
          </div>
        )}
      </div>

      {/* Favorite ♥ */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onToggleSave()
        }}
        title={saved ? 'Quitar de Guardadas' : 'Guardar en Guardadas'}
        aria-label={saved ? 'Quitar de guardadas' : 'Guardar en guardadas'}
        className={`shrink-0 rounded-lg p-1.5 transition-all hover:bg-purple-500/15 ${
          saved ? 'text-pink-400' : 'text-text-muted hover:text-pink-400'
        }`}
      >
        <Heart className={`h-4 w-4 ${saved ? 'fill-current' : ''}`} />
      </button>

      {/* Preview play/pause */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          if (canPreview) onTogglePlay()
        }}
        disabled={!canPreview}
        title={canPreview ? 'Preview 30s' : 'Sin preview disponible'}
        aria-label={canPreview ? 'Reproducir preview' : 'Sin preview disponible'}
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-all ${
          playing
            ? 'border-purple-500 bg-purple-500 text-white shadow-[0_0_12px_rgba(168,85,247,0.5)]'
            : canPreview
              ? 'border-slate-700 bg-black/40 text-purple-300 hover:border-purple-500 hover:text-white'
              : 'cursor-not-allowed border-slate-800 bg-black/20 text-text-muted opacity-40'
        }`}
      >
        {playing ? (
          <Pause className="h-3.5 w-3.5 fill-current" />
        ) : (
          <Play className="h-3.5 w-3.5 fill-current" />
        )}
      </button>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   Modal
   ═══════════════════════════════════════════════════════════ */
export function MusicNoteModal({
  open,
  onClose,
  initialNote,
  onSave,
  onRemove,
}: MusicNoteModalProps) {
  const [tab, setTab] = useState<Tab>('forYou')
  const [text, setText] = useState('')
  const [selectedTrack, setSelectedTrack] = useState<NoteTrack | null>(null)

  // "Para ti"
  const [forYouGenre, setForYouGenre] = useState<string>(() => pickRandomGenre())
  const [forYouRetry, setForYouRetry] = useState(0)
  const [forYouTracks, setForYouTracks] = useState<NoteTrack[]>([])
  const [forYouLoading, setForYouLoading] = useState(false)
  const [forYouError, setForYouError] = useState<string | null>(null)

  // "Buscar"
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<NoteTrack[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)

  // "Guardadas"
  const [savedTracks, setSavedTracks] = useState<NoteTrack[]>([])

  // Preview player
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const stopPreview = useCallback(() => {
    const audio = audioRef.current
    if (audio) {
      audio.pause()
      audio.currentTime = 0
    }
    setPlayingId(null)
    setProgress(0)
  }, [])

  // Reset state + create the audio element while open
  useEffect(() => {
    if (!open) return

    setText(initialNote ? clampNoteText(initialNote.text) : '')
    setSelectedTrack(initialNote?.track ?? null)
    setTab('forYou')
    setSearchQuery('')
    setSearchResults([])
    setSearchError(null)
    setSavedTracks(loadSavedTracks())
    stopPreview()

    const audio = new Audio()
    audio.preload = 'none'
    const onTime = () => {
      const duration = Number.isFinite(audio.duration) && audio.duration > 0
        ? audio.duration
        : PREVIEW_SECONDS
      setProgress(audio.currentTime / duration)
    }
    const onEnded = () => {
      setPlayingId(null)
      setProgress(0)
    }
    const onError = () => {
      setPlayingId(null)
      setProgress(0)
    }
    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('error', onError)
    audioRef.current = audio
    // Audio global: si ya suena otra nota/preview, se detiene
    setActiveNoteAudio(audio)

    return () => {
      audio.pause()
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('error', onError)
      stopNoteAudio(audio)
      audioRef.current = null
      setPlayingId(null)
      setProgress(0)
    }
  }, [open, initialNote, stopPreview])

  // "Para ti" — fetch hits for the selected genre
  useEffect(() => {
    if (!open || tab !== 'forYou') return
    let cancelled = false
    setForYouLoading(true)
    setForYouError(null)
    fetchGenreTracks(forYouGenre, 25)
      .then((tracks) => {
        if (!cancelled) setForYouTracks(tracks)
      })
      .catch(() => {
        if (!cancelled) setForYouError('No se pudo cargar la música. Intenta de nuevo.')
      })
      .finally(() => {
        if (!cancelled) setForYouLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, tab, forYouGenre, forYouRetry])

  // "Buscar" — debounced iTunes query
  useEffect(() => {
    if (!open || tab !== 'search') return
    const query = searchQuery.trim()
    if (query.length < 2) {
      setSearchResults([])
      setSearchError(null)
      setSearchLoading(false)
      return
    }
    let cancelled = false
    const timer = setTimeout(() => {
      setSearchLoading(true)
      setSearchError(null)
      searchTracks(query, 25)
        .then((tracks) => {
          if (!cancelled) setSearchResults(tracks)
        })
        .catch(() => {
          if (!cancelled) setSearchError('No se pudo buscar. Revisa tu conexión.')
        })
        .finally(() => {
          if (!cancelled) setSearchLoading(false)
        })
    }, 350)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [open, tab, searchQuery])

  // Refresh saved list whenever the tab is shown
  useEffect(() => {
    if (open && tab === 'saved') setSavedTracks(loadSavedTracks())
  }, [open, tab])

  const togglePlay = useCallback(
    (track: NoteTrack) => {
      const audio = audioRef.current
      if (!audio || !track.previewUrl) return
      if (playingId === track.id) {
        stopPreview()
        return
      }
      audio.pause()
      audio.src = track.previewUrl
      audio.currentTime = 0
      setActiveNoteAudio(audio)
      setPlayingId(track.id)
      setProgress(0)
      audio.play().catch(() => {
        setPlayingId(null)
        setProgress(0)
      })
    },
    [playingId, stopPreview]
  )

  const handleToggleSave = useCallback((track: NoteTrack) => {
    setSavedTracks(toggleSavedTrack(track))
  }, [])

  const handleSelect = useCallback((track: NoteTrack) => {
    stopPreview()
    setSelectedTrack((prev) => (prev?.id === track.id ? null : track))
  }, [stopPreview])

  const canSave = text.trim().length > 0 || Boolean(selectedTrack)

  const renderRows = (tracks: NoteTrack[]) => (
    <div className="space-y-1.5">
      {tracks.map((track) => (
        <TrackRow
          key={track.id}
          track={track}
          selected={selectedTrack?.id === track.id}
          playing={playingId === track.id}
          progress={playingId === track.id ? progress : 0}
          saved={savedTracks.some((t) => t.id === track.id)}
          onSelect={() => handleSelect(track)}
          onTogglePlay={() => togglePlay(track)}
          onToggleSave={() => handleToggleSave(track)}
        />
      ))}
    </div>
  )

  const renderMessage = (msg: string) => (
    <p className="py-8 text-center text-xs text-text-muted">{msg}</p>
  )

  return (
    <SafeModal open={open} onClose={onClose} zIndex={90} maxWidth="max-w-md">
      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-bg-card/95 backdrop-blur-md">
        {/* ── Header ── */}
        <div className="flex items-center gap-3 border-b border-slate-800 bg-gradient-to-r from-purple-500/10 via-transparent to-transparent px-5 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/15 ring-1 ring-purple-500/40">
            <Music className="h-4 w-4 text-purple-400" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold text-text-primary">Tu nota</h3>
            <p className="truncate text-[10px] text-text-muted">
              Un mensaje corto + tu canción favorita
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-bg-card-hover hover:text-text-primary"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Status text (max 60 chars) ── */}
        <div className="px-5 pt-4">
          <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-bg-input px-3 py-2.5 transition-all focus-within:border-purple-500 focus-within:shadow-[0_0_14px_rgba(168,85,247,0.2)]">
            <PenLine className="h-3.5 w-3.5 shrink-0 text-purple-400" />
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value.replace(/[\r\n]+/g, ' ').slice(0, NOTE_MAX_LEN))}
              placeholder="¿Qué estás escuchando?"
              maxLength={NOTE_MAX_LEN}
              className="min-w-0 flex-1 bg-transparent text-xs text-text-primary placeholder:text-text-muted focus:outline-none"
            />
            <span
              className={`shrink-0 text-[9px] tabular-nums ${
                text.length >= NOTE_MAX_LEN ? 'text-amber-400' : 'text-text-muted'
              }`}
            >
              {text.length}/{NOTE_MAX_LEN}
            </span>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="mt-3 flex gap-1 border-b border-slate-800 px-5">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`relative px-3 py-2.5 text-xs font-semibold transition-colors ${
                tab === t.id
                  ? 'text-purple-300'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              {t.label}
              {tab === t.id && (
                <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.9)]" />
              )}
            </button>
          ))}
        </div>

        {/* ── Content ── */}
        <div className="h-[300px] overflow-y-auto px-5 py-3.5">
          {/* Para ti */}
          {tab === 'forYou' && (
            <>
              <div className="mb-3 flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-hidden">
                <Sparkles className="h-3 w-3 shrink-0 text-purple-400" />
                {GENRES.map((genre) => (
                  <button
                    key={genre}
                    onClick={() => setForYouGenre(genre)}
                    className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold transition-all duration-200 ${
                      forYouGenre === genre
                        ? 'border-purple-500 bg-purple-500/20 text-purple-200 shadow-[0_0_10px_rgba(168,85,247,0.3)]'
                        : 'border-slate-800 text-text-muted hover:border-purple-500/60 hover:text-text-primary'
                    }`}
                  >
                    {genre}
                  </button>
                ))}
              </div>
              {forYouLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-purple-400" />
                </div>
              ) : forYouError ? (
                <div className="py-8 text-center">
                  <p className="text-xs text-text-muted">{forYouError}</p>
                  <button
                    onClick={() => setForYouRetry((n) => n + 1)}
                    className="mt-3 rounded-lg border border-slate-800 px-3 py-1.5 text-[10px] font-semibold text-purple-300 transition-colors hover:border-purple-500"
                  >
                    Reintentar
                  </button>
                </div>
              ) : forYouTracks.length > 0 ? (
                renderRows(forYouTracks)
              ) : (
                renderMessage('Sin resultados para este género')
              )}
            </>
          )}

          {/* Buscar */}
          {tab === 'search' && (
            <>
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Busca un artista o tema..."
                  autoFocus
                  className="w-full rounded-xl border border-slate-800 bg-bg-input py-2.5 pl-9 pr-8 text-xs text-text-primary transition-all placeholder:text-text-muted focus:border-purple-500 focus:outline-none focus:shadow-[0_0_14px_rgba(168,85,247,0.2)]"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
                    aria-label="Limpiar búsqueda"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
                {searchLoading && (
                  <Loader2 className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-purple-400" />
                )}
              </div>
              {searchQuery.trim().length < 2 ? (
                renderMessage('Escribe al menos 2 caracteres para buscar')
              ) : searchError ? (
                renderMessage(searchError)
              ) : searchResults.length > 0 ? (
                renderRows(searchResults)
              ) : (
                renderMessage(searchLoading ? 'Buscando...' : 'Sin resultados')
              )}
            </>
          )}

          {/* Guardadas */}
          {tab === 'saved' &&
            (savedTracks.length > 0 ? (
              renderRows(savedTracks)
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-purple-500/10 ring-1 ring-purple-500/30">
                  <Heart className="h-5 w-5 text-purple-400" />
                </div>
                <p className="text-xs font-semibold text-text-primary">
                  Aún no guardas canciones
                </p>
                <p className="mt-1 max-w-[220px] text-[10px] text-text-muted">
                  Marca ♥ en cualquier canción para encontrarla aquí rápido.
                </p>
              </div>
            ))}
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center gap-2 border-t border-slate-800 bg-black/40 px-4 py-3 backdrop-blur-md">
          <div className="min-w-0 flex-1">
            {selectedTrack ? (
              <div className="flex min-w-0 items-center gap-1.5 rounded-lg border border-purple-500/40 bg-purple-500/10 px-2 py-1.5">
                <span className="shrink-0 text-xs">🎵</span>
                <span className="truncate text-[10px] font-medium text-purple-200">
                  {selectedTrack.name} - {selectedTrack.artist}
                </span>
                <button
                  onClick={() => setSelectedTrack(null)}
                  className="shrink-0 rounded p-0.5 text-purple-300 transition-colors hover:text-white"
                  aria-label="Quitar canción"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <p className="truncate text-[10px] text-text-muted">
                Selecciona una canción (opcional)
              </p>
            )}
          </div>

          {initialNote && (
            <button
              onClick={() => {
                stopPreview()
                onRemove()
              }}
              className="shrink-0 rounded-xl border border-slate-800 px-3 py-2 text-[11px] font-semibold text-text-muted transition-all hover:border-red-500/60 hover:text-red-400"
            >
              Eliminar
            </button>
          )}

          <button
            onClick={() => {
              if (!canSave) return
              stopPreview()
              onSave({ text: clampNoteText(text), track: selectedTrack })
            }}
            disabled={!canSave}
            className="shrink-0 rounded-xl bg-purple-500 px-4 py-2 text-[11px] font-bold text-white shadow-[0_0_14px_rgba(168,85,247,0.4)] transition-all hover:bg-purple-400 hover:shadow-[0_0_20px_rgba(168,85,247,0.6)] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
          >
            Guardar
          </button>
        </div>
      </div>
    </SafeModal>
  )
}
