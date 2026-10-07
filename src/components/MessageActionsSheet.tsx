import { useEffect, useRef, useState } from 'react'
import { Reply, Copy, Trash2 } from 'lucide-react'
import type { ChatMessage } from '../contexts/ChatContext'

/**
 * Menú de acciones de un mensaje.
 *
 * - Móvil: bottom sheet fijo abajo con overlay semitransparente, slide-up,
 *   arrastrable hacia abajo para cerrar, Escape / backdrop / acción lo cierran.
 *   El `body scroll lock` es temporal y se restaura siempre al desmontar.
 * - Desktop (md+): se muestra como card centrada (popover), como antes.
 *
 * No toca WebSocket, ChatContext ni las rutas: solo notifica mediante callbacks.
 */
export function MessageActionsSheet({
  msg,
  isMine,
  copied,
  onReply,
  onReact,
  onCopy,
  onDelete,
  onClose,
}: {
  msg: ChatMessage
  isMine: boolean
  copied: boolean
  onReply: () => void
  onReact: (emoji: string) => void
  onCopy: () => void
  onDelete: (scope: 'me' | 'everyone') => void
  onClose: () => void
}) {
  const [dragY, setDragY] = useState(0)
  const dragRef = useRef({ active: false, startY: 0 })

  // Body scroll lock temporal → se restaura el valor anterior al cerrar
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  // Escape cierra el sheet
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Arrastrar hacia abajo para cerrar (solo desde la zona del handle)
  const startDrag = (e: React.PointerEvent) => {
    dragRef.current = { active: true, startY: e.clientY }
    try {
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    } catch {
      /* sin pointer capture disponible */
    }
  }
  const moveDrag = (e: React.PointerEvent) => {
    if (!dragRef.current.active) return
    const dy = e.clientY - dragRef.current.startY
    setDragY(dy > 0 ? Math.min(dy, 320) : 0)
  }
  const endDrag = () => {
    if (!dragRef.current.active) return
    dragRef.current.active = false
    if (dragY > 70) onClose()
    else setDragY(0)
  }

  const itemCls =
    'flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors'
  const dangerCls = 'text-red-400 hover:bg-red-500/10'
  const normalCls = 'text-text-primary hover:bg-bg-card-hover'

  // El backdrop cierra con onPointerDown (no onClick): el long-press que ABRE
  // el sheet termina con un click fantasma en las coordenadas del dedo; si el
  // backdrop cerrara con click, el sheet se cerraría solo al soltar el dedo.
  // Con pointerdown ese gesto original nunca llega al backdrop (su pointerdown
  // fue en la burbuja).
  return (
    <div
      className="fixed inset-0 z-[92] flex items-end justify-center bg-black/60 animate-fade-in motion-reduce:animate-none md:items-center"
      onPointerDown={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Message actions: ${msg.text.slice(0, 60)}`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => {
          // stopPropagation protege el backdrop; además TODA la card es zona de
          // arrastre (el handle de 12px solo era visual): un gesto que empiece
          // en cualquier hijo (botón, texto) burbujea aquí.
          e.stopPropagation()
          startDrag(e)
        }}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        style={{
          touchAction: 'none',
          ...(dragY > 0 ? { transform: `translateY(${dragY}px)` } : {}),
        }}
        className={`safe-area-bottom w-full max-w-md overflow-hidden rounded-t-3xl border-t border-border-light bg-bg-card px-2 pb-3 pt-2 shadow-[0_-16px_48px_rgba(0,0,0,0.55)] md:mx-4 md:my-auto md:rounded-2xl md:border md:p-2 md:shadow-2xl ${
          dragY > 0 ? 'transition-none' : 'transition-transform duration-200 ease-out motion-reduce:transition-none'
        } ${dragY > 0 ? '' : 'animate-sheet-up md:animate-scale-in'}`}
      >
        {/* Handle de arrastre (solo móvil, visual: los handlers están en la card) */}
        <div className="flex justify-center pb-1 pt-1 md:hidden" aria-hidden="true">
          <span className="h-1 w-10 rounded-full bg-border" />
        </div>

        {/* Reacciones rápidas */}
        <div className="flex items-center justify-center gap-1 pb-1">
          {['❤️', '👍', '😂'].map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => onReact(emoji)}
              aria-label={`React ${emoji}`}
              className="flex h-11 w-11 items-center justify-center rounded-xl text-lg transition-transform hover:scale-110 hover:bg-bg-card-hover active:scale-95 motion-reduce:transform-none"
            >
              {emoji}
            </button>
          ))}
        </div>

        <div className="my-1 h-px bg-border-light" />

        <button type="button" onClick={onReply} className={`${itemCls} ${normalCls}`}>
          <Reply className="h-4 w-4" />
          Reply
        </button>
        <button type="button" onClick={onCopy} className={`${itemCls} ${normalCls}`}>
          <Copy className="h-4 w-4" />
          {copied ? 'Copied!' : 'Copy'}
        </button>

        <div className="my-1 h-px bg-border-light" />

        <button type="button" onClick={() => onDelete('me')} className={`${itemCls} ${dangerCls}`}>
          <Trash2 className="h-4 w-4" />
          Delete for me
        </button>
        {isMine && (
          <button
            type="button"
            onClick={() => onDelete('everyone')}
            className={`${itemCls} ${dangerCls}`}
          >
            <Trash2 className="h-4 w-4" />
            Delete for everyone
          </button>
        )}
      </div>
    </div>
  )
}
