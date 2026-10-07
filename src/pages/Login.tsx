import { useState, useEffect, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Mail, Lock, Loader2, ArrowRight, AlertCircle } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { Starfield } from '../components/Starfield'

function handleGitHubLogin() {
  window.location.href = '/api/auth/github'
}

export function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // Handle GitHub OAuth callback
  useEffect(() => {
    const token = searchParams.get('token')
    const userData = searchParams.get('user')
    const authError = searchParams.get('error')

    if (authError) {
      setError(authError === 'no_code' ? 'GitHub authorization was cancelled' : 'GitHub login failed. Please try again.')
      return
    }

    if (token && userData) {
      try {
        const profile = JSON.parse(userData)
        localStorage.setItem('codebuds_token', token)
        localStorage.setItem('codebuds_user', JSON.stringify(profile))
        window.location.href = '/'
      } catch {
        setError('Failed to process GitHub login')
      }
    }
  }, [searchParams])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const result = await signIn(email, password)

    if (result.error) {
      setError(result.error)
      setLoading(false)
    } else {
      navigate('/')
    }
  }

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
            <h1 className="text-xl font-bold text-text-primary font-mono tracking-tight sm:text-2xl">Welcome back</h1>
            <p className="mt-2 text-sm text-text-secondary">
              Sign in to your CodeBuds account
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
          <form onSubmit={handleSubmit} className="space-y-5">
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
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-lg bg-bg-input py-3 pl-11 pr-4 text-sm text-text-primary font-mono transition-all placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 min-h-[44px]"
                />
              </div>
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-500 to-accent py-3.5 text-sm font-bold font-mono text-white tracking-wide transition-all duration-200 hover:from-blue-400 hover:to-accent-hover hover:shadow-[0_0_32px_rgba(124,58,237,0.4)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 min-h-[48px]"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          {/* Divider */}
          <div className="my-7 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs font-medium font-mono text-text-muted">or continue with</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          {/* GitHub Login Button */}
          <button
            type="button"
            onClick={handleGitHubLogin}
            className="flex w-full items-center justify-center gap-3 rounded-lg bg-bg-card-hover py-3 text-sm font-semibold font-mono text-text-primary transition-all duration-200 hover:bg-bg-card hover:shadow-[0_0_20px_rgba(255,255,255,0.04)] min-h-[48px]"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
            Sign in with GitHub
          </button>

          {/* Sign up link */}
          <p className="mt-8 text-center text-sm text-text-secondary">
            Don&apos;t have an account?{' '}
            <Link to="/register" className="font-semibold font-mono text-accent transition-colors hover:text-accent-hover hover:underline">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
