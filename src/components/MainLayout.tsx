import { useState, useEffect, useCallback } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Menu, Code2, LogIn } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { RightSidebar } from './RightSidebar'
import { MobileNav } from './MobileNav'
import { useAuth } from '../contexts/AuthContext'
import { getAvatarUrl } from '../lib/utils'

export function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { token, profile } = useAuth()
  const isGuest = !token
  const isMessagesRoute = location.pathname.startsWith('/messages')
  const isProfileRoute = location.pathname.startsWith('/profile')
  const isFullWidthRoute = isMessagesRoute || isProfileRoute

  // Close drawer on route change
  useEffect(() => {
    setSidebarOpen(false)
  }, [location.pathname])

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      // Only restore if no other modal is controlling overflow
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [sidebarOpen])

  // Close drawer on Escape
  useEffect(() => {
    if (!sidebarOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSidebarOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sidebarOpen])

  const closeSidebar = useCallback(() => setSidebarOpen(false), [])

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-bg-primary text-text-primary">
      {/* Desktop sidebar — always visible from md+ */}
      <Sidebar open={sidebarOpen} onClose={closeSidebar} />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* ═══════════════════════════════════════════════
            MOBILE HEADER — compact, centered branding
            ═══════════════════════════════════════════════ */}
        <header className="sticky top-0 z-40 flex h-14 min-h-14 shrink-0 items-center bg-bg-primary/95 px-3 backdrop-blur-md safe-area-top sm:px-4 md:hidden">
          {/* ── Left: Hamburger ── */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-text-secondary transition-colors duration-150 hover:bg-bg-card-hover hover:text-text-primary active:scale-95"
            aria-label="Open navigation menu"
            type="button"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* ── Center: Logo + Name (truly centered) ── */}
          <Link
            to="/"
            className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 whitespace-nowrap"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-accent shadow-[0_0_16px_rgba(124,58,237,0.3)] transition-shadow duration-200">
              <Code2 className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-semibold tracking-tight text-text-primary">
              CodeBuds
            </span>
          </Link>

          {/* ── Right: Login or Avatar ── */}
          {isGuest ? (
            <Link
              to="/login"
              className="relative z-10 ml-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-white transition-all duration-150 hover:bg-accent-hover hover:shadow-[0_0_16px_rgba(124,58,237,0.35)] active:scale-95"
              aria-label="Sign in"
            >
              <LogIn className="h-4 w-4" />
            </Link>
          ) : (
            <button
              onClick={() => navigate('/profile')}
              className="relative z-10 ml-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all duration-150 hover:bg-bg-card-hover active:scale-95"
              aria-label="Go to profile"
              type="button"
            >
              <img
                src={getAvatarUrl(profile?.avatar_url, profile?.username)}
                alt={profile?.full_name ?? 'Profile'}
                className="h-8 w-8 rounded-lg object-cover ring-1 ring-accent/20"
              />
            </button>
          )}
        </header>

        {/* ── Content area ── */}
        <div className="flex min-w-0 flex-1 overflow-hidden">
          <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden pb-24 lg:pb-0 min-h-0 bg-bg-primary">
            {isFullWidthRoute ? (
              <Outlet />
            ) : (
              <div className="mx-auto w-full min-w-0 max-w-2xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
                <Outlet />
              </div>
            )}
          </main>

          {/* Community / Suggested Buddies / Featured Projects never show up
              inside Messages: the chat route renders its own contextual
              info panel instead (no Featured Projects in the chat). */}
          {!isMessagesRoute && <RightSidebar />}
        </div>
      </div>

      {/* Mobile bottom nav */}
      <MobileNav />
    </div>
  )
}
