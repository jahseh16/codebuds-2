import { Component, type ReactNode, type ErrorInfo } from 'react'
import { MessageCircle, AlertTriangle } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

/**
 * Error Boundary for the Messages view.
 * Catches any unhandled render exception and shows a professional fallback
 * instead of a black/empty screen. This is a safety net — the root cause
 * should always be fixed at the source.
 */
export class ChatErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ChatErrorBoundary] Render error caught:', error, errorInfo)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  handleBack = () => {
    this.setState({ hasError: false, error: null })
    window.location.href = '/messages'
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full flex-col items-center justify-center bg-bg-primary px-6 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10 mb-4">
            <AlertTriangle className="h-8 w-8 text-red-400" />
          </div>
          <h2 className="text-lg font-bold text-text-primary">Messages couldn't load</h2>
          <p className="mt-2 max-w-sm text-sm text-text-secondary">
            Your conversation is safe. Try reloading this view.
          </p>
          <div className="mt-6 flex items-center gap-3">
            <button
              onClick={this.handleRetry}
              className="flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-accent-hover hover:shadow-[0_0_16px_rgba(124,58,237,0.3)]"
            >
              Try again
            </button>
            <button
              onClick={this.handleBack}
              className="flex items-center gap-2 rounded-xl border border-border px-5 py-2.5 text-sm font-medium text-text-secondary transition-all hover:bg-bg-card-hover hover:text-text-primary"
            >
              <MessageCircle className="h-4 w-4" />
              Back to messages
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
