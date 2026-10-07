import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

interface SafeModalProps {
  open: boolean
  onClose: () => void
  children: ReactNode
  /** z-index layer: 'drawer'=50, 'modal'=60, 'follow-modal'=70, 'likes'=80, 'avatar'=100 */
  zIndex?: number
  /** Max width class */
  maxWidth?: string
  /** Show close X button */
  showClose?: boolean
  /** Prevent closing on backdrop click */
  disableBackdropClose?: boolean
}

export function SafeModal({
  open,
  onClose,
  children,
  zIndex = 60,
  maxWidth = 'max-w-md',
  showClose = false,
  disableBackdropClose = false,
}: SafeModalProps) {
  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev || ''
    }
  }, [open])

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
      style={{ zIndex }}
      onClick={disableBackdropClose ? undefined : onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`w-full ${maxWidth} bg-bg-card rounded-2xl shadow-2xl animate-scale-in relative`}
        onClick={(e) => e.stopPropagation()}
      >
        {showClose && (
          <button
            onClick={onClose}
            className="absolute top-3 right-3 z-10 rounded-lg p-1.5 text-text-muted transition-colors hover:bg-bg-card-hover hover:text-text-primary"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        {children}
      </div>
    </div>,
    document.body
  )
}
