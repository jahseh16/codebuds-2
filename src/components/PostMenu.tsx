import { useState, useEffect, useRef } from 'react'
import { MoreHorizontal, Bookmark, BookmarkCheck, Share2, Copy, Pencil, Trash2, Flag, Loader2, VolumeX } from 'lucide-react'

interface PostMenuProps {
  isOwn: boolean
  isSaved: boolean
  onSave: () => void
  onUnsave: () => void
  onEdit: () => void
  onDelete: () => void
  onReport: () => void
  onCopyLink: () => void
  onShare: () => void
  onMute?: () => void
  deleting?: boolean
}

export function PostMenu({
  isOwn,
  isSaved,
  onSave,
  onUnsave,
  onEdit,
  onDelete,
  onReport,
  onCopyLink,
  onShare,
  onMute,
  deleting,
}: PostMenuProps) {
  const [open, setOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close on outside click or Escape
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
        setConfirmDelete(false)
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false)
        setConfirmDelete(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  function handleAction(fn: () => void) {
    setOpen(false)
    setConfirmDelete(false)
    fn()
  }

  function handleDeleteClick() {
    if (confirmDelete) {
      handleAction(onDelete)
    } else {
      setConfirmDelete(true)
    }
  }

  return (
    <div className="relative shrink-0" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        aria-label="More options"
        className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-bg-card-hover hover:text-text-primary"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-52 overflow-hidden rounded-xl bg-bg-card py-1 shadow-xl animate-scale-in">
          {/* Save / Unsave */}
          {isSaved ? (
            <button
              onClick={() => handleAction(onUnsave)}
              aria-label="Unsave post"
              className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-text-primary transition-colors hover:bg-bg-card-hover"
            >
              <BookmarkCheck className="h-4 w-4 text-accent" />
              Unsave post
            </button>
          ) : (
            <button
              onClick={() => handleAction(onSave)}
              aria-label="Save post"
              className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-text-primary transition-colors hover:bg-bg-card-hover"
            >
              <Bookmark className="h-4 w-4 text-text-muted" />
              Save post
            </button>
          )}

          {/* Share */}
          <button
            onClick={() => handleAction(onShare)}
            aria-label="Share post"
            className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-text-primary transition-colors hover:bg-bg-card-hover"
          >
            <Share2 className="h-4 w-4 text-text-muted" />
            Share post
          </button>

          {/* Copy link */}
          <button
            onClick={() => handleAction(onCopyLink)}
            aria-label="Copy link to post"
            className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-text-primary transition-colors hover:bg-bg-card-hover"
          >
            <Copy className="h-4 w-4 text-text-muted" />
            Copy link
          </button>

          <div className="my-1 h-px bg-border-light" />

          {/* Edit — own posts */}
          {isOwn && (
            <button
              onClick={() => handleAction(onEdit)}
              aria-label="Edit post"
              className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-text-primary transition-colors hover:bg-bg-card-hover"
            >
              <Pencil className="h-4 w-4 text-text-muted" />
              Edit post
            </button>
          )}

          {/* Delete — own posts */}
          {isOwn && (
            <button
              onClick={handleDeleteClick}
              disabled={deleting}
              aria-label={confirmDelete ? 'Confirm delete post' : 'Delete post'}
              className={`flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors ${
                confirmDelete
                  ? 'bg-danger/10 text-danger'
                  : 'text-danger hover:bg-danger/10'
              }`}
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              {confirmDelete ? 'Confirm delete' : 'Delete post'}
            </button>
          )}

          {/* Report + Mute — other users */}
          {!isOwn && (
            <>
              <button
                onClick={() => handleAction(onReport)}
                aria-label="Report post"
                className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-danger transition-colors hover:bg-danger/10"
              >
                <Flag className="h-4 w-4" />
                Report post
              </button>
              {onMute && (
                <button
                  onClick={() => handleAction(onMute)}
                  aria-label="Mute user"
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-text-primary transition-colors hover:bg-bg-card-hover"
                >
                  <VolumeX className="h-4 w-4 text-text-muted" />
                  Mute user
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
