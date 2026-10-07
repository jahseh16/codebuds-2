import { NavLink, Link } from 'react-router-dom'
import {
  Home,
  Users,
  BookOpen,
  Bell,
  Settings,
  Code2,
  LogOut,
  Rocket,
  X,
  LogIn,
  UserPlus,
  MessageCircle,
  Heart,
  Compass,
  Inbox,
  Newspaper,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useChat } from '../contexts/ChatContext'
import { UserLink } from './UserLink'

interface NavItem {
  to: string
  icon: typeof Home
  label: string
}

const NAV_ITEMS: readonly NavItem[] = [
  { to: '/', icon: Newspaper, label: 'Feed' },
  { to: '/discover', icon: Compass, label: 'Discover' },
  { to: '/matches', icon: Heart, label: 'Matches' },
  { to: '/vibes', icon: Inbox, label: 'Vibes' },
  { to: '/projects', icon: Rocket, label: 'Projects' },
  { to: '/messages', icon: MessageCircle, label: 'Messages' },
  { to: '/notifications', icon: Bell, label: 'Notifications' },
]

function navLinkClasses({ isActive }: { isActive: boolean }): string {
  return [
    'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200',
    isActive
      ? 'bg-accent-muted text-accent shadow-[inset_0_0_20px_rgba(124,58,237,0.08)]'
      : 'text-text-secondary hover:bg-bg-card-hover hover:text-text-primary',
  ].join(' ')
}

interface SidebarProps {
  open?: boolean
  onClose?: () => void
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const { profile, signOut, token } = useAuth()
  const { totalUnread, unreadNotifications } = useChat()
  const isGuest = !token
  const displayName = profile?.full_name || profile?.username || 'User'

  const sidebarContent = (
    <>
      {/* Mobile close button */}
      <div className="flex items-center justify-between px-4 py-4 md:hidden">
        <NavLink to="/" className="flex items-center gap-2.5 group" onClick={onClose}>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent shadow-[0_0_14px_rgba(124,58,237,0.25)] transition-all duration-200 group-hover:shadow-[0_0_24px_rgba(124,58,237,0.4)]">
            <Code2 className="h-4.5 w-4.5 text-white" />
          </div>
          <span className="text-lg font-semibold tracking-tight text-text-primary">
            CodeBuds
          </span>
        </NavLink>
        <button
          onClick={onClose}
          className="flex h-10 w-10 items-center justify-center rounded-xl text-text-muted transition-colors duration-150 hover:bg-bg-card-hover hover:text-text-primary active:scale-95"
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Desktop logo */}
      <div className="hidden p-5 md:block">
        <NavLink to="/" className="flex items-center gap-2.5 group">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent shadow-[0_0_14px_rgba(124,58,237,0.2)] transition-all duration-200 group-hover:shadow-[0_0_24px_rgba(124,58,237,0.4)]">
            <Code2 className="h-5 w-5 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-bold tracking-tight text-text-primary">
              CodeBuds
            </span>
            <span className="text-[10px] font-medium uppercase tracking-widest text-accent">
              Developer Hub
            </span>
          </div>
        </NavLink>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} end={to === '/'} className={navLinkClasses} onClick={onClose}>
            <Icon className="h-5 w-5" />
            {label}
            {to === '/messages' && totalUnread > 0 && (
              <span className="ml-auto h-5 min-w-[20px] rounded-full bg-danger px-1.5 text-[10px] font-bold text-white flex items-center justify-center">
                {totalUnread > 99 ? '99+' : totalUnread}
              </span>
            )}
            {to === '/notifications' && unreadNotifications > 0 && (
              <span className="ml-auto h-5 min-w-[20px] rounded-full bg-danger px-1.5 text-[10px] font-bold text-white flex items-center justify-center">
                {unreadNotifications > 99 ? '99+' : unreadNotifications}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="p-3">
        {isGuest ? (
          <div className="space-y-2">
            <Link
              to="/login"
              onClick={onClose}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-2.5 text-sm font-semibold text-white transition-all hover:bg-accent-hover hover:shadow-[0_0_16px_rgba(124,58,237,0.3)]"
            >
              <LogIn className="h-4 w-4" />
              Sign In
            </Link>
            <Link
              to="/register"
              onClick={onClose}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-bg-card-hover py-2.5 text-sm font-semibold text-text-primary transition-all hover:bg-bg-card"
            >
              <UserPlus className="h-4 w-4" />
              Sign Up
            </Link>
          </div>
        ) : (
          <>
            <NavLink to="/settings" className={navLinkClasses} onClick={onClose}>
              <Settings className="h-5 w-5" />
              Settings
            </NavLink>

            <Link
              to="/profile"
              onClick={onClose}
              className="mt-3 flex items-center gap-3 rounded-xl px-3 py-2.5 cursor-pointer transition-colors hover:bg-bg-card-hover group"
            >
              <UserLink
                userId={profile?.id}
                username={profile?.username}
                name={displayName}
                avatarUrl={profile?.avatar_url}
                size="sm"
                showName
                showUsername
                className="min-w-0 flex-1 pointer-events-none"
                disableNavigate
              />

              <button
                onClick={(e) => { e.stopPropagation(); e.preventDefault(); signOut(); }}
                title="Sign out"
                className="rounded-lg p-1.5 text-text-muted transition-all duration-200 hover:bg-danger-muted hover:text-danger relative z-10"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </Link>
          </>
        )}
      </div>
    </>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden h-screen w-64 shrink-0 flex-col bg-bg-card md:flex">
        {sidebarContent}
      </aside>

      {/* Mobile drawer overlay */}
      {open && (
        <div
          className="fixed inset-0 z-50 md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
            onClick={onClose}
            aria-hidden="true"
          />
          {/* Drawer panel — no border, shadow for depth */}
          <aside className="absolute inset-y-0 left-0 flex w-[min(84vw,320px)] flex-col bg-bg-card shadow-2xl animate-slide-in-left">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  )
}
