import { useState, useEffect } from 'react'
import { Loader2, Save, Check } from 'lucide-react'
import { profiles as profilesApi } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'

export function Settings() {
  const { profile, refreshProfile } = useAuth()
  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [bio, setBio] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [githubUrl, setGithubUrl] = useState('')
  const [linkedinUrl, setLinkedinUrl] = useState('')
  const [location, setLocation] = useState('')
  const [skills, setSkills] = useState('')
  const [openTo, setOpenTo] = useState('collaboration')
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name)
      setUsername(profile.username)
      setBio(profile.bio)
      setAvatarUrl(profile.avatar_url ?? '')
      setGithubUrl(profile.github_url ?? '')
      setLinkedinUrl(profile.linkedin_url ?? '')
      setLocation(profile.location)
      setSkills(profile.skills.join(', '))
      setOpenTo(profile.open_to)
    }
  }, [profile])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!profile) return
    setLoading(true)
    setSaved(false)

    try {
      await profilesApi.update(profile.id, {
        full_name: fullName.trim(),
        username: username.trim(),
        bio: bio.trim(),
        avatar_url: avatarUrl.trim() || null,
        github_url: githubUrl.trim() || null,
        linkedin_url: linkedinUrl.trim() || null,
        location: location.trim(),
        skills: skills.split(',').map((s) => s.trim()).filter(Boolean),
        open_to: openTo,
      })
      setSaved(true)
      refreshProfile()
      setTimeout(() => setSaved(false), 3000)
    } catch {
      // ignore
    }

    setLoading(false)
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-accent" />
      </div>
    )
  }

  const inputClass = 'w-full rounded-xl border border-border bg-bg-input px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted transition-all focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20'

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-text-primary">Settings</h1>
        <p className="mt-1 text-sm text-text-secondary">Update your profile and preferences.</p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Profile section */}
        <section className="rounded-2xl border border-border bg-bg-card p-5">
          <h2 className="mb-4 text-sm font-semibold text-text-primary">Profile</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-text-secondary">Full Name</label>
                <input value={fullName} onChange={(e) => setFullName(e.target.value)} required className={inputClass} />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-text-secondary">Username</label>
                <input value={username} onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))} required className={inputClass} />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-text-secondary">Bio</label>
              <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} placeholder="Tell others about yourself" className={`${inputClass} resize-none`} />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-text-secondary">Avatar URL</label>
              <input value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://..." className={inputClass} />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-text-secondary">Skills (comma separated)</label>
              <input value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="React, Python, AWS" className={inputClass} />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-text-secondary">Location</label>
                <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="San Francisco, CA" className={inputClass} />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-text-secondary">Open To</label>
                <select value={openTo} onChange={(e) => setOpenTo(e.target.value)} className={inputClass}>
                  <option value="collaboration">Collaboration</option>
                  <option value="jobs">Job Opportunities</option>
                  <option value="mentorship">Mentorship</option>
                  <option value="networking">Networking</option>
                </select>
              </div>
            </div>
          </div>
        </section>

        {/* Links section */}
        <section className="rounded-2xl border border-border bg-bg-card p-5">
          <h2 className="mb-4 text-sm font-semibold text-text-primary">Links</h2>
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text-secondary">GitHub URL</label>
              <input value={githubUrl} onChange={(e) => setGithubUrl(e.target.value)} placeholder="https://github.com/..." className={inputClass} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text-secondary">LinkedIn URL</label>
              <input value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)} placeholder="https://linkedin.com/in/..." className={inputClass} />
            </div>
          </div>
        </section>

        {/* Save button */}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-accent-hover hover:shadow-[0_0_24px_rgba(20,184,166,0.35)] disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Changes
          </button>
          {saved && (
            <span className="flex items-center gap-1 text-sm text-success animate-fade-in">
              <Check className="h-4 w-4" />
              Saved
            </span>
          )}
        </div>
      </form>
    </div>
  )
}
