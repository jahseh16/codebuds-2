import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { RightSidebar } from './RightSidebar'
import { MobileNav } from './MobileNav'

export function MainLayout() {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-bg-primary text-text-primary">
      <Sidebar />
      <div className="flex min-w-0 flex-1">
        <main className="flex-1 overflow-y-auto pb-20 lg:pb-0">
          <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
            <Outlet />
          </div>
        </main>
        <RightSidebar />
      </div>
      <MobileNav />
    </div>
  )
}
