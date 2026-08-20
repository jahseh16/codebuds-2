import { useState, useEffect } from 'react'
import { Loader2, Bell, Check, Heart, UserPlus, GraduationCap } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { AppNotification, NotificationType } from '../lib/types'

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}

const ICONS: Record<NotificationType, typeof Bell> = {
  buddy_request: UserPlus,
  buddy_accepted: UserPlus,
  like: Heart,
  mentorship_request: GraduationCap,
  mentorship_accepted: GraduationCap,
}

const ICON_COLORS: Record<NotificationType, string> = {
  buddy_request: 'text-accent bg-accent-muted',
  buddy_accepted: 'text-success bg-success-muted',
  like: 'text-danger bg-danger-muted',
  mentorship_request: 'text-secondary bg-secondary-muted',
  mentorship_accepted: 'text-success bg-success-muted',
}

export function Notifications() {
  const { session } = useAuth()
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    if (!session?.user) return
    const { data } = await supabase
      .from('notifications')
      .select('*, actor:profiles(*)')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(50)

    if (data) setNotifications(data as unknown as AppNotification[])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [session?.user])

  async function markAllRead() {
    if (!session?.user) return
    await supabase.from('notifications').update({ is_read: true })
      .eq('user_id', session.user.id).eq('is_read', false)
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Notifications</h1>
          <p className="mt-1 text-sm text-text-secondary">
            {unreadCount > 0 ? `${unreadCount} unread` : 'You are all caught up'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-text-secondary transition-colors hover:border-border-light hover:text-text-primary"
          >
            <Check className="h-3.5 w-3.5" />
            Mark all read
          </button>
        )}
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-accent" />
        </div>
      ) : notifications.length > 0 ? (
        <div className="space-y-2">
          {notifications.map((n) => {
            const Icon = ICONS[n.type] ?? Bell
            return (
              <div
                key={n.id}
                className={`flex items-center gap-3 rounded-xl border p-4 transition-colors ${
                  n.is_read
                    ? 'border-border bg-bg-card'
                    : 'border-accent/20 bg-accent-muted/30'
                }`}
              >
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${ICON_COLORS[n.type] ?? 'text-text-muted bg-bg-card-hover'}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-text-primary">
                    {n.actor?.full_name ?? 'Someone'}{' '}
                    <span className="text-text-secondary">{n.message}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-text-muted">{timeAgo(n.created_at)}</p>
                </div>
                {!n.is_read && <div className="h-2 w-2 shrink-0 rounded-full bg-accent" />}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-bg-card p-20 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-muted">
            <Bell className="h-8 w-8 text-accent" />
          </div>
          <p className="text-lg font-medium text-text-primary">No notifications</p>
          <p className="mt-1 text-sm text-text-muted">You will see updates here when people interact with you.</p>
        </div>
      )}
    </div>
  )
}
