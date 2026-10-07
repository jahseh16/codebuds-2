import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { auth as authApi } from '../lib/api'
import type { Profile } from '../lib/types'

interface AuthContextType {
  token: string | null
  profile: Profile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error?: string }>
  signUp: (
    email: string,
    password: string,
    username: string,
    fullName: string
  ) => Promise<{ error?: string }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  /** Apply a server response to the local profile immediately (no refetch). */
  updateProfileLocal: (patch: Partial<Profile>) => void
  /** Whether the guest auth modal is currently open */
  authModalOpen: boolean
  /** Open the guest auth modal */
  openAuthModal: () => void
  /** Close the guest auth modal */
  closeAuthModal: () => void
  /** Returns true if authenticated; if not, opens the auth modal and returns false */
  requireAuth: () => boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(authApi.getToken())
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [authModalOpen, setAuthModalOpen] = useState(false)

  useEffect(() => {
    if (!token) {
      setLoading(false)
      return
    }

    let cancelled = false
    authApi.me()
      .then((data) => {
        if (!cancelled) {
          setProfile(data as Profile)
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          authApi.signOut()
          setToken(null)
          setProfile(null)
          setLoading(false)
        }
      })

    return () => { cancelled = true }
  }, [token])

  async function refreshProfile() {
    if (!token) return
    try {
      const data = await authApi.me()
      setProfile(data as Profile)
    } catch {
      // ignore
    }
  }

  function updateProfileLocal(patch: Partial<Profile>) {
    setProfile((prev) => (prev ? { ...prev, ...patch } : prev))
  }

  async function signIn(email: string, password: string) {
    try {
      const data = await authApi.login(email, password)
      setToken(data.token)
      setProfile(data.profile)
      setAuthModalOpen(false)
      return {}
    } catch (err: any) {
      return { error: err.message }
    }
  }

  async function signUp(email: string, password: string, username: string, fullName: string) {
    try {
      await authApi.register(email, password, username, fullName)
      return {}
    } catch (err: any) {
      return { error: err.message }
    }
  }

  async function signOut() {
    authApi.signOut()
    setToken(null)
    setProfile(null)
  }

  const openAuthModal = useCallback(() => setAuthModalOpen(true), [])
  const closeAuthModal = useCallback(() => setAuthModalOpen(false), [])

  const requireAuth = useCallback(() => {
    if (token) return true
    setAuthModalOpen(true)
    return false
  }, [token])

  return (
    <AuthContext.Provider value={{
      token,
      profile,
      loading,
      signIn,
      signUp,
      signOut,
      refreshProfile,
      updateProfileLocal,
      authModalOpen,
      openAuthModal,
      closeAuthModal,
      requireAuth,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
