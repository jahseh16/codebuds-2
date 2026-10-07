import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Send,
  ArrowLeft,
  MessageCircle,
  Loader2,
  Plus,
  Search,
  X,
  Smile,
  Paperclip,
  MoreVertical,
  Info,
  Reply,
  Trash2,
  Ban,
  Flag,
  Bell,
  BellOff,
  ArrowDown,
  Compass,
  User,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import {
  useChat,
  type Conversation,
  type ChatMessage,
} from '../contexts/ChatContext'
import {
  profiles as profilesApi,
  notes as notesApi,
  messages as messagesApi,
  conversations as conversationsApi,
  blocks as blocksApi,
  reports as reportsApi,
  users as usersApi,
} from '../lib/api'
import { normalizeMessage } from '../lib/chatMessages'
import { getAvatarUrl } from '../lib/utils'
import { displayUsername } from '../lib/username'
import { NotesCarousel, type NoteContact } from '../components/NotesCarousel'
import { ContentEmbeds } from '../components/LinkEmbed'
import { NotePlayerSheet } from '../components/NotePlayerSheet'
import { ChatInfoPanel, type ChatInfoTarget } from '../components/ChatInfoPanel'
import { MessageActionsSheet } from '../components/MessageActionsSheet'
import { MusicNoteModal } from '../components/MusicNoteModal'
import {
  clearMyNote,
  loadMyNote,
  saveMyNote,
  type NoteTrack,
  type VoiceNote,
} from '../lib/notes'
import type { Profile } from '../lib/types'

// ────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────

function timeAgo(dateStr?: string): string {
  if (!dateStr) return 'now'
  const parsed = new Date(dateStr)
  if (isNaN(parsed.getTime())) return 'now'
  const diff = Date.now() - parsed.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  return `${days}d`
}

function dayLabel(dateStr?: string): string {
  if (!dateStr) return 'Today'
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return 'Today'
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)

  if (date.toDateString() === today.toDateString()) return 'Today'
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(date.getFullYear() !== today.getFullYear() && { year: 'numeric' }),
  })
}

/** Mensajes del mismo autor con <5 min de diferencia se agrupan */
function sameGroup(a?: { sender_id: string; created_at: string }, b?: { sender_id: string; created_at: string }): boolean {
  if (!a || !b) return false
  if (a.sender_id !== b.sender_id) return false
  const aTime = new Date(a.created_at).getTime()
  const bTime = new Date(b.created_at).getTime()
  if (isNaN(aTime) || isNaN(bTime)) return false
  return Math.abs(bTime - aTime) < 5 * 60 * 1000
}

/** Type guard for valid chat messages used in render */
function isValidMessage(msg: unknown): msg is { id: string; conversation_id: string; sender_id: string; text: string; created_at: string; read: boolean } {
  if (!msg || typeof msg !== 'object') return false
  const m = msg as Record<string, unknown>
  return (
    typeof m.id === 'string' && m.id.length > 0 &&
    typeof m.sender_id === 'string' && m.sender_id.length > 0 &&
    typeof m.text === 'string' &&
    typeof m.created_at === 'string' && m.created_at.length > 0
  )
}

// ────────────────────────────────────────────────────────
// Day divider
// ────────────────────────────────────────────────────────

function DayDivider({ label }: { label: string }) {
  return (
    <div className="mt-5 mb-1.5 flex items-center gap-3">
      <div className="h-px flex-1 bg-border" />
      <span className="text-[10px] font-semibold uppercase tracking-widest text-text-secondary">
        {label}
      </span>
      <div className="h-px flex-1 bg-border" />
    </div>
  )
}

// ────────────────────────────────────────────────────────
// Message body with <mark> around search matches
// ────────────────────────────────────────────────────────

function HighlightedText({ text, query }: { text: string; query: string }) {
  const q = query.trim()
  if (!q) return <>{text}</>
  const lower = text.toLowerCase()
  const lowerQ = q.toLowerCase()
  if (!lower.includes(lowerQ)) return <>{text}</>

  const nodes: React.ReactNode[] = []
  let idx = 0
  let found = lower.indexOf(lowerQ, idx)
  while (found !== -1) {
    if (found > idx) nodes.push(text.slice(idx, found))
    nodes.push(
      <mark key={`hl-${found}-${idx}`} className="rounded bg-purple-500/40 px-0.5 text-white">
        {text.slice(found, found + q.length)}
      </mark>
    )
    idx = found + q.length
    found = lower.indexOf(lowerQ, idx)
  }
  if (idx < text.length) nodes.push(text.slice(idx))
  return <>{nodes}</>
}

// ────────────────────────────────────────────────────────
// Message bubble (grouping, receipts, reply, reactions, actions)
// ────────────────────────────────────────────────────────

function MessageBubble({
  msg,
  isMine,
  isFirst,
  isLast,
  avatarUrl,
  myId,
  otherLabel,
  highlightQuery,
  highlighted,
  copied,
  onReply,
  onReact,
  onRetry,
  onOpenMenu,
}: {
  msg: ChatMessage
  isMine: boolean
  isFirst: boolean
  isLast: boolean
  avatarUrl?: string
  myId: string
  otherLabel: string
  highlightQuery: string
  highlighted: boolean
  copied: boolean
  onReply: (m: ChatMessage) => void
  onReact: (m: ChatMessage, emoji: string) => void
  onRetry: (id: string) => void
  onOpenMenu: (m: ChatMessage) => void
}) {
  const radius = isMine
    ? `rounded-2xl ${!isFirst ? 'rounded-tr-md' : ''} ${!isLast ? 'rounded-br-md' : 'rounded-br-sm'}`
    : `rounded-2xl ${!isFirst ? 'rounded-tl-md' : ''} ${!isLast ? 'rounded-bl-md' : 'rounded-bl-sm'}`

  const failed = msg.status === 'failed'

  // Aggregate reactions → one chip per emoji (mine highlighted)
  const reactionChips = new Map<string, { count: number; mine: boolean }>()
  for (const r of msg.reactions ?? []) {
    const entry = reactionChips.get(r.emoji) ?? { count: 0, mine: false }
    entry.count += 1
    if (r.user_id === myId) entry.mine = true
    reactionChips.set(r.emoji, entry)
  }

  // Receipt (solo en el último mensaje del grupo).
  // Móvil: únicamente checks (✓ / ✓✓ / ✓✓ accent) — las etiquetas no caben
  // en burbujas pequeñas y se cortaban. Desktop: etiqueta completa.
  let receipt: { short: string; long: string; cls: string } | null = null
  if (isMine) {
    if (msg.status === 'sending') {
      receipt = { short: 'Sending…', long: 'Sending…', cls: 'text-text-secondary' }
    } else if (!failed) {
      if (msg.read) receipt = { short: '✓✓', long: 'Read ✓✓', cls: 'text-accent font-semibold' }
      else if (msg.delivered_at) receipt = { short: '✓✓', long: 'Delivered ✓✓', cls: 'text-text-secondary' }
      else receipt = { short: '✓', long: 'Sent ✓', cls: 'text-text-secondary' }
    }
  }

  // ── Gestos: long-press (menú) + swipe-to-reply (Pointer Events, sin librerías) ──
  const SWIPE_MAX = 56
  const SWIPE_THRESHOLD = 42
  const pressTimer = useRef<number | null>(null)
  const suppressClickRef = useRef(false)
  const swipeRef = useRef({
    active: false,
    axis: null as 'x' | 'y' | null,
    startX: 0,
    startY: 0,
    dx: 0,
    pointerId: -1,
  })
  const wrapRef = useRef<HTMLDivElement>(null)
  const bubbleRef = useRef<HTMLDivElement>(null)
  const [dragX, setDragX] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [iconLeft, setIconLeft] = useState<number | null>(null)

  const cancelPress = () => {
    if (pressTimer.current) {
      window.clearTimeout(pressTimer.current)
      pressTimer.current = null
    }
  }
  useEffect(() => () => cancelPress(), [])

  // Ignora click / doble-click del navegador justo después de un swipe
  const armClickSuppression = () => {
    suppressClickRef.current = true
    window.setTimeout(() => {
      suppressClickRef.current = false
    }, 350)
  }

  const startPress = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    // Tocar un botón interno (reacciones / Retry) no abre menú ni dispara swipe
    if ((e.target as HTMLElement).closest('button')) return
    swipeRef.current = {
      active: true,
      axis: null,
      startX: e.clientX,
      startY: e.clientY,
      dx: 0,
      pointerId: e.pointerId,
    }
    if (pressTimer.current) window.clearTimeout(pressTimer.current)
    pressTimer.current = window.setTimeout(() => {
      pressTimer.current = null
      swipeRef.current.active = false // ya abrió el menú: no debe iniciar swipe
      onOpenMenu(msg)
    }, 480)
  }

  const movePress = (e: React.PointerEvent) => {
    const s = swipeRef.current
    if (!s.active || e.pointerId !== s.pointerId) return
    const dx = e.clientX - s.startX
    const dy = e.clientY - s.startY
    if (!s.axis) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return
      if (dx > 0 && Math.abs(dx) > Math.abs(dy)) {
        // Swipe horizontal hacia la derecha → cancela el long-press
        // (el menú NUNCA se abre durante un swipe)
        s.axis = 'x'
        cancelPress()
        armClickSuppression()
        // Icono fijo en el hueco que se abre a la izquierda de la burbuja
        const wrapW = wrapRef.current?.offsetWidth ?? 0
        const bubbleW = bubbleRef.current?.offsetWidth ?? 0
        const restLeft = isMine ? Math.max(0, wrapW - bubbleW) : 36 //36 = avatar (28) + gap (8)
        setIconLeft(restLeft + 8)
        setDragging(true)
        try {
          ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
        } catch {
          /* sin pointer capture disponible */
        }
      } else {
        // Scroll vertical (o gesto opuesto) → el navegador toma el gesto
        s.axis = 'y'
        cancelPress()
      }
      return
    }
    if (s.axis !== 'x') return
    const clamped = Math.max(0, Math.min(SWIPE_MAX, dx))
    s.dx = clamped
    setDragX(clamped)
  }

  // Soltar el dedo: umbral 42px → reply + háptico; si no, spring de regreso
  const endPress = () => {
    const s = swipeRef.current
    if (s.axis === 'x') {
      const passed = s.dx >= SWIPE_THRESHOLD
      setDragging(false)
      setDragX(0)
      setIconLeft(null)
      if (passed) {
        try {
          navigator.vibrate?.(10)
        } catch {
          /* vibrate no soportado (p. ej. iOS) */
        }
        onReply(msg)
      }
      armClickSuppression()
    }
    s.active = false
    s.axis = null
    s.dx = 0
    cancelPress()
  }

  // Cancelado (scroll que se lleva el gesto / pointercancel): nunca reply
  const abortPress = () => {
    const s = swipeRef.current
    if (s.axis === 'x') {
      setDragging(false)
      setDragX(0)
      setIconLeft(null)
      armClickSuppression()
    }
    s.active = false
    s.axis = null
    s.dx = 0
    cancelPress()
  }

  // Double tap / double click → ❤️ (ignorado tras un swipe)
  const lastTapRef = useRef(0)
  const handleClick = () => {
    if (suppressClickRef.current) return
    const now = Date.now()
    if (now - lastTapRef.current < 300) {
      lastTapRef.current = 0
      cancelPress()
      onReact(msg, '❤️')
    } else {
      lastTapRef.current = now
    }
  }

  return (
    <div
      ref={wrapRef}
      id={`msg-${msg.id}`}
      className={`group/msg relative flex items-end gap-2 touch-pan-y select-none [-webkit-touch-callout:none] ${
        isMine ? 'justify-end' : 'justify-start'
      } ${isFirst ? 'mt-4' : 'mt-1'} ${
        highlighted ? 'rounded-xl ring-2 ring-purple-500/60' : ''
      }`}
      onPointerDown={startPress}
      onPointerMove={movePress}
      onPointerUp={endPress}
      onPointerLeave={() => {
        // El puntero salió sin captura: reinicia para no arrastrar en hover
        if (swipeRef.current.axis !== 'x') {
          swipeRef.current.active = false
          cancelPress()
        }
      }}
      onPointerCancel={abortPress}
    >
      {/* Avatar solo en el último mensaje del grupo (recibidos) */}
      {!isMine && (
        <div className="w-7 shrink-0">
          {isLast && avatarUrl && (
            <img src={avatarUrl} alt="" className="h-7 w-7 rounded-full object-cover" />
          )}
        </div>
      )}

      {/* Acciones al hover (desktop) */}
      <div
        className={`absolute -top-7 z-10 hidden items-center gap-0.5 rounded-full border border-border-light bg-bg-card px-1.5 py-0.5 opacity-0 shadow-lg transition-opacity duration-150 group-hover/msg:pointer-events-auto group-hover/msg:opacity-100 md:flex ${
          isMine ? 'right-0' : 'left-9'
        }`}
      >
        <button
          type="button"
          onClick={() => onReply(msg)}
          title="Reply"
          className="rounded-full p-2 text-text-muted hover:bg-bg-card-hover hover:text-accent"
        >
          <Reply className="h-3.5 w-3.5" />
        </button>
        {['❤️', '👍', '😂'].map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => onReact(msg, emoji)}
            title={`React ${emoji}`}
            className="rounded-full p-1.5 text-[13px] leading-none transition-transform hover:scale-125"
          >
            {emoji}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onOpenMenu(msg)}
          title="More"
          className="rounded-full p-2 text-text-muted hover:bg-bg-card-hover hover:text-text-primary"
        >
          <MoreVertical className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Icono de reply que se revela mientras la burbuja se desliza */}
      {dragging && iconLeft !== null && (
        <span
          className="pointer-events-none absolute top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-accent text-white shadow-lg"
          style={{ left: iconLeft, opacity: Math.min(1, dragX / SWIPE_THRESHOLD) }}
          aria-hidden="true"
        >
          <Reply className="h-3.5 w-3.5" />
        </span>
      )}

      <div
        ref={bubbleRef}
        onClick={handleClick}
        style={{ transform: `translateX(${dragX}px)` }}
        className={`relative max-w-[70%] px-3.5 py-2 ${radius} ${
          dragging
            ? 'transition-none'
            : 'transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none'
        } ${
          isMine
            ? failed
              ? 'bg-red-500/15 text-text-primary ring-1 ring-red-500/40'
              : 'bg-gradient-to-br from-accent to-violet-700 text-white shadow-sm shadow-accent/20'
            : 'bg-bg-card text-text-primary'
        }`}
      >
        {/* Reply quote */}
        {msg.reply_to && (
          <div
            className={`mb-1.5 rounded-lg border-l-2 px-2 py-1 text-left ${
              isMine ? 'border-white/70 bg-white/10' : 'border-accent bg-bg-primary/70'
            }`}
          >
            <p
              className={`truncate text-[10px] font-semibold ${
                isMine ? 'text-white/90' : 'text-accent'
              }`}
            >
              {msg.reply_to.sender_id === myId ? 'You' : otherLabel}
            </p>
            <p
              className={`truncate text-[10px] ${
                isMine ? 'text-white/70' : 'text-text-muted'
              }`}
            >
              {msg.reply_to.text}
            </p>
          </div>
        )}

        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
          <HighlightedText text={msg.text} query={highlightQuery} />
        </p>

        {/* Enlaces multimedia: reproductor (YouTube/TikTok/X/Spotify) o
            tarjeta Open Graph. Compacto para que quepa en la burbuja. */}
        <ContentEmbeds text={msg.text} max={1} compact className="mt-2" />

        {/* Reactions */}
        {reactionChips.size > 0 && (
          <div
            className={`mt-1.5 flex flex-wrap gap-1 ${
              isMine ? 'justify-end' : 'justify-start'
            }`}
          >
            {[...reactionChips.entries()].map(([emoji, { count, mine }]) => (
              <button
                key={emoji}
                type="button"
                onClick={() => onReact(msg, emoji)}
                className={`flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[11px] leading-none transition-colors ${
                  mine
                    ? 'border-accent bg-accent/30'
                    : 'border-white/15 bg-black/25 hover:border-white/30'
                }`}
              >
                <span>{emoji}</span>
                {count > 1 && (
                  <span className={isMine ? 'text-white/80' : 'text-text-muted'}>{count}</span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Último del grupo: timestamp + estado de entrega / fallo */}
        {isLast && !isMine && (
          <p className="mt-1 text-right text-[10px] leading-none text-text-muted">
            {timeAgo(msg.created_at)}
          </p>
        )}
        {isLast && isMine && (
          failed ? (
            <div className="mt-1 flex items-center justify-end gap-2">
              <span className="text-[10px] font-medium text-red-400">Failed</span>
              {/* ≥44px de área táctil sin hinchar la burbuja (margen negativo) */}
              <button
                type="button"
                onClick={() => onRetry(msg.id)}
                className="-my-2 flex min-h-[44px] items-center rounded-md bg-red-500/15 px-3 text-[10px] font-semibold text-red-300 transition-colors hover:bg-red-500/25"
              >
                Retry
              </button>
            </div>
          ) : receipt ? (
            <p className="mt-1 flex items-center justify-end gap-1 whitespace-nowrap text-[10px] font-medium leading-none">
              <span className="text-text-muted">{timeAgo(msg.created_at)}</span>
              <span className={receipt.cls}>
                <span className="sm:hidden" aria-hidden="true">
                  {receipt.short}
                </span>
                <span className="sr-only sm:not-sr-only">{receipt.long}</span>
              </span>
            </p>
          ) : null
        )}
      </div>

      {/* Copiado (feedback inline) */}
      {copied && (
        <span className="absolute -top-6 right-0 rounded-md bg-bg-card px-2 py-0.5 text-[10px] text-success shadow-lg">
          Copied!
        </span>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────
// Typing indicator
// ────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="mt-3 flex items-end gap-2">
      <div className="w-7 shrink-0" />
      <div className="rounded-2xl rounded-bl-sm bg-bg-card px-4 py-3">
        <div className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-muted" style={{ animationDelay: '0ms' }} />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-muted" style={{ animationDelay: '150ms' }} />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-muted" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────
// Conversation list item
// ────────────────────────────────────────────────────────

function ConversationItem({
  conv,
  isActive,
  myId,
  onSelect,
}: {
  conv: Conversation
  isActive: boolean
  myId: string
  onSelect: (conv: Conversation) => void
}) {
  const other = conv.userA?.id === myId ? conv.userB : conv.userA
  if (!other) return null

  const lastMsg = conv.messages?.[0]
  const unread = conv.unread_count || 0

  return (
    <button
      onClick={() => onSelect(conv)}
      className={`relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
        isActive ? 'bg-accent-muted' : 'hover:bg-bg-card-hover'
      }`}
    >
      {/* Barra indicadora activa */}
      {isActive && (
        <span className="absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-full bg-accent" />
      )}

      <img
        src={getAvatarUrl(other.avatar_url, other.username)}
        alt={other.full_name}
        className="h-10 w-10 shrink-0 rounded-full object-cover"
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p
            className={`truncate text-sm ${
              unread > 0 ? 'font-bold text-text-primary' : 'font-medium text-text-primary'
            }`}
          >
            {other.full_name}
          </p>
          {lastMsg?.created_at && (
            <span className="shrink-0 text-[10px] text-text-muted">
              {timeAgo(lastMsg.created_at)}
            </span>
          )}
        </div>
        {lastMsg && (
          <p
            className={`mt-0.5 truncate text-xs ${
              unread > 0 ? 'font-medium text-text-primary' : 'text-text-muted'
            }`}
          >
            {lastMsg.sender_id === myId ? 'You: ' : ''}
            {lastMsg.text}
          </p>
        )}
      </div>

      {unread > 0 && (
        <span className="flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-accent px-1.5 text-[10px] font-bold text-white">
          {unread}
        </span>
      )}
    </button>
  )
}

// ────────────────────────────────────────────────────────
// Menú de acciones de un mensaje (click en ⋯ / long-press)
// ────────────────────────────────────────────────────────

function MenuItem({
  icon,
  label,
  danger,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  danger?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors ${
        danger ? 'text-red-400 hover:bg-red-500/10' : 'text-text-primary hover:bg-bg-card-hover'
      }`}
    >
      {icon}
      {label}
    </button>
  )
}

/* ═══════════════════════════════════════════════════════════
   NEW CONVERSATION MODAL
   ═══════════════════════════════════════════════════════════ */
function NewConversationModal({
  open,
  onClose,
  onSelect,
  myId,
}: {
  open: boolean
  onClose: () => void
  onSelect: (userId: string, username: string) => void
  myId: string
}) {
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<Profile[]>([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setSearch('')
      setResults([])
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

  // Cerrar con Escape
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Debounced search
  useEffect(() => {
    if (!search.trim()) {
      setResults([])
      return
    }
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const data = await profilesApi.list(myId)
        const q = search.toLowerCase()
        const filtered = (data as Profile[]).filter(
          (p) =>
            p.id !== myId &&
            (p.full_name.toLowerCase().includes(q) ||
              p.username.toLowerCase().includes(q))
        )
        setResults(filtered.slice(0, 10))
      } catch {
        // ignore
      }
      setLoading(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [search, myId])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-bg-card shadow-2xl animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-light px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-muted">
              <MessageCircle className="h-4 w-4 text-accent" />
            </div>
            <h3 className="text-sm font-bold text-text-primary">New Conversation</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-bg-card-hover hover:text-text-primary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Search input */}
        <div className="px-5 pt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or username..."
              className="w-full rounded-xl bg-bg-input py-2.5 pl-10 pr-4 text-sm text-text-primary transition-all placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Results */}
        <div className="max-h-72 overflow-y-auto px-3 py-3">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-accent" />
            </div>
          ) : results.length > 0 ? (
            <div className="space-y-1">
              {results.map((user) => (
                <button
                  key={user.id}
                  onClick={() => {
                    onSelect(user.id, user.username)
                    onClose()
                  }}
                  className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-bg-card-hover"
                >
                  <img
                    src={getAvatarUrl(user.avatar_url, user.username)}
                    alt={user.full_name}
                    className="h-9 w-9 rounded-full object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-text-primary">
                      {user.full_name}
                    </p>
                    <p className="truncate text-xs text-text-muted">@{displayUsername(user.username)}</p>
                  </div>
                  <MessageCircle className="h-4 w-4 shrink-0 text-accent opacity-0 transition-opacity group-hover:opacity-100" />
                </button>
              ))}
            </div>
          ) : search.trim() ? (
            <div className="py-8 text-center">
              <p className="text-sm text-text-muted">No users found</p>
            </div>
          ) : (
            <div className="py-8 text-center">
              <p className="text-xs text-text-muted">Type a name or username to search</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   MAIN MESSAGES PAGE
   ═══════════════════════════════════════════════════════════ */
export function Messages() {
  const { profile } = useAuth()
  const { username: routeUsername } = useParams<{ username: string }>()
  const navigate = useNavigate()
  const {
    conversations,
    activeConversationId,
    messages,
    typingUsers,
    activeMeta,
    socket,
    conversationsError,
    setActiveConversation,
    loadConversations,
    loadMessages,
    sendMessage,
    retryMessage,
    upsertMessage,
    removeMessageLocal,
    sendTyping,
  } = useChat()
  const safeConversations = Array.isArray(conversations) ? conversations : []
  const safeMessages = Array.isArray(messages) ? messages : []

  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [targetUserId, setTargetUserId] = useState<string | null>(null)
  const [newChatOpen, setNewChatOpen] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  // ── Notes (voz/música) ──
  const [myNote, setMyNote] = useState<VoiceNote | null>(() => loadMyNote())
  const [contactNotes, setContactNotes] = useState<Record<string, VoiceNote>>({})
  const [noteModalOpen, setNoteModalOpen] = useState(false)
  const [devProfiles, setDevProfiles] = useState<Profile[]>([])
  // Sheet de reproducción: 'me' = mi nota, Contact = su nota, null = cerrado
  const [noteSheetTarget, setNoteSheetTarget] = useState<NoteContact | 'me' | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const unmountedRef = useRef(false)
  // Columna del chat activo: se redimensiona con visualViewport cuando
  // el teclado virtual se abre (la barra de input nunca queda aplastada)
  const chatColumnRef = useRef<HTMLDivElement>(null)

  // ── Scroll inteligente ──
  const scrollBoxRef = useRef<HTMLDivElement>(null)
  const [atBottom, setAtBottom] = useState(true)
  const atBottomRef = useRef(true)
  const [newMessagesCount, setNewMessagesCount] = useState(0)
  const prevCountRef = useRef(0)

  // ── Header: menú 3 puntos, drawer de info, mute/block ──
  const [menuOpen, setMenuOpen] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)
  const [mutedOverride, setMutedOverride] = useState<boolean | null>(null)
  const [blockedOverride, setBlockedOverride] = useState<boolean | null>(null)
  const [presence, setPresence] = useState<{ online: boolean; lastActive?: string | null } | null>(null)

  // ── Search in chat ──
  const [chatSearchOpen, setChatSearchOpen] = useState(false)
  const [chatQuery, setChatQuery] = useState('')
  const [chatMatches, setChatMatches] = useState<ChatMessage[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [highlightId, setHighlightId] = useState<string | null>(null)

  // ── Acciones de mensaje ──
  const [replyTarget, setReplyTarget] = useState<ChatMessage | null>(null)
  const [menuMsgId, setMenuMsgId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<{
    title: string
    message: string
    label: string
    danger?: boolean
    action: () => Promise<void> | void
  } | null>(null)
  const [reportOpen, setReportOpen] = useState(false)
  const [reportReason, setReportReason] = useState('spam')
  const [reportNote, setReportNote] = useState('')
  const [reportBusy, setReportBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const typingTimerRef = useRef<number | null>(null)

  // Track unmount to prevent setState after unmount.
  // El reset dentro del efecto es OBLIGATORIO con <StrictMode>: en dev React
  // ejecuta mount→cleanup→mount al inicio, y sin el reset la ref se quedaría
  // en true para siempre → setSending(false) se saltaría y el input quedaría
  // bloqueado tras el primer mensaje enviado.
  useEffect(() => {
    unmountedRef.current = false
    return () => { unmountedRef.current = true }
  }, [])

  // ── Scroll inteligente: autoscroll solo cerca del fondo ──
  const scrollToBottom = useCallback(() => {
    const box = scrollBoxRef.current
    if (box) box.scrollTop = box.scrollHeight
    atBottomRef.current = true
    setAtBottom(true)
    setNewMessagesCount(0)
  }, [])

  const handleScroll = useCallback(() => {
    const box = scrollBoxRef.current
    if (!box) return
    const near = box.scrollHeight - box.scrollTop - box.clientHeight < 120
    atBottomRef.current = near
    setAtBottom(near)
    if (near) setNewMessagesCount(0)
  }, [])

  useEffect(() => {
    const prev = prevCountRef.current
    const curr = safeMessages.length
    prevCountRef.current = curr
    if (curr === prev) return
    if (atBottomRef.current) {
      // Near the bottom → smooth auto-scroll to the new content
      requestAnimationFrame(() => {
        const box = scrollBoxRef.current
        if (box) box.scrollTop = box.scrollHeight
      })
    } else if (curr > prev) {
      // Reading history → do NOT move the scroll, count the new messages
      setNewMessagesCount((c) => c + (curr - prev))
    }
  }, [messages])

  // Clear send error when input changes
  useEffect(() => {
    if (sendError && input) setSendError(null)
  }, [input, sendError])

  // If navigated with /messages/:username, load that conversation
  useEffect(() => {
    if (routeUsername && profile && routeUsername !== profile.username) {
      loadMessages(routeUsername).catch(() => {
        // loadMessages handles its own errors; targetUserId derives from otherUser
      })
    }
  }, [routeUsername, profile, loadMessages])

  // Find the other user in the active conversation
  const activeConversation = safeConversations.find((c) => c.id === activeConversationId)
  const otherUser = activeConversation
    ? activeConversation.userA?.id === profile?.id
      ? activeConversation.userB
      : activeConversation.userA
    : null

  // Derive targetUserId from otherUser if not set explicitly (e.g., after conversations load)
  useEffect(() => {
    if (!targetUserId && otherUser?.id) {
      setTargetUserId(otherUser.id)
    }
  }, [targetUserId, otherUser])

  // ── Presencia (online / last seen) del otro usuario ──
  const otherId = otherUser?.id ?? null
  useEffect(() => {
    if (!otherId) {
      setPresence(null)
      return
    }
    let cancelled = false
    usersApi
      .status(otherId)
      .then((s) => {
        if (!cancelled) setPresence({ online: Boolean(s.online), lastActive: s.last_active ?? null })
      })
      .catch(() => {
        // sin conexión → el panel mostrará last seen aproximado
      })
    return () => {
      cancelled = true
    }
  }, [otherId])

  // Actualización en vivo de presencia (evento `presence_change`)
  useEffect(() => {
    if (!socket || !otherId) return
    const handler = (raw: unknown) => {
      const p = (raw ?? {}) as { userId?: string; online?: boolean }
      if (p.userId === otherId && typeof p.online === 'boolean') {
        const isOnline = p.online
        setPresence((prev) => ({ online: isOnline, lastActive: prev?.lastActive ?? null }))
      }
    }
    socket.on('presence_change', handler)
    return () => {
      socket.off('presence_change', handler)
    }
  }, [socket, otherId])

  const online = presence?.online ?? false
  const muted = mutedOverride ?? activeMeta.muted
  const blocked = blockedOverride ?? activeMeta.blocked
  const chatTarget: ChatInfoTarget | null = otherUser
    ? {
        id: otherUser.id,
        username: otherUser.username,
        full_name: otherUser.full_name,
        avatar_url: otherUser.avatar_url,
      }
    : null

  // Links compartidos: extraídos de los mensajes reales del hilo
  const sharedLinks = useMemo(() => {
    const set = new Set<string>()
    // El hilo puede venir indefinido mientras la carga inicial falla o aún no
    // responde: nunca debe tumbar el render (el Error Boundary no debe saltar).
    for (const m of messages ?? []) {
      if (!m || typeof m.text !== 'string') continue
      const found = m.text.match(/https?:\/\/\S+/g)
      if (found) for (const u of found) set.add(u.replace(/[.,;:!?)]+$/, ''))
    }
    return [...set].slice(0, 12)
  }, [messages])

  // Auto-clear del aviso temporal
  useEffect(() => {
    if (!notice) return
    const t = window.setTimeout(() => setNotice(null), 3500)
    return () => window.clearTimeout(t)
  }, [notice])

  // Escape cierra drawer / menús / diálogos
  useEffect(() => {
    if (!infoOpen && !menuOpen && !menuMsgId && !reportOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setInfoOpen(false)
      setMenuOpen(false)
      setMenuMsgId(null)
      setReportOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [infoOpen, menuOpen, menuMsgId, reportOpen])

  // ── Móvil: ajusta la altura del panel de chat al viewport visual ──
  // El teclado encoge visualViewport sin tocar el layout: en ese caso
  // fijamos la altura del panel para que el input quede justo encima del
  // teclado. Sin teclado (o en desktop) se retira y manda el CSS normal.
  useEffect(() => {
    const vv = window.visualViewport
    const el = chatColumnRef.current
    if (!vv || !el) return
    const update = () => {
      if (!window.matchMedia('(max-width: 1023px)').matches) {
        el.style.removeProperty('height')
        return
      }
      const layoutH = document.documentElement.clientHeight
      const keyboardOpen = vv.height < layoutH - 120
      if (!keyboardOpen) {
        el.style.removeProperty('height')
        return
      }
      const rect = el.getBoundingClientRect()
      // Panel oculto (lista de conversaciones visible): no fijar altura
      if (rect.width === 0 && rect.height === 0) {
        el.style.removeProperty('height')
        return
      }
      const available = Math.round(vv.height - (rect.top - vv.offsetTop))
      if (available > 180) el.style.height = `${available}px`
      else el.style.removeProperty('height')
    }
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    window.addEventListener('orientationchange', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
      window.removeEventListener('orientationchange', update)
      el.style.removeProperty('height')
    }
    // Al cambiar de conversación se limpia cualquier altura fijada previa
  }, [activeConversationId])

  // Devs for the notes carousel (conversation partners are added first in the memo)
  const profileId = profile?.id
  useEffect(() => {
    if (!profileId) return
    let cancelled = false
    profilesApi
      .list(profileId, 30)
      .then((data) => {
        if (!cancelled && Array.isArray(data)) setDevProfiles(data as Profile[])
      })
      .catch(() => {
        // Carousel still renders conversation partners without this list
      })
    return () => {
      cancelled = true
    }
  }, [profileId])

  // Notas de los contactos desde el backend (sustituye a los datos demo)
  useEffect(() => {
    if (!profileId) return
    let cancelled = false
    notesApi
      .list()
      .then((items) => {
        if (cancelled || !Array.isArray(items)) return
        const map: Record<string, VoiceNote> = {}
        for (const item of items) {
          if (!item || typeof item.user_id !== 'string' || typeof item.text !== 'string') continue
          map[item.user_id] = {
            text: item.text,
            track: (item.track as NoteTrack | null) ?? null,
            updatedAt: item.updated_at ? Date.parse(item.updated_at) || Date.now() : Date.now(),
          }
        }
        setContactNotes(map)
        // La nota del servidor manda sobre la caché local de mi propia nota
        if (map[profileId]) setMyNote(map[profileId])
      })
      .catch((err) => console.warn('[Notes] No se pudo cargar /api/notes:', err))
    return () => {
      cancelled = true
    }
  }, [profileId])

  // Contacts shown in the notes carousel: people you chat with first, then other devs
  const noteContacts = useMemo<NoteContact[]>(() => {
    if (!profile) return []
    const map = new Map<string, NoteContact>()
    const add = (id: string, username: string, fullName: string, avatarUrl: string | null) => {
      if (id && id !== profile.id && !map.has(id)) {
        map.set(id, { id, username, fullName, avatarUrl })
      }
    }
    safeConversations.forEach((conv) => {
      const other = conv.userA?.id === profile.id ? conv.userB : conv.userA
      if (other) add(other.id, other.username, other.full_name, other.avatar_url)
    })
    devProfiles.forEach((p) => add(p.id, p.username, p.full_name, p.avatar_url))
    return [...map.values()]
  }, [profile, safeConversations, devProfiles])

  // Eliminar mi nota (compartido por el sheet y por el modal de edición)
  const deleteMyNote = useCallback(() => {
    clearMyNote()
    setMyNote(null)
    setNoteModalOpen(false)
    setNoteSheetTarget(null)
    notesApi
      .remove()
      .catch((err) => console.warn('[Notes] No se pudo eliminar en el servidor:', err))
  }, [])

  // Conversaciones filtradas por nombre/username con el buscador del panel izquierdo
  const filteredConversations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return safeConversations
    return safeConversations.filter((conv) => {
      const other = conv.userA?.id === profile?.id ? conv.userB : conv.userA
      if (!other) return false
      return (
        (other.full_name ?? '').toLowerCase().includes(q) ||
        (other.username ?? '').toLowerCase().includes(q)
      )
    })
  }, [safeConversations, searchQuery, profile])

  // Auto-resize textarea
  const autoResize = useCallback(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px'
  }, [])

  // Handle sending a message — with try/catch/finally
  const handleSend = useCallback(async () => {
    if (!input.trim() || sending || !profile) return
    const text = input.trim()

    const receiverId = targetUserId || otherUser?.id
    if (!receiverId) {
      setSendError('Unable to determine recipient. Please try again.')
      return
    }

    setSending(true)
    setSendError(null)

    if (textareaRef.current) textareaRef.current.style.height = 'auto'

    try {
      await sendMessage(
        receiverId,
        text,
        activeConversationId || undefined,
        replyTarget
          ? { id: replyTarget.id, sender_id: replyTarget.sender_id, text: replyTarget.text }
          : null
      )
      setInput('')
      setReplyTarget(null)
    } catch (error) {
      console.error('[Messages] Send failed:', error)
      // Restore input on failure so the user doesn't lose their message
      setInput(text)
      const msg = error instanceof Error ? error.message : 'Failed to send message'
      setSendError(msg)
    } finally {
      if (!unmountedRef.current) {
        setSending(false)
        textareaRef.current?.focus()
      }
    }
  }, [input, sending, profile, targetUserId, otherUser, activeConversationId, sendMessage, replyTarget])

  // Enter to send, Shift+Enter for newline
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    autoResize()
    // Indicador "typing…" en tiempo real
    sendTyping(true)
    if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current)
    typingTimerRef.current = window.setTimeout(() => sendTyping(false), 2000)
  }

  const selectConversation = (conv: Conversation) => {
    const other = conv.userA?.id === profile?.id ? conv.userB : conv.userA
    if (other) {
      setTargetUserId(other.id)
    }
    setSendError(null)
    loadMessages(other?.id || '')
  }

  const startNewChat = (userId: string) => {
    setTargetUserId(userId)
    setSendError(null)
    loadMessages(userId)
  }

  // ── Search in chat (backend + debounce de 300ms) ──
  useEffect(() => {
    const q = chatQuery.trim()
    if (!chatSearchOpen || !q || !activeConversationId) {
      setChatMatches([])
      return
    }
    const timer = setTimeout(() => {
      setSearchLoading(true)
      messagesApi
        .search(activeConversationId, q)
        .then((res) => setChatMatches((res.messages ?? []) as ChatMessage[]))
        .catch(() => setChatMatches([]))
        .finally(() => setSearchLoading(false))
    }, 300)
    return () => clearTimeout(timer)
  }, [chatQuery, chatSearchOpen, activeConversationId])

  const jumpToMatch = useCallback((id: string) => {
    setHighlightId(id)
    requestAnimationFrame(() => {
      document
        .getElementById(`msg-${id}`)
        ?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    })
    window.setTimeout(() => setHighlightId((cur) => (cur === id ? null : cur)), 2500)
  }, [])

  // ── Reacciones (optimistas + verdad del servidor) ──
  const handleReact = useCallback(
    async (msg: ChatMessage, emoji: string) => {
      if (!profile) return
      const me = profile.id
      const current = msg.reactions ?? []
      const mine = current.some((r) => r.user_id === me && r.emoji === emoji)
      const optimistic = mine
        ? current.filter((r) => !(r.user_id === me && r.emoji === emoji))
        : [...current.filter((r) => r.user_id !== me), { user_id: me, emoji }]
      upsertMessage({ ...msg, reactions: optimistic })
      try {
        const res = await messagesApi.react(msg.id, emoji)
        if (res?.message) {
          upsertMessage(normalizeMessage(res.message, activeConversationId || undefined))
        }
      } catch (err) {
        console.error('[Messages] react failed:', err)
        upsertMessage(msg) // revert to the previous state
      }
    },
    [profile, activeConversationId, upsertMessage]
  )

  const handleCopy = useCallback((msg: ChatMessage) => {
    navigator.clipboard
      ?.writeText(msg.text)
      .catch(() => {
        // clipboard no disponible (permisos / http)
      })
    setCopiedId(msg.id)
    window.setTimeout(() => setCopiedId((cur) => (cur === msg.id ? null : cur)), 1400)
  }, [])

  const handleReply = useCallback((msg: ChatMessage) => {
    setReplyTarget(msg)
    setMenuMsgId(null)
    // El preview de respuesta aparece sobre el input y el input gana foco
    // (también desde el swipe, donde el foco debe esperar al gesto)
    requestAnimationFrame(() => textareaRef.current?.focus())
  }, [])

  // ── Delete: confirmación + endpoint real ──
  const handleDelete = useCallback(
    (msg: ChatMessage, scope: 'me' | 'everyone') => {
      setMenuMsgId(null)
      setConfirm({
        title: scope === 'everyone' ? 'Delete for everyone' : 'Delete for me',
        message:
          scope === 'everyone'
            ? 'This message will be removed for both of you. This cannot be undone.'
            : 'The message will be hidden only on your side.',
        label: scope === 'everyone' ? 'Delete for everyone' : 'Delete for me',
        danger: true,
        action: async () => {
          try {
            await messagesApi.remove(msg.id, scope)
            removeMessageLocal(msg.id)
          } catch (err) {
            console.error('[Messages] delete failed:', err)
          }
        },
      })
    },
    [removeMessageLocal]
  )

  // ── Mute / clear / block / report (endpoints reales) ──
  const toggleMute = useCallback(async () => {
    if (!activeConversationId) return
    const next = !muted
    setMutedOverride(next)
    try {
      await conversationsApi.mute(activeConversationId, next)
      setNotice(next ? 'Notifications muted.' : 'Notifications unmuted.')
    } catch (err) {
      console.error('[Messages] mute failed:', err)
      setMutedOverride(!next)
    }
  }, [activeConversationId, muted])

  const clearChat = useCallback(() => {
    if (!activeConversationId) return
    setMenuMsgId(null)
    setConfirm({
      title: 'Clear chat',
      message:
        'Every message in this conversation will be hidden on your side. The other person keeps their copy.',
      label: 'Clear chat',
      danger: true,
      action: async () => {
        try {
          await conversationsApi.clear(activeConversationId)
          setActiveConversation(activeConversationId)
          if (otherUser?.id) await loadMessages(otherUser.id)
          setNotice('Chat cleared.')
        } catch (err) {
          console.error('[Messages] clear failed:', err)
        }
      },
    })
  }, [activeConversationId, otherUser, setActiveConversation, loadMessages])

  const blockUser = useCallback(() => {
    if (!otherUser) return
    setMenuMsgId(null)
    setConfirm({
      title: 'Block user',
      message: `${otherUser.full_name} will no longer be able to message you. The block is enforced on the server, not just in the UI.`,
      label: 'Block',
      danger: true,
      action: async () => {
        try {
          await blocksApi.create(otherUser.id)
          setBlockedOverride(true)
          setNotice(`${otherUser.full_name} has been blocked.`)
        } catch (err) {
          console.error('[Messages] block failed:', err)
        }
      },
    })
  }, [otherUser])

  const openReport = () => {
    setMenuMsgId(null)
    setReportReason('spam')
    setReportNote('')
    setReportOpen(true)
  }

  const submitReport = async () => {
    if (!otherUser || reportBusy) return
    setReportBusy(true)
    try {
      await reportsApi.create(otherUser.id, reportReason, reportNote.trim() || undefined)
      setReportOpen(false)
      setNotice('Report submitted. Our team will review it.')
    } catch (err) {
      console.error('[Messages] report failed:', err)
      setNotice(err instanceof Error ? err.message : 'Unable to submit the report.')
    } finally {
      setReportBusy(false)
    }
  }

  // Filter messages to only valid ones for safe rendering
  const validMessages = safeMessages.filter(isValidMessage)

  // Mensaje seleccionado en el menú de acciones (⋯ / long-press)
  const menuMsg = menuMsgId ? safeMessages.find((m) => m.id === menuMsgId) ?? null : null

  if (!profile) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-text-muted">Sign in to access messages</p>
      </div>
    )
  }

  return (
    <>
      <div className="flex h-full overflow-hidden bg-bg-primary">
        {/* ── Left: Conversation List ── */}
        <div
          className={`w-full shrink-0 flex-col md:flex md:w-80 ${
            activeConversationId ? 'hidden' : 'flex'
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5 md:py-3.5">
            <h2 className="text-base font-bold text-text-primary">Messages</h2>
            <button
              onClick={() => setNewChatOpen(true)}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-white transition-all hover:bg-accent-hover hover:shadow-[0_0_12px_rgba(124,58,237,0.3)]"
              title="New conversation"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          {/* Aviso no bloqueante: si la carga inicial falló, se reintenta aquí
              en vez de dejar la pantalla en blanco o tocar el Error Boundary */}
          {conversationsError && (
            <div className="mx-4 mb-2 flex items-center justify-between gap-3 rounded-xl border border-danger/40 bg-danger-muted px-3 py-2">
              <span className="min-w-0 truncate text-xs font-medium text-danger">
                No se pudieron cargar los mensajes
              </span>
              <button
                type="button"
                onClick={() => loadConversations()}
                className="shrink-0 rounded-lg border border-danger/40 px-2.5 py-1 text-[11px] font-semibold text-danger transition-colors hover:bg-danger/10"
              >
                Reintentar
              </button>
            </div>
          )}

          {/* ── Buscador (PC: sobre el carrusel · Móvil: debajo) ── */}
          <div className="order-3 mt-3 px-4 pb-3 md:order-2 md:mt-0 md:mb-4 md:pb-0">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search"
                aria-label="Search conversations"
                className="w-full rounded-lg bg-bg-input py-2 pl-9 pr-8 text-sm text-text-primary transition-all placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted transition-colors hover:text-text-primary"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* ── Carrusel: Notas de Voz / Música
              Móvil: arriba del todo (scroll horizontal táctil).
              PC: entre el buscador y la lista de mensajes. ── */}
          <div className="order-2 mt-4 md:order-3 md:mt-0">
            <NotesCarousel
              me={{
                username: profile.username,
                fullName: profile.full_name,
                avatarUrl: profile.avatar_url,
              }}
              contacts={noteContacts}
              notesByUser={contactNotes}
              myNote={myNote}
              onEditNote={() => setNoteModalOpen(true)}
              onOpenNote={setNoteSheetTarget}
            />
          </div>

          {/* Conversations */}
          <div className="order-4 flex-1 overflow-y-auto p-2">
            {filteredConversations.length === 0 ? (
              searchQuery.trim() ? (
                <div className="px-4 py-10 text-center">
                  <p className="text-sm text-text-muted">No se encontraron conversaciones</p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-accent-muted">
                    <MessageCircle className="h-6 w-6 text-accent" />
                  </div>
                  <p className="text-sm font-medium text-text-primary">No conversations yet</p>
                  <p className="mt-1 text-xs text-text-muted">Click + to start a new one</p>
                  <button
                    onClick={() => setNewChatOpen(true)}
                    className="mt-3 flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white transition-all hover:bg-accent-hover"
                  >
                    <Plus className="h-3 w-3" />
                    New Message
                  </button>
                </div>
              )
            ) : (
              <div className="space-y-0.5">
                {filteredConversations.map((conv) => (
                  <ConversationItem
                    key={conv.id}
                    conv={conv}
                    isActive={conv.id === activeConversationId}
                    myId={profile.id}
                    onSelect={selectConversation}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Right: Chat Area ── */}
        <div
          ref={chatColumnRef}
          className={`min-w-0 flex-1 flex-col md:flex ${
            !activeConversationId ? 'hidden' : 'flex'
          }`}
        >
          {activeConversationId && otherUser ? (
            <>
              {/* Chat header: avatar, nombre, @username, estado/typing, menú */}
              <div className="relative flex shrink-0 items-center gap-2 border-b border-border-light px-3 py-1 md:gap-3 md:px-4 md:py-2">
                <button
                  onClick={() => {
                    setActiveConversation(null)
                    setTargetUserId(null)
                    setSendError(null)
                    setMenuOpen(false)
                    navigate('/messages')
                  }}
                  aria-label="Back"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-text-muted transition-colors hover:bg-bg-card-hover hover:text-text-primary md:hidden"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <img
                  src={getAvatarUrl(otherUser?.avatar_url, otherUser?.username)}
                  alt={otherUser?.full_name ?? 'User'}
                  className="h-8 w-8 shrink-0 rounded-full object-cover ring-2 ring-accent/20 md:h-9 md:w-9"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-text-primary">
                    {otherUser?.full_name ?? 'Unknown User'}
                  </p>
                  <p className="flex min-w-0 items-center gap-1.5 text-[11px]">
                    <span className="truncate text-text-muted">
                      @{displayUsername(otherUser?.username ?? '')}
                    </span>
                    <span className="text-text-muted">·</span>
                    {typingUsers.size > 0 ? (
                      <span className="shrink-0 font-semibold text-accent">typing…</span>
                    ) : online ? (
                      <span className="shrink-0 font-semibold text-success">Online now</span>
                    ) : (
                      <span className="shrink-0 text-text-muted">
                        {presence?.lastActive
                          ? `Last seen ${timeAgo(presence.lastActive)}${
                              timeAgo(presence.lastActive) === 'now' ? '' : ' ago'
                            }`
                          : 'Last seen a while ago'}
                      </span>
                    )}
                  </p>
                </div>
                {muted && (
                  <BellOff className="h-3.5 w-3.5 shrink-0 text-text-muted" aria-label="Notifications muted" />
                )}

                {/* Info → drawer de detalles (móvil / tablet) */}
                <button
                  onClick={() => setInfoOpen(true)}
                  aria-label="Chat info"
                  title="Chat info"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-text-muted transition-colors hover:bg-bg-card-hover hover:text-text-primary lg:hidden"
                >
                  <Info className="h-5 w-5" />
                </button>

                {/* Menú de 3 puntos */}
                <button
                  onClick={() => setMenuOpen((o) => !o)}
                  aria-label="Conversation options"
                  aria-expanded={menuOpen}
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors hover:bg-bg-card-hover ${
                    menuOpen ? 'text-accent' : 'text-text-muted'
                  }`}
                >
                  <MoreVertical className="h-5 w-5" />
                </button>

                {menuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                    <div className="absolute right-2 top-full z-50 mt-1 w-60 overflow-hidden rounded-xl border border-border-light bg-bg-card py-1 shadow-2xl animate-scale-in">
                      <MenuItem
                        icon={<User className="h-4 w-4" />}
                        label="View profile"
                        onClick={() => {
                          setMenuOpen(false)
                          if (otherUser) navigate(`/profile/${otherUser.username}`)
                        }}
                      />
                      <MenuItem
                        icon={<Search className="h-4 w-4" />}
                        label="Search in chat"
                        onClick={() => {
                          setMenuOpen(false)
                          setChatSearchOpen(true)
                        }}
                      />
                      <MenuItem
                        icon={muted ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
                        label={muted ? 'Unmute notifications' : 'Mute notifications'}
                        onClick={() => {
                          setMenuOpen(false)
                          void toggleMute()
                        }}
                      />
                      <MenuItem
                        icon={<Trash2 className="h-4 w-4" />}
                        label="Clear chat"
                        onClick={() => {
                          setMenuOpen(false)
                          clearChat()
                        }}
                      />
                      <div className="my-1 h-px bg-border-light" />
                      <MenuItem
                        icon={<Ban className="h-4 w-4" />}
                        label={blocked ? 'Blocked' : 'Block'}
                        danger
                        onClick={() => {
                          setMenuOpen(false)
                          if (!blocked) blockUser()
                        }}
                      />
                      <MenuItem
                        icon={<Flag className="h-4 w-4" />}
                        label="Report"
                        danger
                        onClick={() => {
                          setMenuOpen(false)
                          openReport()
                        }}
                      />
                    </div>
                  </>
                )}
              </div>

              {/* Search in chat (debounced contra el backend) */}
              {chatSearchOpen && (
                <div className="shrink-0 border-b border-border-light px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Search className="h-4 w-4 shrink-0 text-text-muted" />
                    <input
                      value={chatQuery}
                      onChange={(e) => setChatQuery(e.target.value)}
                      placeholder="Search in chat…"
                      autoFocus
                      className="min-h-[36px] min-w-0 flex-1 rounded-lg bg-bg-input px-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent/20"
                    />
                    <span className="shrink-0 text-[11px] text-text-muted">
                      {searchLoading
                        ? '…'
                        : chatQuery.trim()
                          ? `${chatMatches.length} found`
                          : ''}
                    </span>
                    <button
                      onClick={() => {
                        setChatSearchOpen(false)
                        setChatQuery('')
                        setChatMatches([])
                        setHighlightId(null)
                      }}
                      aria-label="Close search"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-bg-card-hover hover:text-text-primary"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  {chatMatches.length > 0 && (
                    <div className="mt-2 max-h-40 space-y-1 overflow-y-auto">
                      {chatMatches.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => jumpToMatch(m.id)}
                          className="flex min-h-[40px] w-full items-center gap-2 rounded-lg px-2 text-left transition-colors hover:bg-bg-card-hover"
                        >
                          <span className="shrink-0 text-[10px] text-text-muted">
                            {timeAgo(m.created_at)}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-xs text-text-primary">
                            {m.text}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Messages — anclados abajo (scroll inteligente) */}
              <div
                ref={scrollBoxRef}
                onScroll={handleScroll}
                className="relative flex-1 overflow-x-hidden overflow-y-auto px-4 py-4"
              >
                <div className="mx-auto flex min-h-full max-w-3xl flex-col justify-end">
                  {validMessages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <img
                        src={getAvatarUrl(otherUser?.avatar_url, otherUser?.username)}
                        alt={otherUser?.full_name ?? 'User'}
                        className="mb-3 h-16 w-16 rounded-full object-cover ring-2 ring-accent/20"
                      />
                      <p className="text-sm font-semibold text-text-primary">
                        {otherUser?.full_name ?? 'Unknown User'}
                      </p>
                      <p className="mt-1 text-xs text-text-muted">
                        This is the beginning of your conversation.
                      </p>
                    </div>
                  ) : (
                    <div className="pb-1">
                      {validMessages.map((msg, i) => {
                        const prev = validMessages[i - 1]
                        const next = validMessages[i + 1]
                        const showDivider =
                          !prev || dayLabel(prev.created_at) !== dayLabel(msg.created_at)

                        return (
                          <div key={msg.id || `msg-${i}`}>
                            {showDivider && <DayDivider label={dayLabel(msg.created_at)} />}
                            <MessageBubble
                              msg={msg}
                              isMine={msg.sender_id === profile.id}
                              isFirst={showDivider || !sameGroup(prev, msg)}
                              isLast={!sameGroup(msg, next)}
                              avatarUrl={getAvatarUrl(otherUser?.avatar_url, otherUser?.username)}
                              myId={profile.id}
                              otherLabel={otherUser?.full_name ?? 'Them'}
                              highlightQuery={chatSearchOpen ? chatQuery : ''}
                              highlighted={highlightId === msg.id}
                              copied={copiedId === msg.id}
                              onReply={handleReply}
                              onReact={handleReact}
                              onRetry={(id) => {
                                void retryMessage(id)
                              }}
                              onOpenMenu={(m) => setMenuMsgId(m.id)}
                            />
                          </div>
                        )
                      })}
                      {typingUsers.size > 0 && <TypingIndicator />}
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              {/* ── Input Bar (móvil-segura: safe-area + por encima del bottom nav) ── */}
              <div className="relative shrink-0 px-3 pb-3 pt-2 sm:px-4 sm:pb-4">
                {/* Flotante: mensajes nuevos mientras lees historial */}
                {!atBottom && (
                  <button
                    type="button"
                    onClick={scrollToBottom}
                    className="absolute -top-12 left-1/2 z-20 flex min-h-[40px] -translate-x-1/2 items-center gap-1.5 rounded-full border border-accent/40 bg-bg-card px-4 text-xs font-semibold text-accent shadow-[0_8px_24px_rgba(0,0,0,0.45)] transition-all hover:bg-accent hover:text-white"
                  >
                    <ArrowDown className="h-4 w-4" />
                    New message
                    {newMessagesCount > 0 && (
                      <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-accent px-1.5 text-[10px] font-bold text-white">
                        {newMessagesCount > 99 ? '99+' : newMessagesCount}
                      </span>
                    )}
                  </button>
                )}
                <div className="mx-auto max-w-3xl">
                  {/* Aviso temporal (mute / clear / block / report) */}
                  {notice && (
                    <div className="mb-2 rounded-lg border border-accent/30 bg-accent-muted px-3 py-2 text-xs font-medium text-accent">
                      {notice}
                    </div>
                  )}
                  {/* Send error message */}
                  {sendError && (
                    <div className="mb-2 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400 border border-red-500/20">
                      {sendError}
                    </div>
                  )}
                  {/* Block: el backend rechaza el envío */}
                  {blocked && (
                    <div className="mb-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
                      You blocked this user. They cannot message you.
                    </div>
                  )}
                  {/* Reply bar */}
                  {replyTarget && (
                    <div className="mb-2 flex items-start gap-2 rounded-xl border border-accent/30 bg-accent-muted px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-accent">
                          Replying to{' '}
                          {replyTarget.sender_id === profile.id
                            ? 'yourself'
                            : displayUsername(otherUser?.username ?? 'them')}
                        </p>
                        <p className="truncate text-xs text-text-secondary">{replyTarget.text}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setReplyTarget(null)}
                        aria-label="Cancel reply"
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-text-muted transition-colors hover:bg-bg-card-hover hover:text-text-primary"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                  <div className="flex items-end gap-1 rounded-2xl bg-bg-input px-2 py-2 transition-all focus-within:ring-1 focus-within:ring-accent/20">
                    <button
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-text-muted transition-colors hover:bg-bg-card-hover hover:text-accent"
                      title="Emoji"
                      type="button"
                    >
                      <Smile className="h-5 w-5" />
                    </button>
                    <button
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-text-muted transition-colors hover:bg-bg-card-hover hover:text-accent"
                      title="Attach file"
                      type="button"
                    >
                      <Paperclip className="h-5 w-5" />
                    </button>

                    <textarea
                      ref={textareaRef}
                      value={input}
                      onChange={handleInputChange}
                      onKeyDown={handleKeyDown}
                      placeholder={`Message @${displayUsername(otherUser?.username ?? '')}`}
                      rows={1}
                      disabled={blocked}
                      className="max-h-[120px] min-h-[28px] min-w-0 flex-1 resize-none overflow-x-hidden overflow-y-auto bg-transparent px-1 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                      autoFocus
                    />

                    <button
                      onClick={handleSend}
                      disabled={!input.trim() || sending || blocked}
                      aria-label="Send message"
                      className="mr-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent text-white transition-all hover:bg-accent-hover hover:shadow-[0_0_12px_rgba(124,58,237,0.35)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-accent disabled:hover:shadow-none"
                    >
                      {sending ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <Send className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                  <p className="mt-1.5 hidden px-1 text-[10px] text-text-muted sm:block">
                    Enter to send · Shift + Enter for new line
                  </p>
                </div>
              </div>
            </>
          ) : (
            /* Empty state — estilo Instagram Web (PC) */
            <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
              <div className="mb-5 flex h-24 w-24 items-center justify-center rounded-full border border-border-light bg-bg-card shadow-[0_0_40px_rgba(124,58,237,0.12)]">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent-muted ring-1 ring-accent/20">
                  <MessageCircle className="h-8 w-8 text-accent" strokeWidth={1.75} />
                </div>
              </div>
              <h3 className="mt-1 text-xl font-bold tracking-tight text-text-primary">
                Tus mensajes
              </h3>
              <p className="mt-2 max-w-sm text-sm leading-relaxed text-text-secondary">
                Envía mensajes privados o interactúa con las notas de los demás devs.
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <button
                  onClick={() => navigate('/discover')}
                  className="flex min-h-[44px] items-center gap-2 rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-white shadow-[0_0_20px_rgba(124,58,237,0.45)] ring-1 ring-violet-400/40 transition-all hover:bg-accent-hover hover:shadow-[0_0_28px_rgba(124,58,237,0.65)] active:scale-95"
                >
                  <Compass className="h-4 w-4" />
                  Discover people
                </button>
                <button
                  onClick={() => setNewChatOpen(true)}
                  className="flex min-h-[44px] items-center gap-2 rounded-xl border border-border-light bg-bg-card px-6 py-3 text-sm font-semibold text-text-primary transition-all hover:bg-bg-card-hover active:scale-95"
                >
                  <Plus className="h-4 w-4" strokeWidth={3} />
                  Nuevo mensaje
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Panel derecho: info contextual del chat activo (PC) ── */}
        <aside className="hidden w-80 shrink-0 overflow-y-auto border-l border-border-light bg-bg-primary lg:block">
          {chatTarget ? (
            <ChatInfoPanel
              user={chatTarget}
              online={online}
              muted={muted}
              blocked={blocked}
              sharedLinks={sharedLinks}
              myInterests={profile.interests ?? []}
              onToggleMute={() => {
                void toggleMute()
              }}
              onBlock={blockUser}
              onReport={openReport}
            />
          ) : (
            <div className="flex h-full min-h-[420px] flex-col items-center justify-center px-6 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-muted">
                <MessageCircle className="h-7 w-7 text-accent" />
              </div>
              <p className="text-sm font-semibold text-text-primary">Select a conversation</p>
              <p className="mt-1 text-xs leading-relaxed text-text-muted">
                Presence, interests, shared links and actions of the active chat appear here.
              </p>
              <button
                onClick={() => navigate('/discover')}
                className="mt-4 flex min-h-[44px] items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow-[0_0_16px_rgba(124,58,237,0.35)] transition-all hover:bg-accent-hover active:scale-95"
              >
                <Compass className="h-4 w-4" />
                Discover people
              </button>
            </div>
          )}
        </aside>
      </div>

      {/* ── Drawer de info del chat (móvil / tablet) ── */}
      {infoOpen && chatTarget && (
        <div
          className="fixed inset-0 z-[85] lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Chat info"
        >
          <div
            className="absolute inset-x-0 top-0 bottom-16 bg-black/60 backdrop-blur-sm animate-fade-in"
            onClick={() => setInfoOpen(false)}
          />
          <div className="safe-area-bottom absolute inset-x-0 bottom-16 max-h-[85dvh] overflow-y-auto rounded-t-3xl border-t border-border-light bg-bg-primary shadow-[0_-16px_48px_rgba(0,0,0,0.5)] animate-sheet-up">
            <ChatInfoPanel
              user={chatTarget}
              online={online}
              muted={muted}
              blocked={blocked}
              sharedLinks={sharedLinks}
              myInterests={profile.interests ?? []}
              onToggleMute={() => {
                void toggleMute()
              }}
              onBlock={blockUser}
              onReport={openReport}
              onClose={() => setInfoOpen(false)}
            />
          </div>
        </div>
      )}

      {/* ── Menú de acciones de un mensaje (bottom sheet en móvil / card en desktop) ── */}
      {menuMsg && (
        <MessageActionsSheet
          msg={menuMsg}
          isMine={menuMsg.sender_id === profile.id}
          copied={copiedId === menuMsg.id}
          onReply={() => handleReply(menuMsg)}
          onReact={(emoji) => {
            void handleReact(menuMsg, emoji)
            setMenuMsgId(null)
          }}
          onCopy={() => {
            handleCopy(menuMsg)
            setMenuMsgId(null)
          }}
          onDelete={(scope) => handleDelete(menuMsg, scope)}
          onClose={() => setMenuMsgId(null)}
        />
      )}

      {/* ── Confirmación (Block / Clear / Delete) ── */}
      {confirm && (
        <div
          className="fixed inset-0 z-[95] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in"
          onClick={() => setConfirm(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-bg-card p-5 shadow-2xl animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-text-primary">{confirm.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-text-secondary">{confirm.message}</p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirm(null)}
                className="min-h-[44px] rounded-xl border border-border-light px-4 text-sm font-medium text-text-secondary transition-colors hover:bg-bg-card-hover"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const action = confirm.action
                  setConfirm(null)
                  void action()
                }}
                className={`min-h-[44px] rounded-xl px-4 text-sm font-semibold transition-all ${
                  confirm.danger
                    ? 'bg-red-500/15 text-red-400 ring-1 ring-red-500/40 hover:bg-red-500/25'
                    : 'bg-accent text-white hover:bg-accent-hover'
                }`}
              >
                {confirm.label}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Report (reporte real al backend, con motivo) ── */}
      {reportOpen && otherUser && (
        <div
          className="fixed inset-0 z-[95] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in"
          onClick={() => setReportOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-bg-card p-5 shadow-2xl animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-500/15">
                <Flag className="h-4 w-4 text-red-400" />
              </div>
              <h3 className="text-base font-bold text-text-primary">
                Report {otherUser.full_name}
              </h3>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-text-muted">
              Your report goes straight to the moderation team. The other user is not notified.
            </p>

            <label className="mt-4 block text-[11px] font-semibold uppercase tracking-wider text-text-muted">
              Reason
            </label>
            <select
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              className="mt-1.5 w-full rounded-xl bg-bg-input px-3 py-3 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-accent/20"
            >
              <option value="spam">Spam</option>
              <option value="harassment">Harassment</option>
              <option value="inappropriate">Inappropriate content</option>
              <option value="underage">Underage user</option>
              <option value="other">Other</option>
            </select>

            <label className="mt-3 block text-[11px] font-semibold uppercase tracking-wider text-text-muted">
              Details (optional)
            </label>
            <textarea
              value={reportNote}
              onChange={(e) => setReportNote(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="Add any context for the moderators…"
              className="mt-1.5 w-full resize-none rounded-xl bg-bg-input px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent/20"
            />

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setReportOpen(false)}
                className="min-h-[44px] rounded-xl border border-border-light px-4 text-sm font-medium text-text-secondary transition-colors hover:bg-bg-card-hover"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  void submitReport()
                }}
                disabled={reportBusy}
                className="flex min-h-[44px] items-center gap-2 rounded-xl bg-red-500/15 px-4 text-sm font-semibold text-red-400 ring-1 ring-red-500/40 transition-all hover:bg-red-500/25 disabled:opacity-50"
              >
                {reportBusy && <Loader2 className="h-4 w-4 animate-spin" />}
                Submit report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Conversation Modal */}
      <NewConversationModal
        open={newChatOpen}
        onClose={() => setNewChatOpen(false)}
        onSelect={startNewChat}
        myId={profile.id}
      />

      {/* Modal de música para la nota */}
      <MusicNoteModal
        open={noteModalOpen}
        onClose={() => setNoteModalOpen(false)}
        initialNote={myNote}
        onSave={(note) => {
          // Caché local primero (pintado inmediato) y sync con el backend
          setMyNote(saveMyNote(note))
          setNoteModalOpen(false)
          notesApi
            .save({ text: note.text, track: note.track })
            .then((saved) => {
              setMyNote({
                text: saved.text,
                track: (saved.track as NoteTrack | null) ?? null,
                updatedAt: saved.updated_at
                  ? Date.parse(saved.updated_at) || Date.now()
                  : Date.now(),
              })
            })
            .catch((err) => console.warn('[Notes] No se pudo guardar en el servidor:', err))
        }}
        onRemove={deleteMyNote}
      />

      {/* ── Sheet de reproducción de notas (estilo Instagram) ── */}
      {noteSheetTarget && (
        <NotePlayerSheet
          open
          user={
            noteSheetTarget === 'me'
              ? {
                  username: profile.username,
                  fullName: profile.full_name,
                  avatarUrl: profile.avatar_url,
                }
              : {
                  username: noteSheetTarget.username,
                  fullName: noteSheetTarget.fullName,
                  avatarUrl: noteSheetTarget.avatarUrl,
                }
          }
          note={noteSheetTarget === 'me' ? myNote : contactNotes[noteSheetTarget.id] ?? null}
          isMine={noteSheetTarget === 'me'}
          onClose={() => setNoteSheetTarget(null)}
          onEdit={() => {
            setNoteSheetTarget(null)
            setNoteModalOpen(true)
          }}
          onDelete={deleteMyNote}
          onReply={() => {
            if (noteSheetTarget === 'me') return
            setNoteSheetTarget(null)
            startNewChat(noteSheetTarget.id)
          }}
        />
      )}
    </>
  )
}
