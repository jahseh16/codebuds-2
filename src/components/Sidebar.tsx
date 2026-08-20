import { NavLink } from 'react-router-dom'
import {
  Home,
  Users,
  BookOpen,
  Bell,
  Settings,
  Code2,
  LogOut,
  Rocket,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

interface NavItem {
  to: string
  icon: typeof Home
  label: string
}

const NAV_ITEMS: readonly NavItem[] = [
  { to: '/', icon: Home, label: 'Feed' },
  { to: '/developers', icon: Users, label: 'Buddies' },
  { to: '/projects', icon: Rocket, label: 'Projects' },
  { to: '/mentorship', icon: BookOpen, label: 'Mentorship' },
  { to: '/notifications', icon: Bell, label: 'Notifications' },
]

function getInitials(name?: string | null): string {
  if (!name) return 'U'
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
}

function navLinkClasses({ isActive }: { isActive: boolean }): string {
  return [
    'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200',
    isActive
      ? 'bg-accent-muted text-accent shadow-[inset_0_0_20px_rgba(20,184,166,0.08)]'
      : 'text-text-secondary hover:bg-bg-card-hover hover:text-text-primary',
  ].join(' ')
}

export function Sidebar() {
  const { profile, signOut } = useAuth()
  const displayName = profile?.full_name || profile?.username || 'User'

  return (
    <aside className="hidden h-screen w-64 shrink-0 flex-col border-r border-border bg-bg-card md:flex">
      <div className="border-b border-border p-5">
        <NavLink to="/" className="flex items-center gap-2.5 group">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent transition-all duration-300 group-hover:shadow-[0_0_24px_rgba(20,184,166,0.4)]">
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
          <NavLink key={to} to={to} end={to === '/'} className={navLinkClasses}>
            <Icon className="h-5 w-5" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-border p-3">
        <NavLink to="/settings" className={navLinkClasses}>
          <Settings className="h-5 w-5" />
          Settings
        </NavLink>

        <div className="mt-3 flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-bg-card-hover">
          <div className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-accent/30 bg-accent/20 text-sm font-bold text-accent transition-all duration-300 hover:border-accent hover:shadow-[0_0_16px_rgba(20,184,166,0.3)]">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt={displayName} className="h-full w-full object-cover" />
            ) : (
              getInitials(profile?.full_name)
            )}
            <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-bg-card bg-success" />
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-text-primary">{displayName}</p>
            <p className="truncate text-xs text-text-muted">
              {profile?.username ? `@${profile.username}` : ''}
            </p>
          </div>

          <button
            onClick={signOut}
            title="Sign out"
            className="rounded-lg p-1.5 text-text-muted transition-all duration-200 hover:bg-danger-muted hover:text-danger"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}
