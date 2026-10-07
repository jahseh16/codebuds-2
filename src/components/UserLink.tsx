import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { AvatarModal } from './AvatarModal'
import { getAvatarUrl } from '../lib/utils'
import { displayUsername } from '../lib/username'

function getInitials(name?: string | null): string {
  if (!name) return 'U'
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
}

interface UserLinkProps {
  /** User ID */
  userId?: string
  /** Username for /profile/:username route */
  username?: string | null
  /** Display name */
  name?: string | null
  /** Avatar URL */
  avatarUrl?: string | null
  /** Size: 'sm' | 'md' | 'lg' */
  size?: 'sm' | 'md' | 'lg'
  /** Show full name text next to avatar */
  showName?: boolean
  /** Show @username under name */
  showUsername?: boolean
  /** Extra content rendered after name */
  children?: ReactNode
  /** Additional classes on the wrapper */
  className?: string
  /** Whether to prevent navigation (e.g. on own profile) */
  disableNavigate?: boolean
}

const SIZE_CLASSES = {
  sm: { avatar: 'h-7 w-7 text-[10px]', name: 'text-xs', username: 'text-[10px]' },
  md: { avatar: 'h-10 w-10 text-sm', name: 'text-sm', username: 'text-xs' },
  lg: { avatar: 'h-12 w-12 text-base', name: 'text-sm', username: 'text-xs' },
}

export function UserLink({
  userId,
  username,
  name,
  avatarUrl,
  size = 'md',
  showName = true,
  showUsername = false,
  children,
  className = '',
  disableNavigate = false,
}: UserLinkProps) {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [modalOpen, setModalOpen] = useState(false)

  const isOwn = profile?.id === userId || profile?.username === username
  const s = SIZE_CLASSES[size]
  const profilePath = username ? `/profile/${username}` : '/profile'
  const resolvedAvatar = getAvatarUrl(avatarUrl, username)

  function handleAvatarClick(e: React.MouseEvent) {
    e.stopPropagation()
    e.preventDefault()
    if (avatarUrl) {
      setModalOpen(true)
    } else if (!disableNavigate && !isOwn) {
      navigate(profilePath)
    }
  }

  function handleNameClick(e: React.MouseEvent) {
    e.stopPropagation()
    e.preventDefault()
    if (!disableNavigate && !isOwn) {
      navigate(profilePath)
    }
  }

  function handleWrapperClick() {
    if (!disableNavigate && !isOwn && username) {
      navigate(profilePath)
    }
  }

  const avatarContent = (
    <img src={resolvedAvatar} alt={name || 'User'} className="h-full w-full rounded-full object-cover" />
  )

  return (
    <>
      <div
        className={`flex items-center gap-3 ${!disableNavigate && !isOwn ? 'cursor-pointer' : ''} ${className}`}
        onClick={handleWrapperClick}
      >
        {/* Avatar */}
        <div
          className={`relative shrink-0 items-center justify-center overflow-hidden rounded-full border border-accent/20 bg-accent/10 font-bold text-accent transition-all duration-300 hover:border-accent hover:shadow-[0_0_16px_rgba(124,58,237,0.3)] ${s.avatar} ${
            avatarUrl ? 'cursor-pointer' : !disableNavigate && !isOwn ? 'cursor-pointer' : ''
          }`}
          onClick={handleAvatarClick}
          title={avatarUrl ? 'View photo' : undefined}
        >
          {avatarContent}
        </div>

        {/* Text */}
        {showName && (
          <div className="min-w-0 flex-1">
            <p
              className={`truncate font-semibold text-text-primary ${s.name} ${
                !disableNavigate && !isOwn ? 'cursor-pointer hover:text-accent transition-colors' : ''
              }`}
              onClick={handleNameClick}
            >
              {name || 'Unknown'}
            </p>
            {showUsername && username && (
              <p className={`truncate text-text-muted ${s.username}`}>@{displayUsername(username)}</p>
            )}
            {children}
          </div>
        )}
      </div>

      {/* Avatar modal */}
      {modalOpen && avatarUrl && (
        <AvatarModal
          src={avatarUrl}
          alt={name || 'User avatar'}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  )
}
