import { useState, useCallback, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, Lock, Loader2, ArrowRight, AlertCircle, User, AtSign } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { Starfield } from '../components/Starfield'
import { validateUsername, normalizeUsername } from '../lib/username'

export function Register() {
  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [usernameError, setUsernameError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const { signUp } = useAuth()
  const navigate = useNavigate()

  const handleUsernameChange = useCallback((value: string) => {
    // Normalize as user types: trimStart and lowercase
    const normalized = value.trimStart().toLowerCase()
    setUsername(normalized)

    // Validate on every change
    const err = validateUsername(normalized)
    setUsernameError(err)
  }, [])

  const handleUsernameBlur = useCallback(() => {
    const err = validateUsername(username)
    setUsernameError(err)
  }, [username])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    // Validate username before submit
    const usernameErr = validateUsername(username)
    if (usernameErr) {
      setUsernameError(usernameErr)
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setLoading(true)
    const result = await signUp(email, password, username, fullName)

    if (result.error) {
      setError(result.error)
      setLoading(false)
    } else {
      navigate('/login')
    }
  }

  const isUsernameInvalid = !!username && !!usernameError

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-bg-primary px-4 py-8 sm:px-6 overflow-y-auto">
      <Starfield count={70} />

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <Link to="/" className="mb-10 flex items-center justify-center gap-3 group">
          <span className="font-mono text-2xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-[#3b82f6] to-[#7c3aed] transition-all duration-300 group-hover:drop-shadow-[0_0_16px_rgba(124,58,237,0.5)] sm:text-3xl">
            &lt;/&gt;
          </span>
          <span className="text-xl font-bold tracking-tight text-white sm:text-2xl">CodeBuds</span>
        </Link>

        {/* Card */}
        <div className="rounded-2xl bg-bg-card/80 backdrop-blur-xl p-8 sm:p-10 shadow-[0_0_60px_rgba(124,58,237,0.06)]">
          {/* Header */}
          <div className="mb-8 text-center">
            <h1 className="text-xl font-bold text-text-primary font-mono tracking-tight sm:text-2xl">Join CodeBuds</h1>
            <p className="mt-2 text-sm text-text-secondary">
              Create your developer profile
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-5 flex items-center gap-2 rounded-xl bg-danger-muted border border-danger/20 px-4 py-3 text-sm text-danger">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full Name */}
            <div>
              <label htmlFor="fullName" className="mb-2 block text-sm font-medium font-mono text-text-secondary">
                Full Name
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                <input
                  id="fullName"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Jane Developer"
                  className="w-full rounded-lg bg-bg-input py-3 pl-11 pr-4 text-sm text-text-primary font-mono transition-all placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 min-h-[44px]"
                />
              </div>
            </div>

            {/* Username */}
            <div>
              <label htmlFor="username" className="mb-2 block text-sm font-medium font-mono text-text-secondary">
                Username
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-text-muted select-none">@</span>
                <input
                  id="username"
                  type="text"
                  required
                  value={username}
                  onChange={(e) => handleUsernameChange(e.target.value)}
                  onBlur={handleUsernameBlur}
                  placeholder="codebuds.dev"
                  autoComplete="username"
                  className={`w-full rounded-lg bg-bg-input py-3 pl-8 pr-4 text-sm text-text-primary font-mono transition-all placeholder:text-text-muted focus:outline-none focus:ring-2 min-h-[44px] ${
                    isUsernameInvalid
                      ? 'ring-1 ring-danger focus:border-danger focus:ring-danger/20'
                      : 'focus:border-accent focus:ring-accent/20'
                  }`}
                />
              </div>
              {/* Helper or error text */}
              {isUsernameInvalid ? (
                <p className="mt-1.5 flex items-center gap-1.5 text-xs text-danger">
                  <AlertCircle className="h-3 w-3 shrink-0" />
                  {usernameError}
                </p>
              ) : (
                <p className="mt-1.5 text-[11px] text-text-muted">
                  3–20 characters. Letters, numbers, dots, and underscores only.
                </p>
              )}
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="mb-2 block text-sm font-medium font-mono text-text-secondary">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-lg bg-bg-input py-3 pl-11 pr-4 text-sm text-text-primary font-mono transition-all placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 min-h-[44px]"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="mb-2 block text-sm font-medium font-mono text-text-secondary">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                <input
                  id="password"
                  type="password"
                  required
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full rounded-lg bg-bg-input py-3 pl-11 pr-4 text-sm text-text-primary font-mono transition-all placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 min-h-[44px]"
                />
              </div>
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading || isUsernameInvalid}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-500 to-accent py-3.5 text-sm font-bold font-mono text-white tracking-wide transition-all duration-200 hover:from-blue-400 hover:to-accent-hover hover:shadow-[0_0_32px_rgba(124,58,237,0.4)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 min-h-[48px]"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              {loading ? 'Creating account...' : 'Create account'}
            </button>
          </form>

          {/* Sign in link */}
          <p className="mt-8 text-center text-sm text-text-secondary">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold font-mono text-accent transition-colors hover:text-accent-hover hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
