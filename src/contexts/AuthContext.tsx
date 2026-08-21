import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(authApi.getToken())
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

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

  async function signIn(email: string, password: string) {
    try {
      const data = await authApi.login(email, password)
      setToken(data.token)
      setProfile(data.profile)
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

  return (
    <AuthContext.Provider value={{ token, profile, loading, signIn, signUp, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
