import { Component, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'

interface Props {
  children: ReactNode
  /** Fallback UI shown on error */
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('[ErrorBoundary] Caught:', error, errorInfo)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  handleGoHome = () => {
    this.setState({ hasError: false, error: null })
    window.location.href = '/'
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-danger-muted">
            <AlertTriangle className="h-7 w-7 text-danger" />
          </div>
          <h2 className="text-lg font-bold text-text-primary">Something went wrong</h2>
          <p className="mt-2 text-sm text-text-secondary max-w-xs">
            An unexpected error occurred. Your data is safe — try refreshing or go back to the feed.
          </p>
          <div className="mt-6 flex gap-3">
            <button
              onClick={this.handleRetry}
              className="flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-accent-hover"
            >
              <RefreshCw className="h-4 w-4" />
              Try again
            </button>
            <button
              onClick={this.handleGoHome}
              className="flex items-center gap-2 rounded-xl bg-bg-input px-5 py-2.5 text-sm font-medium text-text-secondary transition-all hover:bg-bg-card-hover hover:text-text-primary"
            >
              <Home className="h-4 w-4" />
              Back to Feed
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
