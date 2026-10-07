import { Plus, Music } from 'lucide-react'
import { getAvatarUrl } from '../lib/utils'
import { clampNoteText, type VoiceNote } from '../lib/notes'

export interface NoteContact {
  id: string
  username: string
  fullName: string
  avatarUrl: string | null
}

interface NotesCarouselProps {
  me: { username: string; fullName: string; avatarUrl: string | null }
  contacts: NoteContact[]
  /** Notas reales del backend, indexadas por user_id. */
  notesByUser: Record<string, VoiceNote>
  myNote: VoiceNote | null
  onEditNote: () => void
  /** Abre el sheet de reproducción: null = mi nota, contacto = su nota. */
  onOpenNote: (target: NoteContact | null) => void
}

/** Dark translucent dialogue bubble floating above an avatar. */
function NoteBubble({
  text,
  trackLabel,
  onClick,
}: {
  text: string
  trackLabel?: string
  onClick?: () => void
}) {
  const clamped = clampNoteText(text)
  const Wrapper = onClick ? 'button' : 'div'

  return (
    <Wrapper
      onClick={onClick}
      className={`group/bubble absolute bottom-full left-1/2 z-20 mx-auto mb-1 flex w-[85px] max-w-[85px] -translate-x-1/2 flex-col items-center justify-center rounded-2xl border border-slate-800 bg-black/70 px-2 py-1.5 text-center shadow-[0_8px_24px_rgba(0,0,0,0.45)] backdrop-blur-md transition-all duration-200 hover:border-purple-500/70 hover:shadow-[0_0_16px_rgba(168,85,247,0.25)] ${
        onClick ? 'cursor-pointer' : ''
      }`}
      title={trackLabel ? `${clamped} · ${trackLabel}` : clamped}
    >
      <p className="w-full line-clamp-2 break-words text-[11px] font-medium leading-snug text-white">
        {clamped}
      </p>
      {trackLabel && (
        <span className="mt-1 flex w-full items-center justify-center gap-1 rounded-md bg-purple-500/20 px-1 py-[3px] text-[9px] leading-none text-purple-200">
          <span className="shrink-0">🎵</span>
          <span className="truncate">{trackLabel}</span>
        </span>
      )}
      {/* patita centrada apuntando hacia el avatar */}
      <span className="absolute -bottom-[3px] left-1/2 h-2.5 w-2.5 -translate-x-1/2 rotate-45 border-b border-r border-slate-800 bg-black/70 transition-colors group-hover/bubble:border-purple-500/70" />
    </Wrapper>
  )
}

function trackLabelOf(track?: { name: string; artist: string } | null): string | undefined {
  if (!track) return undefined
  return `${track.name} - ${track.artist}`
}

export function NotesCarousel({ me, contacts, notesByUser, myNote, onEditNote, onOpenNote }: NotesCarouselProps) {
  // Defensa en runtime: si la carga inicial de /api/notes o de los chats falla,
  // los datos llegan undefined/null. Un array/objeto malformado no debe tumbar
  // el Error Boundary de Messages (pantalla "No se pudieron cargar los mensajes").
  const safeContacts: NoteContact[] = Array.isArray(contacts) ? contacts.filter((c) => c && c.id) : []
  const safeNotes: Record<string, VoiceNote> =
    notesByUser && typeof notesByUser === 'object' ? notesByUser : {}

  return (
    <div
      className="flex gap-4 overscroll-x-contain overflow-x-auto border-b border-slate-800 px-4 pb-3 pt-20 scrollbar-hidden"
      role="list"
      aria-label="Notas de voz y música"
    >
      {/* ── Current user: add / edit your note ── */}
      <div className="relative flex w-[72px] shrink-0 flex-col items-center" role="listitem">
        {myNote && (
          <NoteBubble
            text={myNote.text ?? ''}
            trackLabel={trackLabelOf(myNote.track)}
            onClick={() => onOpenNote(null)}
          />
        )}
        <button
          onClick={onEditNote}
          className="group relative outline-none"
          title={myNote ? 'Edita tu nota' : 'Agrega tu nota'}
          aria-label={myNote ? 'Editar tu nota' : 'Agregar tu nota'}
        >
          <img
            src={getAvatarUrl(me.avatarUrl, me.username)}
            alt={me.fullName}
            className="h-14 w-14 shrink-0 rounded-full object-cover ring-2 ring-purple-500/50 transition-all duration-200 group-hover:ring-purple-500 group-hover:shadow-[0_0_16px_rgba(168,85,247,0.45)]"
          />
          <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border-[2.5px] border-bg-primary bg-purple-500 text-white shadow-[0_0_10px_rgba(168,85,247,0.6)] transition-colors group-hover:bg-purple-400">
            <Plus className="h-3 w-3" strokeWidth={3} />
          </span>
        </button>
        <span className="mt-1.5 w-full truncate text-center text-[10px] font-semibold text-purple-300">
          Tu nota
        </span>
      </div>

      {/* ── Contacts ── */}
      {safeContacts.map((contact) => {
        const note = safeNotes[contact.id] ?? null
        const firstName = (contact.fullName || contact.username || '').trim().split(' ')[0]

        return (
          <div
            key={contact.id}
            className="group relative flex w-[72px] shrink-0 flex-col items-center"
            role="listitem"
          >
            {note && (
              <NoteBubble
                text={note.text ?? ''}
                trackLabel={trackLabelOf(note.track)}
                onClick={() => onOpenNote(contact)}
              />
            )}
            <div className="relative">
              <img
                src={getAvatarUrl(contact.avatarUrl, contact.username)}
                alt={contact.fullName}
                className="h-14 w-14 shrink-0 rounded-full object-cover ring-2 ring-slate-700/70 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:ring-purple-500 group-hover:shadow-[0_0_16px_rgba(168,85,247,0.4)]"
              />
              {note && (
                <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-bg-primary bg-black/80 text-[9px] text-purple-300 backdrop-blur-sm">
                  <Music className="h-2.5 w-2.5" />
                </span>
              )}
            </div>
            <span className="mt-1.5 w-full truncate text-center text-[10px] text-text-muted transition-colors group-hover:text-text-primary">
              {firstName}
            </span>
          </div>
        )
      })}
    </div>
  )
}
