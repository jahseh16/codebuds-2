/**
 * Pure helpers for chat message state.
 *
 * Kept in a JSX-free module so the merge rules can be unit-tested in
 * isolation: "sent message flashes then disappears" bugs are almost always
 * a server snapshot clobbering locally-known messages, which is exactly what
 * `mergeMessages` prevents.
 */

export interface MessageReaction {
  user_id: string
  emoji: string
}

export interface ChatMessage {
  id: string
  conversation_id: string
  sender_id: string
  text: string
  read: boolean
  created_at: string
  sender?: { id: string; username: string; full_name: string; avatar_url: string | null }
  // ── receipts / replies / reactions / moderation (server-backed) ──
  reply_to_id?: string | null
  reply_to?: { id: string; sender_id: string; text: string } | null
  reactions?: MessageReaction[]
  delivered_at?: string | null
  deleted_for_all?: boolean
  deleted_by?: string[]
  /** Client-only optimistic state while the send settles. */
  status?: 'sending' | 'failed'
}

/** Validate that a message object has all required fields */
export function isValidChatMessage(msg: unknown): msg is ChatMessage {
  if (!msg || typeof msg !== 'object') return false
  const m = msg as Record<string, unknown>
  return (
    typeof m.id === 'string' && m.id.length > 0 &&
    typeof m.conversation_id === 'string' &&
    typeof m.sender_id === 'string' && m.sender_id.length > 0 &&
    typeof m.text === 'string' &&
    typeof m.created_at === 'string' && m.created_at.length > 0
  )
}

/** Normalize a raw server message into a valid ChatMessage */
export function normalizeMessage(raw: unknown, fallbackConversationId?: string): ChatMessage {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid message: not an object')
  const r = raw as Record<string, unknown>
  const id = String(r.id ?? '')
  const conversation_id = String(r.conversation_id ?? fallbackConversationId ?? '')
  const sender_id = String(r.sender_id ?? '')
  const text = String(r.text ?? '')
  const created_at = String(r.created_at ?? new Date().toISOString())
  if (!id || !sender_id) {
    throw new Error(`Invalid message payload: missing id=${id} sender_id=${sender_id}`)
  }
  const sender = r.sender && typeof r.sender === 'object' ? (r.sender as Record<string, unknown>) : null

  // Reply preview (quoted message)
  const replyRaw = r.reply_to && typeof r.reply_to === 'object'
    ? (r.reply_to as Record<string, unknown>)
    : null

  // Reactions: [{ user_id, emoji }]
  const reactions: MessageReaction[] = []
  if (Array.isArray(r.reactions)) {
    for (const item of r.reactions) {
      if (item && typeof item === 'object') {
        const rr = item as Record<string, unknown>
        if (typeof rr.user_id === 'string' && typeof rr.emoji === 'string') {
          reactions.push({ user_id: rr.user_id, emoji: rr.emoji })
        }
      }
    }
  }

  return {
    id,
    conversation_id,
    sender_id,
    text,
    read: Boolean(r.read),
    created_at,
    reply_to_id: typeof r.reply_to_id === 'string' && r.reply_to_id ? r.reply_to_id : null,
    reply_to: replyRaw && typeof replyRaw.id === 'string'
      ? {
          id: String(replyRaw.id),
          sender_id: String(replyRaw.sender_id ?? ''),
          text: String(replyRaw.text ?? ''),
        }
      : null,
    reactions,
    delivered_at: typeof r.delivered_at === 'string' ? r.delivered_at : null,
    deleted_for_all: Boolean(r.deleted_for_all),
    deleted_by: Array.isArray(r.deleted_by)
      ? r.deleted_by.filter((x): x is string => typeof x === 'string')
      : [],
    status: r.status === 'sending' || r.status === 'failed' ? r.status : undefined,
    sender: sender ? {
      id: String(sender.id ?? ''),
      username: String(sender.username ?? ''),
      full_name: String(sender.full_name ?? ''),
      avatar_url: (sender.avatar_url as string | null) ?? null,
    } : undefined,
  }
}

/** Filter messages array to only valid entries */
export function filterValidMessages(msgs: ChatMessage[]): ChatMessage[] {
  return msgs.filter(isValidChatMessage)
}

/**
 * Merge a fresh server snapshot into the local list **without ever losing a
 * message the user can already see**.
 *
 * The local list can be ahead of a snapshot in two ways:
 *  - optimistic messages (`temp_*`) whose POST has not resolved yet;
 *  - messages already acknowledged locally but missing from a snapshot that
 *    was requested *before* the insert committed (the classic race that makes
 *    a sent message flash and then disappear).
 *
 * Messages that belong to a different known conversation are always dropped,
 * so switching threads still replaces the view correctly. The result is
 * ordered by creation time.
 */
export function mergeMessages(
  serverMessages: ChatMessage[],
  localMessages: ChatMessage[],
  conversationId?: string | null,
): ChatMessage[] {
  const serverIds = new Set(serverMessages.map((m) => m.id))

  const belongsHere = (m: ChatMessage): boolean =>
    // Known conversation: only keep it if it is this thread.
    m.conversation_id === conversationId ||
    // In-flight optimistic message (no conversation id yet) or snapshot
    // without a conversation id: keep it, it belongs to the open thread.
    !m.conversation_id ||
    !conversationId

  const localOnly = localMessages.filter((m) => !serverIds.has(m.id) && belongsHere(m))

  const merged = [...serverMessages, ...localOnly]
  merged.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  return merged
}

/** A snapshot of the thread as returned by the API. */
type Snapshot = { messages: ChatMessage[]; conversationId: string | null }

/**
 * Serializes "apply an API snapshot" against "a send is in flight".
 *
 * While a POST is open, a snapshot that arrives is held back instead of
 * being applied: that response was most likely taken *before* the insert
 * committed, and applying it would be the re-fetch that wipes the message
 * the user just sent. Held-back snapshots are applied as soon as the last
 * send settles — and dropped if the user moved to another thread meanwhile.
 */
export function createSnapshotGate(options: {
  /** Apply a snapshot to the list (must be a merge, never a replace). */
  apply: (messages: ChatMessage[], conversationId: string | null) => void
  /** Is this conversation still the one on screen? */
  isActive: (conversationId: string | null) => boolean
}) {
  let pendingSends = 0
  let deferred: Snapshot | null = null

  return {
    beginSend() {
      pendingSends += 1
    },
    endSend() {
      pendingSends = Math.max(0, pendingSends - 1)
      if (pendingSends > 0 || !deferred) return
      const held = deferred
      deferred = null
      if (held.conversationId && !options.isActive(held.conversationId)) return
      options.apply(held.messages, held.conversationId)
    },
    apply(messages: ChatMessage[], conversationId: string | null) {
      if (pendingSends > 0) {
        deferred = { messages, conversationId }
        return
      }
      options.apply(messages, conversationId)
    },
    get pendingSends() {
      return pendingSends
    },
    get hasDeferred() {
      return deferred !== null
    },
  }
}
