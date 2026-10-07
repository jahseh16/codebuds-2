import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, Heart, Check, X, Clock, Send, Inbox } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { vibes as vibesApi } from '../lib/api'
import { getAvatarUrl } from '../lib/utils'
import { displayUsername } from '../lib/username'
import type { Vibe, Profile } from '../lib/types'

/* ─── Received Vibe Card ──────────────────────────────── */
function ReceivedVibeCard({
  vibe,
  onAccept,
  onDecline,
}: {
  vibe: Vibe & { sender: Profile }
  onAccept: () => void
  onDecline: () => void
}) {
  const navigate = useNavigate()
  const sender = vibe.sender

  return (
    <div className="rounded-2xl bg-bg-card p-4 transition-all duration-200 hover:-translate-y-0.5 animate-fade-in border border-border-light">
      <div className="flex items-start gap-3">
        <img
          src={getAvatarUrl(sender.avatar_url, sender.username)}
          alt={sender.full_name}
          className="h-12 w-12 shrink-0 rounded-full object-cover ring-2 ring-accent/30"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-text-primary truncate">{sender.full_name}</p>
            <Heart className="h-3.5 w-3.5 text-pink-400 shrink-0" fill="currentColor" />
          </div>
          <p className="text-xs text-text-muted">@{displayUsername(sender.username)}</p>

          {sender.bio && (
            <p className="mt-1.5 text-xs text-text-secondary line-clamp-2">{sender.bio}</p>
          )}

          {/* Interests */}
          {sender.interests && sender.interests.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {sender.interests.slice(0, 3).map(i => (
                <span key={i} className="rounded-md bg-bg-input px-1.5 py-0.5 text-[10px] text-text-muted">{i}</span>
              ))}
            </div>
          )}

          {/* Looking for */}
          {sender.looking_for && sender.looking_for.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {sender.looking_for.map(lf => (
                <span key={lf} className="rounded-full bg-accent-muted px-2 py-0.5 text-[9px] font-medium text-accent">
                  {lf.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={onAccept}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-accent py-2.5 text-xs font-semibold text-white transition-all hover:bg-accent-hover hover:shadow-[0_0_16px_rgba(124,58,237,0.3)]"
        >
          <Check className="h-3.5 w-3.5" />
          Accept
        </button>
        <button
          onClick={onDecline}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-bg-input py-2.5 text-xs font-medium text-text-secondary transition-all hover:bg-danger/10 hover:text-danger border border-border-light"
        >
          <X className="h-3.5 w-3.5" />
          Decline
        </button>
        <button
          onClick={() => navigate(`/profile/${sender.username}`)}
          className="rounded-xl bg-bg-input px-3 py-2.5 text-xs font-medium text-text-secondary transition-all hover:bg-bg-card-hover hover:text-text-primary border border-border-light"
        >
          Profile
        </button>
      </div>
    </div>
  )
}

/* ─── Sent Vibe Card ──────────────────────────────────── */
function SentVibeCard({ vibe }: { vibe: Vibe & { receiver: Profile } }) {
  const navigate = useNavigate()
  const receiver = vibe.receiver

  const statusConfig = {
    pending: { label: 'Pending', color: 'text-amber-400', bg: 'bg-amber-500/15', icon: Clock },
    accepted: { label: 'Accepted!', color: 'text-emerald-400', bg: 'bg-emerald-500/15', icon: Check },
    declined: { label: 'Declined', color: 'text-text-muted', bg: 'bg-bg-input', icon: X },
  }
  const cfg = statusConfig[vibe.status as keyof typeof statusConfig] || statusConfig.pending
  const StatusIcon = cfg.icon

  return (
    <div className="rounded-2xl bg-bg-card p-4 transition-all duration-200 animate-fade-in border border-border-light opacity-80">
      <div className="flex items-start gap-3">
        <img
          src={getAvatarUrl(receiver.avatar_url, receiver.username)}
          alt={receiver.full_name}
          className="h-10 w-10 shrink-0 rounded-full object-cover"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-text-primary truncate">{receiver.full_name}</p>
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${cfg.bg} ${cfg.color}`}>
              <StatusIcon className="h-2.5 w-2.5" />
              {cfg.label}
            </span>
          </div>
          <p className="text-xs text-text-muted">@{displayUsername(receiver.username)}</p>
        </div>
        {vibe.status === 'accepted' && (
          <button
            onClick={() => navigate(`/messages/${receiver.username}`)}
            className="rounded-lg bg-accent px-3 py-1.5 text-[11px] font-semibold text-white transition-all hover:bg-accent-hover"
          >
            Chat
          </button>
        )}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   VIBES PAGE
   ═══════════════════════════════════════════════════════════ */
export function Vibes() {
  const { profile, requireAuth } = useAuth()
  const [tab, setTab] = useState<'received' | 'sent'>('received')
  const [received, setReceived] = useState<(Vibe & { sender: Profile })[]>([])
  const [sent, setSent] = useState<(Vibe & { receiver: Profile })[]>([])
  const [loading, setLoading] = useState(true)

  async function loadVibes() {
    if (!profile) return
    setLoading(true)
    try {
      const data = await vibesApi.list()
      setReceived(data.received || [])
      setSent(data.sent || [])
    } catch (err) {
      console.error('[Vibes] Load failed:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (profile) loadVibes()
  }, [profile])

  async function handleAccept(vibeId: string) {
    try {
      await vibesApi.respond(vibeId, 'accepted')
      loadVibes()
    } catch (err) {
      console.error('[Vibes] Accept failed:', err)
    }
  }

  async function handleDecline(vibeId: string) {
    try {
      await vibesApi.respond(vibeId, 'declined')
      loadVibes()
    } catch (err) {
      console.error('[Vibes] Decline failed:', err)
    }
  }

  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Inbox className="h-10 w-10 text-text-muted mb-3" />
        <p className="text-sm text-text-secondary">Sign in to see your vibes</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-bold text-text-primary md:text-2xl">Vibes</h1>
        <p className="mt-1 text-sm text-text-secondary">Manage your connect requests.</p>
      </header>

      {/* Tabs */}
      <div className="flex items-center gap-1 rounded-2xl bg-bg-card p-1.5">
        <button
          onClick={() => setTab('received')}
          className={`flex-1 flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-medium transition-all ${
            tab === 'received'
              ? 'bg-accent-muted text-accent shadow-[0_0_12px_rgba(124,58,237,0.15)]'
              : 'text-text-muted hover:bg-bg-card-hover hover:text-text-primary'
          }`}
        >
          <Inbox className="h-3.5 w-3.5" />
          Received
          {received.length > 0 && (
            <span className="ml-1 h-4 min-w-[16px] rounded-full bg-accent px-1 text-[9px] font-bold text-white flex items-center justify-center">
              {received.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('sent')}
          className={`flex-1 flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-medium transition-all ${
            tab === 'sent'
              ? 'bg-accent-muted text-accent shadow-[0_0_12px_rgba(124,58,237,0.15)]'
              : 'text-text-muted hover:bg-bg-card-hover hover:text-text-primary'
          }`}
        >
          <Send className="h-3.5 w-3.5" />
          Sent
          {sent.length > 0 && (
            <span className="ml-1 h-4 min-w-[16px] rounded-full bg-bg-input px-1 text-[9px] font-bold text-text-muted flex items-center justify-center">
              {sent.length}
            </span>
          )}
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-accent" />
        </div>
      ) : tab === 'received' ? (
        received.length > 0 ? (
          <div className="space-y-3">
            {received.map(v => (
              <ReceivedVibeCard
                key={v.id}
                vibe={v}
                onAccept={() => handleAccept(v.id)}
                onDecline={() => handleDecline(v.id)}
              />
            ))}
          </div>
        ) : (
          <div className="animate-fade-in rounded-2xl bg-bg-card p-10 text-center">
            <Inbox className="mx-auto h-8 w-8 text-text-muted mb-2" />
            <p className="text-sm font-medium text-text-primary">No vibes received</p>
            <p className="mt-1 text-xs text-text-muted">When someone sends you a vibe, it will appear here.</p>
          </div>
        )
      ) : sent.length > 0 ? (
        <div className="space-y-3">
          {sent.map(v => (
            <SentVibeCard key={v.id} vibe={v} />
          ))}
        </div>
      ) : (
        <div className="animate-fade-in rounded-2xl bg-bg-card p-10 text-center">
          <Send className="mx-auto h-8 w-8 text-text-muted mb-2" />
          <p className="text-sm font-medium text-text-primary">No vibes sent</p>
          <p className="mt-1 text-xs text-text-muted">Go to Discover to find people and send vibes.</p>
        </div>
      )}
    </div>
  )
}
