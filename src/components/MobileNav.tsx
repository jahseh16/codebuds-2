import { NavLink } from 'react-router-dom'
import { Compass, Heart, Rocket, Bell, LogIn, MessageCircle, Inbox, Newspaper } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useChat } from '../contexts/ChatContext'

const NAV_ITEMS = [
  { to: '/', icon: Newspaper, label: 'Feed' },
  { to: '/discover', icon: Compass, label: 'Discover' },
  { to: '/matches', icon: Heart, label: 'Matches' },
  { to: '/projects', icon: Rocket, label: 'Projects' },
  { to: '/messages', icon: MessageCircle, label: 'Chat' },
]

export function MobileNav() {
  const { token } = useAuth()
  const { totalUnread, unreadNotifications } = useChat()
  const isGuest = !token

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 flex items-center justify-around bg-bg-card/95 px-2 backdrop-blur-lg safe-area-bottom md:hidden"
      style={{ height: 'calc(64px + env(safe-area-inset-bottom, 0px))' }}
    >
      {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) =>
            `flex flex-col items-center justify-center gap-0.5 rounded-lg px-3 py-1.5 text-[10px] font-medium transition-colors min-h-[44px] min-w-[44px] ${
              isActive ? 'text-accent' : 'text-text-muted'
            }`
          }
        >
          <div className="relative">
            <Icon className="h-5 w-5" />
            {to === '/messages' && totalUnread > 0 && (
              <span className="absolute -top-1 -right-1 h-4 min-w-[16px] rounded-full bg-danger px-1 text-[9px] font-bold text-white flex items-center justify-center">
                {totalUnread > 99 ? '99+' : totalUnread}
              </span>
            )}
          </div>
          {label}
        </NavLink>
      ))}
      {isGuest ? (
        <NavLink
          to="/login"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center gap-0.5 rounded-lg px-3 py-1.5 text-[10px] font-medium transition-colors min-h-[44px] min-w-[44px] ${
              isActive ? 'text-accent' : 'text-accent'
            }`
          }
        >
          <LogIn className="h-5 w-5" />
          Sign In
        </NavLink>
      ) : (
        <NavLink
          to="/notifications"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center gap-0.5 rounded-lg px-3 py-1.5 text-[10px] font-medium transition-colors min-h-[44px] min-w-[44px] ${
              isActive ? 'text-accent' : 'text-text-muted'
            }`
          }          >
            <div className="relative">
              <Bell className="h-5 w-5" />
              {unreadNotifications > 0 && (
                <span className="absolute -top-1 -right-1 h-4 min-w-[16px] rounded-full bg-danger px-1 text-[9px] font-bold text-white flex items-center justify-center">
                  {unreadNotifications > 99 ? '99+' : unreadNotifications}
                </span>
              )}
            </div>
            Alerts
          </NavLink>
      )}
    </nav>
  )
}
