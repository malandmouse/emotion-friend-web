import { useEffect, useSyncExternalStore } from 'react'
import { getAuthState, initializeAuth, subscribeAuth } from './session'

export function useAuth() {
  const state = useSyncExternalStore(subscribeAuth, getAuthState)
  useEffect(() => { void initializeAuth() }, [])
  return state
}
