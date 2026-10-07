import { useState, useEffect } from 'react'
import { Loader2, GraduationCap, BookOpen, Send, X, Check, Clock } from 'lucide-react'
import { profiles as profilesApi, mentorships as mentorshipsApi } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import { UserLink } from '../components/UserLink'
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
  const { profile, requireAuth } = useAuth()
  const [mentors, setMentors] = useState<Profile[]>([])
  const [myRequests, setMyRequests] = useState<Mentorship[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState<Profile | null>(null)

  async function load() {
    try {
      const [profilesData, mentorshipsData] = profile
        ? await Promise.all([
            profilesApi.list(profile.id),
            mentorshipsApi.list(),
          ])
        : [await profilesApi.list(), []]

      setMentors(profilesData as Profile[])
      setMyRequests(mentorshipsData as unknown as Mentorship[])
    } catch {
      // ignore
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [profile])

  async function respondMentorship(id: string, status: MentorshipStatus) {
    await mentorshipsApi.update(id, status)
    load()
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-bold text-text-primary md:text-2xl">Mentorship</h1>
        <p className="mt-1 text-sm text-text-secondary">Find a mentor or help others grow.</p>
      </header>

      {/* My mentorship requests */}
      {myRequests.length > 0 && (
        <section className="rounded-2xl bg-bg-card p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-text-primary">
            <Clock className="h-4 w-4 text-accent" />
            My Mentorships
          </h2>
          <div className="space-y-3">
            {myRequests.map((m) => {
              const isMentor = m.mentor_id === profile?.id
              const other = isMentor ? m.mentee : m.mentor
              return (
                <div key={m.id} className="flex items-center gap-3 rounded-xl bg-bg-input p-3">
                  <UserLink
                    userId={other?.id}
                    username={other?.username}
                    name={other?.full_name}
                    avatarUrl={other?.avatar_url}
                    size="sm"
                    showName={false}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-text-primary">
                      {isMentor ? 'Mentee: ' : 'Mentor: '}{' '}
                      <UserLink
                        userId={other?.id}
                        username={other?.username}
                        name={other?.full_name ?? 'Unknown'}
                        avatarUrl={other?.avatar_url}
                        size="sm"
                        showName
                        showUsername={false}
                        className="inline-flex min-w-0"
                      />
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
              <div key={mentor.id} className="animate-fade-in rounded-2xl bg-bg-card p-5 transition-all duration-200">
                <div className="flex items-start gap-3">
                  <UserLink
                    userId={mentor.id}
                    username={mentor.username}
                    name={mentor.full_name}
                    avatarUrl={mentor.avatar_url}
                    size="lg"
                    showName
                    showUsername
                    className="min-w-0"
                  />
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
                  onClick={() => {
                    if (!requireAuth()) return
                    setShowForm(mentor)
                  }}
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
        <div className="rounded-2xl bg-bg-card p-10 text-center sm:p-12 md:p-20">
          <p className="text-base font-medium text-text-primary md:text-lg">No mentors available yet</p>
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
  const [topic, setTopic] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      await mentorshipsApi.create(mentor.id, topic.trim(), message.trim())
      onCreated()
      onClose()
    } catch (err: any) {
      setError(err.message)
    }

    setLoading(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-bg-card p-6 animate-scale-in" onClick={(e) => e.stopPropagation()}>
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
            className="w-full rounded-xl bg-bg-input px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
          />
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Tell them about your goals (optional)"
            rows={3}
            className="w-full resize-none rounded-xl bg-bg-input px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
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
