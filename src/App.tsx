import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { MainLayout } from './components/MainLayout'
import { Login } from './pages/Login'
import { Register } from './pages/Register'
import { Feed } from './pages/Feed'
import { Developers } from './pages/Developers'
import { Projects } from './pages/Projects'
import { Mentorship } from './pages/Mentorship'
import { Notifications } from './pages/Notifications'
import { Settings } from './pages/Settings'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<Feed />} />
            <Route path="/developers" element={<Developers />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/mentorship" element={<Mentorship />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
