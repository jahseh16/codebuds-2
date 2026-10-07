import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ChatProvider } from './contexts/ChatContext'
import { AuthModal } from './components/AuthModal'
import { ErrorBoundary } from './components/ErrorBoundary'
import { MainLayout } from './components/MainLayout'
import { Login } from './pages/Login'
import { Register } from './pages/Register'
import { Feed } from './pages/Feed'
import { Discover } from './pages/Discover'
import { Developers } from './pages/Developers'
import { Projects } from './pages/Projects'
import { Mentorship } from './pages/Mentorship'
import { Notifications } from './pages/Notifications'
import { Messages } from './pages/Messages'
import { Matches } from './pages/Matches'
import { Vibes } from './pages/Vibes'
import { ChatErrorBoundary } from './components/ChatErrorBoundary'
import { Settings } from './pages/Settings'
import { Profile } from './pages/Profile'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ChatProvider>
          <ErrorBoundary>
          {/* Global auth modal for guest interactions */}
          <AuthModal />

          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route element={<MainLayout />}>
              <Route path="/" element={<Feed />} />
              <Route path="/discover" element={<Discover />} />
              <Route path="/matches" element={<Matches />} />
              <Route path="/vibes" element={<Vibes />} />
              <Route path="/developers" element={<Developers />} />
              <Route path="/projects" element={<Projects />} />
              <Route path="/mentorship" element={<Mentorship />} />
              <Route path="/notifications" element={<Notifications />} />
              <Route path="/messages" element={<ChatErrorBoundary><Messages /></ChatErrorBoundary>} />
              <Route path="/messages/:username" element={<ChatErrorBoundary><Messages /></ChatErrorBoundary>} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/profile/:username" element={<Profile />} />
              <Route path="/settings" element={<Settings />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </ErrorBoundary>
        </ChatProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
