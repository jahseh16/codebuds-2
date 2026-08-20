import { useState, useEffect } from 'react'
import { Loader2, GraduationCap, BookOpen, Send, X, Check, Clock } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { Profile, Mentorship, MentorshipStatus } from '../lib/types'

function getInitials(name: string): string {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
}

const STATUS_STYLES: Record<MentorshipStatus, string> = {
  pending: 'bg-warning-muted text-warning',
  accepted: 'bg-success-muted text-success',
  declined: 'bg-danger-muted text-danger',
  completed: 'bg-accent-muted text-accent',
}

export function Mentorship() {
  const { session } = useAuth()
  const [mentors, setMentors] = useState<Profile[]>([])
  const [myRequests, setMyRequests] = useState<Mentorship[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState<Profile | null>(null)

  async function load() {
    if (!session?.user) return

    const [profilesRes, mentorshipsRes] = await Promise.all([
      supabase.from('profiles').select('*').neq('id', session.user.id),
      supabase.from('mentorships').select('*, mentor:profiles!mentor_id(*), mentee:profiles!mentee_id(*)')
        .or(`mentee_id.eq.${session.user.id},mentor_id.eq.${session.user.id}`),
    ])

    if (profilesRes.data) setMentors(profilesRes.data as Profile[])
    if (mentorshipsRes.data) setMyRequests(mentorshipsRes.data as unknown as Mentorship[])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [session?.user])

  async function respondMentorship(id: string, status: MentorshipStatus) {
    await supabase.from('mentorships').update({ status }).eq('id', id)
    load()
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-text-primary">Mentorship</h1>
        <p className="mt-1 text-sm text-text-secondary">Find a mentor or help others grow.</p>
      </header>

      {/* My mentorship requests */}
      {myRequests.length > 0 && (
        <section className="rounded-2xl border border-border bg-bg-card p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-text-primary">
            <Clock className="h-4 w-4 text-accent" />
            My Mentorships
          </h2>
          <div className="space-y-3">
            {myRequests.map((m) => {
              const isMentor = m.mentor_id === session?.user?.id
              const other = isMentor ? m.mentee : m.mentor
              return (
                <div key={m.id} className="flex items-center gap-3 rounded-xl border border-border p-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full border border-accent/20 bg-accent/10 text-xs font-bold text-accent">
                    {other?.avatar_url ? (
                      <img src={other.avatar_url} alt={other.full_name} className="h-full w-full rounded-full object-cover" />
                    ) : (
                      getInitials(other?.full_name ?? 'U')
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-text-primary">
                      {isMentor ? 'Mentee: ' : 'Mentor: '}{other?.full_name ?? 'Unknown'}
                    </p>
                    <p className="truncate text-xs text-text-muted">{m.topic}</p>
                  </div>
                  <span className={`rounded-md px-2 py-0.5 text-[10px] font-medium uppercase ${STATUS_STYLES[m.status]}`}>
                    {m.status}
                  </span>
                  {isMentor && m.status === 'pending' && (
                    <button
                      onClick={() => respondMentorship(m.id, 'accepted')}
                      className="rounded-lg bg-success px-2 py-1 text-xs font-semibold text-white transition-colors hover:bg-success/80"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Available mentors */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-accent" />
        </div>
      ) : mentors.length > 0 ? (
        <div>
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-text-primary">
            <GraduationCap className="h-4 w-4 text-accent" />
            Available Mentors
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {mentors.map((mentor) => (
              <div key={mentor.id} className="animate-fade-in rounded-2xl border border-border bg-bg-card p-5 transition-all duration-200 hover:border-border-light">
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-accent/20 bg-accent/10 text-base font-bold text-accent">
                    {mentor.avatar_url ? (
                      <img src={mentor.avatar_url} alt={mentor.full_name} className="h-full w-full rounded-full object-cover" />
                    ) : (
                      getInitials(mentor.full_name)
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-text-primary">{mentor.full_name}</p>
                    <p className="truncate text-xs text-text-muted">@{mentor.username}</p>
                  </div>
                </div>

                {mentor.bio && <p className="mt-3 text-sm text-text-secondary">{mentor.bio}</p>}

                {mentor.skills.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {mentor.skills.slice(0, 4).map((skill) => (
                      <span key={skill} className="rounded-md bg-accent-muted px-2 py-1 text-[11px] font-medium text-accent">
                        {skill}
                      </span>
                    ))}
                  </div>
                )}

                <button
                  onClick={() => setShowForm(mentor)}
                  className="mt-4 flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-white transition-all hover:bg-accent-hover"
                >
                  <BookOpen className="h-3.5 w-3.5" />
                  Request Mentorship
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-bg-card p-20 text-center">
          <p className="text-lg font-medium text-text-primary">No mentors available yet</p>
          <p className="mt-1 text-sm text-text-muted">Check back later as more developers join.</p>
        </div>
      )}

      {/* Mentorship request form */}
      {showForm && (
        <MentorshipForm
          mentor={showForm}
          onCreated={load}
          onClose={() => setShowForm(null)}
        />
      )}
    </div>
  )
}

function MentorshipForm({ mentor, onCreated, onClose }: { mentor: Profile; onCreated: () => void; onClose: () => void }) {
  const { session } = useAuth()
  const [topic, setTopic] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!session?.user) return
    setLoading(true)
    setError('')

    const { error: insertError } = await supabase.from('mentorships').insert({
      mentor_id: mentor.id,
      mentee_id: session.user.id,
      topic: topic.trim(),
      message: message.trim(),
    })

    setLoading(false)

    if (insertError) {
      setError(insertError.message)
      return
    }

    await supabase.from('notifications').insert({
      user_id: mentor.id,
      actor_id: session.user.id,
      type: 'mentorship_request',
      message: `requested mentorship on ${topic.trim()}`,
    })

    onCreated()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-border bg-bg-card p-6 animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text-primary">Request Mentorship from {mentor.full_name}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-bg-card-hover hover:text-text-primary">
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && <p className="mb-3 rounded-lg bg-danger-muted px-3 py-2 text-xs text-danger">{error}</p>}

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            required
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="What do you want to learn?"
            className="w-full rounded-xl border border-border bg-bg-input px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
          />
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Tell them about your goals (optional)"
            rows={3}
            className="w-full resize-none rounded-xl border border-border bg-bg-input px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
          />
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-accent-hover disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Send Request
          </button>
        </form>
      </div>
    </div>
  )
}
