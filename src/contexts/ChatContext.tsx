import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAuth } from './AuthContext'
import { messages as messagesApi, notifications as notificationsApi } from '../lib/api'
import type { AppNotification } from '../lib/types'
import {
  createSnapshotGate,
  filterValidMessages,
  mergeMessages,
  normalizeMessage,
  type ChatMessage,
} from '../lib/chatMessages'

interface Conversation {
  id: string
  user_a_id: string
  user_b_id: string
  created_at: string
  updated_at: string
  userA?: { id: string; username: string; full_name: string; avatar_url: string | null }
  userB?: { id: string; username: string; full_name: string; avatar_url: string | null }
  messages?: ChatMessage[]
  unread_count?: number
}

/** Realtime socket lifecycle, exposed so the UI can react to outages. */
export type ConnectionState = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected'

interface ChatContextType {
  socket: Socket | null
  connectionState: ConnectionState
  conversations: Conversation[]
  activeConversationId: string | null
  messages: ChatMessage[]
  typingUsers: Set<string>
  totalUnread: number
  unreadNotifications: number
  latestNotification: AppNotification | null
  /** Users currently connected (presence for the chat info panel). */
  onlineUserIds: Set<string>
  /** Mute / block flags of the open thread, straight from the server. */
  activeMeta: { muted: boolean; blocked: boolean }
  setActiveConversation: (conversationId: string | null) => void
  /** Error de la última carga de conversaciones (banner no bloqueante). */
  conversationsError: string | null
  loadConversations: () => Promise<void>
  loadMessages: (userId: string) => Promise<void>
  sendMessage: (
    receiverId: string,
    text: string,
    conversationId?: string,
    replyTo?: { id: string; sender_id: string; text: string } | null,
  ) => Promise<ChatMessage>
  /** Re-send a failed bubble (same text + reply). */
  retryMessage: (messageId: string) => Promise<void>
  /** Merge a server-confirmed message into the open thread (reactions, …). */
  upsertMessage: (msg: ChatMessage) => void
  /** Drop a message locally (REST delete while the socket is down). */
  removeMessageLocal: (messageId: string) => void
  /** Emit typing / stop_typing for the open conversation. */
  sendTyping: (isTyping: boolean) => void
  refreshUnread: () => Promise<void>
  refreshNotifications: () => Promise<void>
  /** Reset the local unread badge after the API has marked everything read. */
  markNotificationsRead: () => void
}

const ChatContext = createContext<ChatContextType | undefined>(undefined)

// ─── Realtime tuning ─────────────────────────────────────
/** Retry forever with exponential-ish backoff instead of giving up. */
const RECONNECT_ATTEMPTS = Infinity
const RECONNECT_DELAY_MS = 1000
const RECONNECT_DELAY_MAX_MS = 15000
/** Manual retry when socket.io stops on its own (auth rejected by server). */
const AUTH_RETRY_MS = 5000
/** How long sendMessage waits for the socket to come back before failing. */
const CONNECT_WAIT_MS = 8000
/** Fallback polling cadence while realtime is down. */
const FALLBACK_POLL_MS = 20000
const SEND_TIMEOUT_MS = 15000

/** Ack payload of the `send_message` socket event (and POST /api/messages). */
type SendAck = { ok?: boolean; message?: unknown; error?: string }

// ─── Helpers ───────────────────────────────────────────

function isAppNotification(raw: unknown): raw is AppNotification {
  if (!raw || typeof raw !== 'object') return false
  const n = raw as Record<string, unknown>
  return typeof n.id === 'string' && n.id.length > 0 && typeof n.type === 'string'
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const { token, profile } = useAuth()
  const socketRef = useRef<Socket | null>(null)
  const [connectionState, setConnectionState] = useState<ConnectionState>('idle')
  const [conversations, setConversations] = useState<Conversation[]>([])
  /**
   * Error de la carga inicial de conversaciones. Se muestra como un aviso
   * recuperable en Messages: una petición que falla jamás debe romper la
   * pantalla ni disparar el Error Boundary.
   */
  const [conversationsError, setConversationsError] = useState<string | null>(null)
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set())
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set())
  const [activeMeta, setActiveMeta] = useState<{ muted: boolean; blocked: boolean }>({ muted: false, blocked: false })
  const [totalUnread, setTotalUnread] = useState(0)
  const [unreadNotifications, setUnreadNotifications] = useState(0)
  const [latestNotification, setLatestNotification] = useState<AppNotification | null>(null)

  // Stable refs for use in socket callbacks
  const activeConversationIdRef = useRef<string | null>(null)
  activeConversationIdRef.current = activeConversationId

  const messagesRef = useRef<ChatMessage[]>([])
  messagesRef.current = messages

  const conversationsRef = useRef<Conversation[]>([])
  conversationsRef.current = conversations

  const profileId = profile?.id
  const profileIdRef = useRef<string | undefined>(profileId)
  profileIdRef.current = profileId

  const tokenRef = useRef<string | null>(token)
  tokenRef.current = token

  /**
   * Chat rooms this client wants to be subscribed to.
   * Server-side rooms die with the socket, so the *intent* is kept here and
   * re-applied on every (re)connect — otherwise messages silently stop
   * arriving after a single reconnect.
   */
  const joinedRoomsRef = useRef<Set<string>>(new Set())

  // ── Data loaders ───────────────────────────────────────

  const loadConversations = useCallback(async () => {
    try {
      const data = await messagesApi.getConversations()
      const validConversations = (Array.isArray(data) ? data : []).filter(
        (c) => c && typeof c.id === 'string'
      )
      setConversations(validConversations)
      const total = validConversations.reduce((sum: number, c: Conversation) => sum + (c.unread_count || 0), 0)
      setTotalUnread(total)
      setConversationsError(null)
    } catch (err) {
      // Se conserva la lista anterior y se expone el error como aviso:
      // la pantalla nunca debe romperse por una respuesta fallida.
      console.error('[CHAT] loadConversations error:', err)
      setConversations(Array.isArray(conversationsRef.current) ? conversationsRef.current : [])
      setConversationsError(err instanceof Error && err.message ? err.message : 'Unable to load conversations')
    }
  }, [])

  const refreshUnread = useCallback(async () => {
    try {
      const data = await messagesApi.getUnreadCount()
      setTotalUnread(data.count ?? 0)
    } catch {
      // ignore
    }
  }, [])

  const refreshNotifications = useCallback(async () => {
    if (!profileIdRef.current) return
    try {
      const data = await notificationsApi.list()
      const list = Array.isArray(data) ? data : []
      setUnreadNotifications(list.filter((n) => n && n.is_read === false).length)
    } catch {
      // ignore (guest / transient failure — badge simply stays as it was)
    }
  }, [])

  const markNotificationsRead = useCallback(() => {
    setUnreadNotifications(0)
  }, [])

  /**
   * Gate between "an API snapshot arrived" and "a send is still open":
   * snapshots are merged (never replacing the list) and are held back while
   * a POST is in flight, so a stale response can never wipe the message the
   * user just sent. Held snapshots are applied when the send settles.
   */
  const snapshotGate = useMemo(
    () => createSnapshotGate({
      apply: (serverMessages, targetConversationId) => {
        setMessages((prev) => mergeMessages(serverMessages, prev, targetConversationId))
      },
      isActive: (conversationId) => conversationId === activeConversationIdRef.current,
    }),
    []
  )

  const applySnapshot = snapshotGate.apply

  /**
   * Pull the latest messages of the active conversation (server truth).
   * Used after reconnecting / during the offline fallback so nothing that
   * happened while the socket was down is lost. Keeps optimistic messages.
   */
  const resyncActiveConversation = useCallback(async () => {
    const convId = activeConversationIdRef.current
    const myId = profileIdRef.current
    if (!convId || !myId) return
    try {
      const convs = await messagesApi.getConversations()
      const conv = (Array.isArray(convs) ? convs : []).find((c) => c && c.id === convId)
      if (!conv) return
      const otherId = conv.user_a_id === myId ? conv.user_b_id : conv.user_a_id
      if (!otherId) return
      // Bail out if the user switched conversation while we were fetching
      if (activeConversationIdRef.current !== convId) return

      const data = await messagesApi.getMessages(otherId)
      if (activeConversationIdRef.current !== convId) return
      if (data.conversation_id && data.conversation_id !== convId) return

      const fetched = filterValidMessages(data.messages ?? [])
      applySnapshot(fetched, convId)
    } catch (err) {
      console.error('[CHAT] resync error:', err)
    }
  }, [applySnapshot])

  // Keep refs fresh so socket callbacks (registered once) see latest state
  const loadConversationsRef = useRef(loadConversations)
  loadConversationsRef.current = loadConversations

  const refreshUnreadRef = useRef(refreshUnread)
  refreshUnreadRef.current = refreshUnread

  const refreshNotificationsRef = useRef(refreshNotifications)
  refreshNotificationsRef.current = refreshNotifications

  const resyncActiveRef = useRef(resyncActiveConversation)
  resyncActiveRef.current = resyncActiveConversation

  // ── Local message mutations used by socket callbacks ───

  /** Keep an unsent bubble on screen, flagged as failed (Retry button). */
  const markFailedMessage = useCallback((clientId: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === clientId ? { ...m, status: 'failed' as const } : m))
    )
  }, [])

  /** Merge server-confirmed fields (reactions, receipts…) into a message. */
  const upsertMessage = useCallback((msg: ChatMessage) => {
    setMessages((prev) => {
      const idx = prev.findIndex((m) => m.id === msg.id)
      if (idx === -1) return prev
      const next = [...prev]
      next[idx] = { ...next[idx], ...msg }
      return next
    })
  }, [])

  const markFailedRef = useRef(markFailedMessage)
  markFailedRef.current = markFailedMessage
  const upsertRef = useRef(upsertMessage)
  upsertRef.current = upsertMessage

  /** Drop a message locally — used when a REST delete resolves but the
   * `message:deleted` broadcast never arrives (socket down). */
  const removeMessageLocal = useCallback((messageId: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== messageId))
  }, [])

  /** optimistic message id → receiver id (so Retry works for brand-new chats). */
  const sendTargetsRef = useRef<Map<string, string>>(new Map())

  // ── Room membership (survives reconnects) ──────────────

  const joinRoom = useCallback((conversationId: string | null | undefined) => {
    if (!conversationId || joinedRoomsRef.current.has(conversationId)) return
    joinedRoomsRef.current.add(conversationId)
    const socket = socketRef.current
    if (socket?.connected) socket.emit('join_chat', { conversationId })
  }, [])

  const leaveRoom = useCallback((conversationId: string | null | undefined) => {
    if (!conversationId || !joinedRoomsRef.current.delete(conversationId)) return
    const socket = socketRef.current
    if (socket?.connected) socket.emit('leave_chat', { conversationId })
  }, [])

  /**
   * Resolves once the socket is connected, or false after `timeoutMs`.
   * Restarts the retry cycle if socket.io stopped it (e.g. auth rejected).
   */
  const waitForConnection = useCallback((timeoutMs: number): Promise<boolean> => {
    const socket = socketRef.current
    if (!socket) return Promise.resolve(false)
    if (socket.connected) return Promise.resolve(true)
    return new Promise<boolean>((resolve) => {
      let settled = false
      const timer = setTimeout(() => finish(false), timeoutMs)
      const finish = (ok: boolean) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        socket.off('connect', onConnect)
        resolve(ok)
      }
      const onConnect = () => finish(true)
      socket.once('connect', onConnect)
      if (!socket.active) socket.connect()
    })
  }, [])

  // ── Socket lifecycle ───────────────────────────────────
  // ChatProvider sits above <Routes> in App.tsx, so this effect is NOT torn
  // down when navigating between pages: one socket for the whole session.

  useEffect(() => {
    if (!tokenRef.current || !profileIdRef.current) {
      socketRef.current?.disconnect()
      socketRef.current = null
      setConnectionState('idle')
      return
    }

    const socket = io(window.location.origin, {
      // Dynamic credentials: every (re)connect attempt reads the current
      // token, so an expired/rotated JWT can never wedge reconnection.
      auth: (cb) => cb({ token: tokenRef.current }),
      transports: ['websocket', 'polling'],
      // ── Automatic reconnection (retry) ──
      reconnection: true,
      reconnectionAttempts: RECONNECT_ATTEMPTS,
      reconnectionDelay: RECONNECT_DELAY_MS,
      reconnectionDelayMax: RECONNECT_DELAY_MAX_MS,
      randomizationFactor: 0.5,
      timeout: 10000,
    })

    let authRetryTimer: ReturnType<typeof setTimeout> | null = null
    const scheduleAuthRetry = () => {
      if (authRetryTimer) return
      authRetryTimer = setTimeout(() => {
        authRetryTimer = null
        if (!socket.connected && !socket.active) socket.connect()
      }, AUTH_RETRY_MS)
    }
    const clearAuthRetry = () => {
      if (authRetryTimer) {
        clearTimeout(authRetryTimer)
        authRetryTimer = null
      }
    }

    socket.on('connect', () => {
      console.log('[CHAT] Socket connected')
      clearAuthRetry()
      setConnectionState('connected')

      // Server-side rooms died with the previous socket → re-subscribe.
      joinedRoomsRef.current.forEach((conversationId) => {
        socket.emit('join_chat', { conversationId })
      })

      // Recover everything missed while offline.
      refreshUnreadRef.current()
      loadConversationsRef.current()
      refreshNotificationsRef.current()
      resyncActiveRef.current()
    })

    socket.on('disconnect', (reason) => {
      console.log('[CHAT] Socket disconnected:', reason)
      if (reason === 'io server disconnect' || !socket.active) {
        // socket.io will not retry by itself → do it manually.
        setConnectionState('reconnecting')
        scheduleAuthRetry()
        return
      }
      setConnectionState(socket.active ? 'reconnecting' : 'disconnected')
    })

    socket.on('connect_error', (err) => {
      console.warn('[CHAT] Socket connect error:', err?.message)
      if (socket.active) {
        setConnectionState('reconnecting')
      } else {
        // Handshake rejected (usually auth): manual retry with fresh token.
        setConnectionState('reconnecting')
        scheduleAuthRetry()
      }
    })

    socket.io.on('reconnect_attempt', () => setConnectionState('reconnecting'))
    socket.io.on('reconnect_failed', () => setConnectionState('disconnected'))

    // ── new_message: message published to a chat room we joined ──
    socket.on('new_message', (raw) => {
      try {
        const activeConvId = activeConversationIdRef.current
        const myId = profileIdRef.current

        // Normalize the incoming message
        const msg = normalizeMessage(raw, raw?.conversation_id)

        // Only add if we're viewing this conversation
        if (activeConvId && activeConvId === msg.conversation_id) {
          setMessages((prev) => {
            // Dedup by id (also protects against our own echo of an
            // optimistic message)
            if (prev.some((m) => m.id === msg.id)) return prev
            return [...prev, msg]
          })

          // Open thread + incoming message → ask the server to mark it read
          // (the server answers the room with a real `message:read` event)
          if (msg.sender_id !== myId) {
            socket.emit('mark_read', { conversationId: msg.conversation_id })
          }
        }

        // Update conversation list
        setConversations((prev) => {
          const idx = prev.findIndex((c) => c.id === msg.conversation_id)
          if (idx === -1) {
            // New conversation — reload list
            loadConversationsRef.current()
            return prev
          }
          const updated = [...prev]
          updated[idx] = {
            ...updated[idx],
            messages: [msg],
            updated_at: msg.created_at,
            unread_count: msg.sender_id !== myId
              ? (updated[idx].unread_count || 0) + 1
              : updated[idx].unread_count,
          }
          updated.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
          return updated
        })

        // Update total unread
        if (msg.sender_id !== myId && activeConvId !== msg.conversation_id) {
          setTotalUnread((prev) => prev + 1)
        }
      } catch (err) {
        console.error('[CHAT] new_message error:', err)
      }
    })

    // Message for a conversation we're NOT currently in: refresh list + badge
    socket.on('new_message_notification', () => {
      refreshUnreadRef.current()
      loadConversationsRef.current()
    })

    // ── new_notification: likes, matches, buddy requests, etc. ──
    socket.on('new_notification', (raw: unknown) => {
      try {
        if (!isAppNotification(raw)) return
        setLatestNotification(raw)
        refreshNotificationsRef.current()
      } catch (err) {
        console.error('[CHAT] new_notification error:', err)
      }
    })

    socket.on('typing', ({ userId, conversationId }: { userId: string; conversationId: string }) => {
      if (conversationId === activeConversationIdRef.current && userId !== profileIdRef.current) {
        setTypingUsers((prev) => new Set(prev).add(userId))
      }
    })

    socket.on('stop_typing', ({ userId, conversationId }: { userId: string; conversationId: string }) => {
      if (conversationId === activeConversationIdRef.current) {
        setTypingUsers((prev) => {
          const next = new Set(prev)
          next.delete(userId)
          return next
        })
      }
    })

    // ── Receipts: delivered ✓✓ / read ✓✓ (real server events) ──
    socket.on('message:delivered', (raw: unknown) => {
      try {
        const p = (raw ?? {}) as { messageIds?: string[]; delivered_at?: string }
        const ids = Array.isArray(p.messageIds) ? p.messageIds : []
        if (ids.length === 0) return
        const at = typeof p.delivered_at === 'string' ? p.delivered_at : new Date().toISOString()
        setMessages((prev) =>
          prev.map((m) => (ids.includes(m.id) && !m.delivered_at ? { ...m, delivered_at: at } : m))
        )
      } catch (err) {
        console.error('[CHAT] message:delivered error:', err)
      }
    })

    socket.on('message:read', (raw: unknown) => {
      try {
        const p = (raw ?? {}) as { messageIds?: string[] }
        const ids = Array.isArray(p.messageIds) ? p.messageIds : []
        if (ids.length === 0) return
        setMessages((prev) => prev.map((m) => (ids.includes(m.id) ? { ...m, read: true } : m)))
      } catch (err) {
        console.error('[CHAT] message:read error:', err)
      }
    })

    // The send was rejected/failed server-side → keep the bubble + Retry
    socket.on('message:failed', (raw: unknown) => {
      try {
        const p = (raw ?? {}) as { clientId?: string }
        if (typeof p.clientId === 'string' && p.clientId) markFailedRef.current(p.clientId)
      } catch (err) {
        console.error('[CHAT] message:failed error:', err)
      }
    })

    // ── Reactions / deletions / clear chat ──
    socket.on('message:reaction', (raw: unknown) => {
      try {
        const convId = (raw as { conversation_id?: string } | null)?.conversation_id
        upsertRef.current(normalizeMessage(raw, convId))
      } catch (err) {
        console.error('[CHAT] message:reaction error:', err)
      }
    })

    socket.on('message:deleted', (raw: unknown) => {
      try {
        const p = (raw ?? {}) as { messageId?: string; scope?: string; deleted_by?: string[] }
        if (!p.messageId) return
        const me = profileIdRef.current
        const deletedByMe = Array.isArray(p.deleted_by) && !!me && p.deleted_by.includes(me)
        if (p.scope === 'everyone' || deletedByMe) {
          const id = p.messageId
          setMessages((prev) => prev.filter((m) => m.id !== id))
        }
      } catch (err) {
        console.error('[CHAT] message:deleted error:', err)
      }
    })

    socket.on('chat:cleared', (raw: unknown) => {
      try {
        const p = (raw ?? {}) as { conversationId?: string; userId?: string }
        if (p.userId === profileIdRef.current && p.conversationId === activeConversationIdRef.current) {
          setMessages([])
        }
      } catch (err) {
        console.error('[CHAT] chat:cleared error:', err)
      }
    })

    // ── Presence for the chat info panel ──
    socket.on('presence_change', (raw: unknown) => {
      try {
        const p = (raw ?? {}) as { userId?: string; online?: boolean }
        const uid = p.userId
        if (!uid || typeof p.online !== 'boolean') return
        const online = p.online
        setOnlineUserIds((prev) => {
          const next = new Set(prev)
          if (online) next.add(uid)
          else next.delete(uid)
          return next
        })
      } catch (err) {
        console.error('[CHAT] presence_change error:', err)
      }
    })

    socketRef.current = socket
    setConnectionState('connecting')

    return () => {
      // Detach listeners first so a late event cannot setState after unmount
      clearAuthRetry()
      socket.removeAllListeners()
      socket.io.removeAllListeners()
      socket.disconnect()
      if (socketRef.current === socket) socketRef.current = null
    }
  }, [token, profileId])

  // Join/leave chat rooms when active conversation changes
  useEffect(() => {
    // Only one room at a time; leave the others (the intent is recorded even
    // if we're offline, and re-applied on reconnect).
    joinedRoomsRef.current.forEach((id) => {
      if (id !== activeConversationId) leaveRoom(id)
    })
    if (activeConversationId) joinRoom(activeConversationId)

    // Clear typing when switching conversations
    setTypingUsers(new Set())
  }, [activeConversationId, joinRoom, leaveRoom])

  // Load conversations + notification badge on mount / sign-in
  useEffect(() => {
    if (!token || !profileId) return
    loadConversations()
    refreshNotifications()
  }, [token, profileId, loadConversations, refreshNotifications])

  // ── Fallback while realtime is down ──────────────────────
  // Controlled degraded mode: poll the REST endpoints so badges, the
  // conversation list and the open thread keep updating (with delay) until
  // the socket reconnects.
  useEffect(() => {
    if (!token || !profileId) return
    if (connectionState !== 'reconnecting' && connectionState !== 'disconnected') return

    const sync = () => {
      loadConversationsRef.current()
      refreshNotificationsRef.current()
      resyncActiveRef.current()
    }

    sync() // catch up immediately after the drop
    const id = window.setInterval(sync, FALLBACK_POLL_MS)
    return () => window.clearInterval(id)
  }, [token, profileId, connectionState])

  const loadMessages = useCallback(async (userId: string) => {
    try {
      const data = await messagesApi.getMessages(userId)
      const serverMessages = filterValidMessages(data.messages ?? [])
      const targetConversationId = data.conversation_id ?? null
      // Merge, never replace: a snapshot requested before an in-flight POST
      // resolved must not wipe the message the user just sent.
      applySnapshot(serverMessages, targetConversationId)
      setActiveConversationId(targetConversationId)
      setActiveMeta({ muted: Boolean(data.muted), blocked: Boolean(data.blocked) })
      // Refresh conversations to update unread
      loadConversations()
    } catch (err) {
      // Keep the thread as it is: a transient fetch failure must not wipe
      // the messages already on screen.
      console.error('[CHAT] loadMessages error:', err)
    }
  }, [loadConversations, applySnapshot])

  const sendMessage = useCallback(async (
    receiverId: string,
    text: string,
    conversationId?: string,
    replyTo?: { id: string; sender_id: string; text: string } | null,
  ): Promise<ChatMessage> => {
    const currentProfile = profile

    if (!currentProfile) {
      throw new Error('Not connected. Please check your connection and try again.')
    }

    const cleanText = text.trim()
    if (!cleanText) {
      throw new Error('Message cannot be empty')
    }

    if (cleanText.length > 4000) {
      throw new Error('Message is too long (max 4000 characters)')
    }

    // Track this send from its first local mutation: any API snapshot that
    // arrives while it is open is held back until the send settles, so the
    // full-list update always happens AFTER the POST concluded.
    snapshotGate.beginSend()
    let counted = true
    const releaseSend = () => {
      if (!counted) return
      counted = false
      snapshotGate.endSend()
    }

    try {
      // ── 1. Optimistic message: persisted to local state right away ──
      const optimisticId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      const optimisticMsg: ChatMessage = {
        id: optimisticId,
        conversation_id: conversationId || '',
        sender_id: currentProfile.id,
        text: cleanText,
        read: false,
        created_at: new Date().toISOString(),
        reply_to_id: replyTo?.id ?? null,
        reply_to: replyTo ?? null,
        reactions: [],
        delivered_at: null,
        status: 'sending',
        sender: {
          id: currentProfile.id,
          username: currentProfile.username,
          full_name: currentProfile.full_name,
          avatar_url: currentProfile.avatar_url,
        },
      }
      sendTargetsRef.current.set(optimisticId, receiverId)
      // Functional update → previously loaded messages are never lost.
      setMessages((prev) => [...prev, optimisticMsg])

      /**
       * Transport failure: the bubble is kept on screen flagged as `failed`
       * (with a Retry button) instead of silently disappearing.
       */
      const fail = (): ChatMessage => {
        const failedMsg: ChatMessage = { ...optimisticMsg, status: 'failed' }
        setMessages((prev) => prev.map((m) => (m.id === optimisticId ? failedMsg : m)))
        return failedMsg
      }

      /**
       * Swap the optimistic bubble for the definitive message (server id)
       * without touching any other message. If the user left the thread in
       * the meantime the temp bubble is only dropped — the message already
       * lives in the API and in the conversation list.
       */
      const commit = (created: ChatMessage): ChatMessage => {
        sendTargetsRef.current.delete(optimisticId)
        const startedNewConversation = !conversationId && !!created.conversation_id
        if (startedNewConversation) {
          setActiveConversationId(created.conversation_id)
          joinRoom(created.conversation_id)
          loadConversationsRef.current()
        }

        const visible =
          created.conversation_id === conversationId ||
          startedNewConversation ||
          created.conversation_id === activeConversationIdRef.current ||
          !created.conversation_id

        setMessages((prev) => {
          const withoutTemp = prev.filter((m) => m.id !== optimisticId)
          if (!visible) return withoutTemp
          if (withoutTemp.some((m) => m.id === created.id)) return withoutTemp
          return [...withoutTemp, created]
        })
        return created
      }

      // ── 2. Realtime path (socket, with ack + timeout) ──
      const connected = socketRef.current?.connected
        ? true
        : await waitForConnection(CONNECT_WAIT_MS)

      if (connected && socketRef.current?.connected) {
        const socket = socketRef.current
        return await new Promise<ChatMessage>((resolve) => {
          let settled = false

          const timeout = setTimeout(() => {
            if (settled) return
            settled = true
            resolve(fail())
          }, SEND_TIMEOUT_MS)

          socket.emit(
            'send_message',
            {
              receiverId,
              text: cleanText,
              conversationId,
              replyToId: replyTo?.id || null,
              // Correlates `message:failed` with this optimistic bubble
              clientId: optimisticId,
            },
            (response: SendAck | null) => {
              if (settled) return // Already timed out
              settled = true
              clearTimeout(timeout)

              try {
                if (response?.ok && response.message) {
                  // Definitive message (with its id) replaces the temp bubble.
                  resolve(commit(normalizeMessage(response.message, conversationId)))
                } else {
                  resolve(fail())
                }
              } catch {
                resolve(fail())
              }
            },
          )
        })
      }

      // ── 3. Controlled fallback: realtime still down → REST POST ──
      // Same contract as the ack: the API answers with the created message
      // and its definitive id, which is merged into the local list.
      try {
        const data = await messagesApi.send({
          receiver_id: receiverId,
          text: cleanText,
          conversation_id: conversationId,
          reply_to_id: replyTo?.id || undefined,
          client_id: optimisticId,
        })
        return commit(normalizeMessage(data?.message, conversationId))
      } catch (err) {
        console.error('[CHAT] REST send failed:', err)
        return fail()
      }
    } finally {
      releaseSend()
    }
  }, [profile, waitForConnection, joinRoom, snapshotGate])

  /** Re-send a failed bubble (same text + reply) as a brand-new message. */
  const retryMessage = useCallback(async (messageId: string) => {
    const target = messagesRef.current.find((m) => m.id === messageId && m.status === 'failed')
    if (!target) return

    let receiverId = sendTargetsRef.current.get(messageId)
    if (!receiverId) {
      const conv = conversationsRef.current.find((c) => c.id === target.conversation_id)
      const me = profileIdRef.current
      if (conv && me) {
        const other = conv.user_a_id === me ? conv.userB : conv.userA
        receiverId = other?.id
      }
    }
    if (!receiverId) return

    // Drop the failed bubble — the new send paints a fresh one.
    setMessages((prev) => prev.filter((m) => m.id !== messageId))
    sendTargetsRef.current.delete(messageId)
    await sendMessage(
      receiverId,
      target.text,
      target.conversation_id || undefined,
      target.reply_to ?? null,
    )
  }, [sendMessage])

  /** Typing indicator for the open conversation (no-op when offline). */
  const sendTyping = useCallback((isTyping: boolean) => {
    const socket = socketRef.current
    const convId = activeConversationIdRef.current
    if (!socket?.connected || !convId) return
    socket.emit(isTyping ? 'typing' : 'stop_typing', { conversationId: convId })
  }, [])

  const setActiveConversation = useCallback((id: string | null) => {
    setActiveConversationId(id)
    setMessages([])
    setActiveMeta({ muted: false, blocked: false })
  }, [])

  return (
    <ChatContext.Provider value={{
      socket: socketRef.current,
      connectionState,
      conversations,
      activeConversationId,
      messages,
      typingUsers,
      totalUnread,
      unreadNotifications,
      latestNotification,
      onlineUserIds,
      activeMeta,
      setActiveConversation,
      conversationsError,
      loadConversations,
      loadMessages,
      sendMessage,
      retryMessage,
      upsertMessage,
      removeMessageLocal,
      sendTyping,
      refreshUnread,
      refreshNotifications,
      markNotificationsRead,
    }}>
      {children}
    </ChatContext.Provider>
  )
}

export function useChat() {
  const ctx = useContext(ChatContext)
  if (!ctx) throw new Error('useChat must be used within ChatProvider')
  return ctx
}

export type { ChatMessage, Conversation }
