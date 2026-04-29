import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient.js'

const AuthContext = createContext(null)

const ALLOWED_VIEWS = {
  client:  ['client'],
  manager: ['client', 'manager'],
  admin:   ['client', 'manager', 'admin'],
}

async function fetchUserRole(email) {
  const { data, error } = await supabase
    .from('user_roles')
    .select('role, full_name, organization')
    .eq('email', email)
    .single()
  if (error) throw error
  return data
}

export function AuthProvider({ children }) {
  const [user,     setUser]     = useState(null)
  const [userRole, setUserRole] = useState(null)   // real DB role — immutable after login
  const [viewRole, setViewRoleState] = useState(null) // what they're currently viewing
  const [loading,  setLoading]  = useState(true)

  const applySession = useCallback(async (session) => {
    if (!session?.user) {
      setUser(null); setUserRole(null); setViewRoleState(null)
      setLoading(false)
      return
    }
    try {
      const roleRow = await fetchUserRole(session.user.email)
      const role    = roleRow.role
      setUser(session.user)
      setUserRole(role)
      setViewRoleState(prev => {
        // keep existing viewRole if it's still allowed for this role, else reset
        if (prev && ALLOWED_VIEWS[role]?.includes(prev)) return prev
        return role
      })
    } catch {
      // user exists in auth but not in user_roles — treat as client
      setUser(session.user)
      setUserRole('client')
      setViewRoleState('client')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => applySession(session))

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      applySession(session)
    })
    return () => subscription.unsubscribe()
  }, [applySession])

  const signIn = useCallback(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  const setViewRole = useCallback((role) => {
    if (ALLOWED_VIEWS[userRole]?.includes(role)) setViewRoleState(role)
  }, [userRole])

  return (
    <AuthContext.Provider value={{ user, userRole, viewRole, loading, signIn, signOut, setViewRole, ALLOWED_VIEWS }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
