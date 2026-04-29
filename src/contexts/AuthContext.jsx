import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [role, setRole] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
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
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }

  const logout = async () => {
    try {
      await supabase.auth.signOut()
    } catch (err) {
      console.error('Sign out error:', err)
    }
    // Always clear state, even if signOut API fails
    setUser(null)
    setRole(null)
  }

  return (
    <AuthContext.Provider value={{ user, role, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
