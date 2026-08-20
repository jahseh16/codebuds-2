import { NavLink } from 'react-router-dom'
import { Home, Users, Rocket, BookOpen, Bell } from 'lucide-react'

const NAV_ITEMS = [
  { to: '/', icon: Home, label: 'Feed' },
  { to: '/developers', icon: Users, label: 'Buddies' },
  { to: '/projects', icon: Rocket, label: 'Projects' },
  { to: '/mentorship', icon: BookOpen, label: 'Mentor' },
  { to: '/notifications', icon: Bell, label: 'Alerts' },
]

export function MobileNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t border-border bg-bg-card/95 px-2 py-2 backdrop-blur-lg md:hidden">
      {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) =>
            `flex flex-col items-center gap-1 rounded-lg px-3 py-1.5 text-[10px] font-medium transition-colors ${
              isActive ? 'text-accent' : 'text-text-muted'
            }`
          }
        >
          <Icon className="h-5 w-5" />
          {label}
        </NavLink>
      ))}
    </nav>
  )
}
