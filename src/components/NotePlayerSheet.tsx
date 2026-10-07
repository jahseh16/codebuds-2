import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { Music, Play, Pause, Plus, Trash2, Send, X } from 'lucide-react'
import { getAvatarUrl } from '../lib/utils'
import { displayUsername } from '../lib/username'
import {
  PREVIEW_SECONDS,
  notePreviewUrl,
  setActiveNoteAudio,
  stopNoteAudio,
  type VoiceNote,
} from '../lib/notes'

export interface NoteSheetUser {
  username: string
  fullName: string
  avatarUrl: string | null
}

interface NotePlayerSheetProps {
  open: boolean
  user: NoteSheetUser | null
  note: VoiceNote | null
  /** true = es mi propia nota (mostrar editar/eliminar). */
  isMine: boolean
  onClose: () => void
  onEdit: () => void
  onDelete: () => void
  onReply: () => void
}

function fmtTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/* ═══════════════════════════════════════════════════════════
   Sheet de reproducción de notas (estilo Instagram)
   · PC: modal centrado · Móvil: bottom sheet desde abajo
   · Autoplay del preview de 30 s con audio global (sin pisarse)
   ═══════════════════════════════════════════════════════════ */
export function NotePlayerSheet({
  open,
  user,
  note,
  isMine,
  onClose,
  onEdit,
  onDelete,
  onReply,
}: NotePlayerSheetProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(PREVIEW_SECONDS)
  const [failed, setFailed] = useState(false)

  const previewUrl = notePreviewUrl(note?.track ?? null)

  // Audio: al abrir o cambiar de nota, paramos el anterior y reproducimos el nuevo
  useEffect(() => {
    if (!open) return
    if (!previewUrl) {
      // Sin preview: igual cortamos cualquier otro audio en reproducción
      stopNoteAudio()
      setPlaying(false)
      return
    }

    const audio = new Audio()
    audio.preload = 'auto'
    audio.src = previewUrl

    const onTime = () => {
      const d =
        Number.isFinite(audio.duration) && audio.duration > 0
          ? audio.duration
          : PREVIEW_SECONDS
      setDuration(d)
      setCurrent(audio.currentTime)
    }
    const onEnded = () => {
      if (audioRef.current !== audio) return
      setPlaying(false)
      setCurrent(0)
    }
    const onError = () => {
      if (audioRef.current !== audio) return
      setPlaying(false)
      setFailed(true)
    }

    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('loadedmetadata', onTime)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('error', onError)

    audioRef.current = audio
    setCurrent(0)
    setDuration(PREVIEW_SECONDS)
    setFailed(false)

    // Detiene el audio anterior (global) e inicia este
    setActiveNoteAudio(audio)
    audio.play().then(
      () => {
        if (audioRef.current === audio) setPlaying(true)
      },
      () => {
        // Autoplay bloqueado por el navegador: el usuario puede tocar ▶
        if (audioRef.current === audio) setPlaying(false)
      }
    )

    return () => {
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('loadedmetadata', onTime)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('error', onError)
      audio.pause()
      stopNoteAudio(audio)
      if (audioRef.current === audio) audioRef.current = null
    }
  }, [open, previewUrl])

  // Cerrar con Escape
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Bloquear scroll del fondo mientras el sheet está abierto
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  const togglePlay = () => {
    const audio = audioRef.current
    if (!audio || failed) return
    if (audio.paused) {
      setActiveNoteAudio(audio)
      audio.play().then(
        () => {
          if (audioRef.current === audio) setPlaying(true)
        },
        () => {
          if (audioRef.current === audio) setPlaying(false)
        }
      )
    } else {
      audio.pause()
      setPlaying(false)
    }
  }

  const seek = (e: MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current
    if (!audio) return
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
    const d =
      Number.isFinite(audio.duration) && audio.duration > 0
        ? audio.duration
        : PREVIEW_SECONDS
    audio.currentTime = ratio * d
    setCurrent(audio.currentTime)
  }

  if (!open || !user) return null

  const track = note?.track ?? null
  const pct =
    duration > 0 ? Math.min(100, (current / duration) * 100) : 0

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Reproducir nota"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Sheet: bottom-sheet en móvil · modal centrado en PC */}
      <div className="safe-area-bottom relative flex max-h-[92dvh] w-full max-w-md flex-col overflow-y-auto rounded-t-3xl border border-border-light bg-bg-card px-5 pb-6 pt-3 shadow-[0_-16px_48px_rgba(0,0,0,0.5)] animate-sheet-up sm:max-h-[85dvh] sm:rounded-3xl sm:animate-scale-in sm:shadow-[0_24px_80px_rgba(0,0,0,0.5)]">
        {/* Handle (solo móvil) */}
        <div className="mx-auto mb-2 h-1 w-10 shrink-0 rounded-full bg-white/15 sm:hidden" />

        {/* Cerrar */}
        <button
          onClick={onClose}
          type="button"
          aria-label="Cerrar"
          className="absolute right-3 top-3 z-10 rounded-full p-2 text-text-muted transition-colors hover:bg-white/10 hover:text-text-primary"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Avatar centrado arriba */}
        <div className="flex flex-col items-center pt-2 text-center">
          <img
            src={getAvatarUrl(user.avatarUrl, user.username)}
            alt={user.fullName}
            className="h-20 w-20 shrink-0 rounded-full object-cover ring-2 ring-purple-500/60 shadow-[0_0_32px_rgba(168,85,247,0.35)]"
          />
          <p className="mt-3 w-full break-words px-8 text-sm font-bold text-text-primary">
            {user.fullName}
          </p>
          <p className="text-xs text-text-muted">
            @{displayUsername(user.username)}
          </p>
        </div>

        {/* Título de la canción + artista + icono musical */}
        {track ? (
          <div className="mt-4 flex items-center gap-3 rounded-2xl border border-slate-800 bg-black/40 px-3 py-3">
            {track.artwork ? (
              <img
                src={track.artwork}
                alt=""
                className="h-12 w-12 shrink-0 rounded-xl object-cover ring-1 ring-purple-500/40"
              />
            ) : (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-purple-500/15">
                <Music className="h-5 w-5 text-purple-300" />
              </div>
            )}
            <div className="min-w-0 flex-1 text-left">
              <div className="flex items-start gap-1.5">
                <Music className="mt-0.5 h-3.5 w-3.5 shrink-0 text-purple-300" />
                <p className="min-w-0 break-words text-sm font-semibold leading-snug text-text-primary">
                  {track.name}
                </p>
              </div>
              <p className="truncate text-xs text-text-muted">{track.artist}</p>
            </div>
            <button
              onClick={togglePlay}
              type="button"
              disabled={!previewUrl || failed}
              aria-label={playing ? 'Pausar audio' : 'Reproducir audio'}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-purple-500 text-white shadow-[0_0_18px_rgba(168,85,247,0.5)] transition-all hover:bg-purple-400 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
            >
              {playing ? (
                <Pause className="h-5 w-5" />
              ) : (
                <Play className="h-5 w-5 translate-x-[1px]" />
              )}
            </button>
          </div>
        ) : (
          <div className="mt-4 flex items-center justify-center gap-2 rounded-2xl border border-slate-800 bg-black/30 px-4 py-3 text-xs text-text-muted">
            <Music className="h-4 w-4 shrink-0" />
            Nota sin canción
          </div>
        )}

        {/* Progreso (30 s) */}
        {previewUrl && (
          <div className="mt-3 px-1">
            <div
              onClick={seek}
              role="button"
              tabIndex={0}
              aria-label="Progreso del audio"
              className="relative h-1.5 w-full cursor-pointer overflow-hidden rounded-full bg-white/10"
            >
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-purple-500 to-violet-400 transition-[width] duration-150"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="mt-1 flex justify-between px-0.5 text-[10px] tabular-nums text-text-muted">
              <span>{fmtTime(current)}</span>
              <span>{fmtTime(duration)}</span>
            </div>
          </div>
        )}

        {failed && (
          <p className="mt-2 text-center text-xs text-red-400">
            No se pudo reproducir el audio. Toca ▶ para reintentar.
          </p>
        )}

        {/* Texto de la nota (sin recortes) */}
        {note ? (
          <div className="mt-4 rounded-2xl bg-bg-input px-4 py-3">
            <p className="text-center text-[10px] font-semibold uppercase tracking-widest text-text-muted">
              {isMine ? 'Tu nota' : 'Su nota'}
            </p>
            <p className="mt-1.5 break-words whitespace-pre-wrap text-center text-sm leading-relaxed text-text-primary">
              {note.text}
            </p>
          </div>
        ) : (
          <p className="mt-4 text-center text-xs text-text-muted">
            Esta nota ya no está disponible.
          </p>
        )}

        {/* Acciones */}
        <div className="mt-5 space-y-2.5 pb-1">
          {isMine ? (
            <>
              <button
                onClick={onEdit}
                type="button"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white shadow-[0_0_20px_rgba(124,58,237,0.45)] ring-1 ring-violet-400/40 transition-all hover:bg-accent-hover hover:shadow-[0_0_28px_rgba(124,58,237,0.65)] active:scale-[0.98]"
              >
                <Plus className="h-4 w-4" strokeWidth={3} />
                Dejar una nota nueva
              </button>
              <button
                onClick={onDelete}
                type="button"
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-400 transition-all hover:bg-red-500/20 active:scale-[0.98]"
              >
                <Trash2 className="h-4 w-4" />
                Eliminar nota
              </button>
            </>
          ) : (
            <button
              onClick={onReply}
              type="button"
              className="flex w-full flex-col items-center gap-0.5 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white shadow-[0_0_20px_rgba(124,58,237,0.45)] ring-1 ring-violet-400/40 transition-all hover:bg-accent-hover hover:shadow-[0_0_28px_rgba(124,58,237,0.65)] active:scale-[0.98]"
            >
              <span className="flex items-center gap-2">
                <Send className="h-4 w-4" />
                Responder a esta nota
              </span>
              <span className="text-[10px] font-normal text-white/70">
                Abre el chat y envía un mensaje sobre esta nota
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
