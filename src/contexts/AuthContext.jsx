import { createContext, useContext, useState, useEffect } from 'react'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

const AuthContext = createContext({
  user: null,
  role: null,
  loading: true,
  login: async () => {},
  logout: async () => {},
  isSupabaseConfigured,
})

export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [role, setRole] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      return
    }

    let mounted = true

    const getTrustedRole = async (sessionUser) => {
      const appRole = sessionUser.app_metadata?.role
      if (appRole) return appRole

      const { data, error } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', sessionUser.id)
        .maybeSingle()

      if (error) {
        console.error('Failed to load user role:', error)
      }

      return data?.role || 'user'
    }

    const applySession = async (session) => {
      if (!mounted) return
      setLoading(true)
      if (session?.user) {
        setUser(session.user)
        setRole(await getTrustedRole(session.user))
      } else {
        setUser(null)
        setRole(null)
      }
      if (mounted) setLoading(false)
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      applySession(session)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      applySession(session)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const login = async (email, password) => {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local, then restart the dev server.')
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }

  const logout = async () => {
    setUser(null)
    setRole(null)
    setLoading(false)

    if (!isSupabaseConfigured) return

    try {
      await supabase.auth.signOut({ scope: 'local' })
    } catch (err) {
      console.error('Sign out error:', err)
    }
  }

  return (
    <AuthContext.Provider value={{ user, role, loading, login, logout, isSupabaseConfigured }}>
      {children}
    </AuthContext.Provider>
  )
}
