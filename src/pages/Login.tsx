import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, Lock, Loader2, ArrowRight, Code2, AlertCircle } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

function handleGitHubLogin() {
  const clientId = 'Ov23liilGD6wXb6Asu0J'
  const redirectUri = 'https://api.devmatrixs.lat/api/auth/github/callback'
  window.location.href = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=user:email`
}

export function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { signIn } = useAuth()
  const navigate = useNavigate()

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
    <div className="relative flex min-h-screen items-center justify-center bg-bg-primary px-4">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/5 blur-[120px]" />
        <div className="absolute bottom-0 left-1/4 h-[400px] w-[400px] rounded-full bg-secondary/5 blur-[100px]" />
      </div>

      <div className="relative w-full max-w-md">
        <Link to="/" className="mb-8 flex items-center justify-center gap-3 group">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent transition-all duration-300 group-hover:shadow-[0_0_32px_rgba(20,184,166,0.5)]">
            <Code2 className="h-6 w-6 text-white" />
          </div>
          <span className="text-2xl font-bold tracking-tight text-text-primary">CodeBuds</span>
        </Link>

        <div className="card-glow rounded-3xl border border-border bg-bg-card p-8">
          <div className="mb-6 text-center">
            <h1 className="text-xl font-bold text-text-primary">Welcome back</h1>
            <p className="mt-1 text-sm text-text-secondary">Sign in to your CodeBuds account</p>
          </div>

          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-xl bg-danger-muted px-4 py-3 text-sm text-danger">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-text-secondary">Email</label>
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
                  className="w-full rounded-xl border border-border bg-bg-input py-3 pl-11 pr-4 text-sm text-text-primary transition-all placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-text-secondary">Password</label>
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
                  className="w-full rounded-xl border border-border bg-bg-input py-3 pl-11 pr-4 text-sm text-text-primary transition-all placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-3 text-sm font-semibold text-white transition-all duration-200 hover:bg-accent-hover hover:shadow-[0_0_24px_rgba(20,184,166,0.35)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          {/* Divider */}
          <div className="mt-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs font-medium text-text-muted">or continue with</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          {/* GitHub Login Button */}
          <button
            type="button"
            onClick={handleGitHubLogin}
            className="mt-4 flex w-full items-center justify-center gap-3 rounded-xl border border-border bg-bg-card-hover py-3 text-sm font-semibold text-text-primary transition-all duration-200 hover:border-border-light hover:bg-[#21262d] hover:shadow-[0_0_20px_rgba(255,255,255,0.06)]"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
            Sign in with GitHub
          </button>

          <p className="mt-6 text-center text-sm text-text-secondary">
            Don't have an account?{' '}
            <Link to="/register" className="font-semibold text-accent transition-colors hover:text-accent-hover">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
