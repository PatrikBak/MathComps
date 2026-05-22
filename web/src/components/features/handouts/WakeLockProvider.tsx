'use client'

import { createContext, useContext } from 'react'

import { useScreenWakeLock } from '@/hooks/use-screen-wake-lock'

/**
 * Public shape exposed by {@link WakeLockProvider} — see {@link useWakeLockContext}.
 */
type WakeLockContextValue = {
  /** Whether the Screen Wake Lock API is available in this browser. */
  supported: boolean
  /** Whether the user's persisted "keep screen on" intent is currently on. */
  enabled: boolean
  /** Flips the persisted intent and acquires or releases the lock accordingly. */
  setEnabled: (value: boolean) => void
}

const WakeLockContext = createContext<WakeLockContextValue | null>(null)

/**
 * Props for {@link WakeLockProvider}.
 */
type WakeLockProviderProps = {
  /** Subtree that may consume the wake-lock state via {@link useWakeLockContext}. */
  children: React.ReactNode
}

/**
 * Hosts a single {@link useScreenWakeLock} instance for its subtree, exposing
 * the state via React context. Mount above the route scope where the wake-lock
 * preference should apply (e.g. all handout routes) so the held lock persists
 * across child-route navigations and releases only when the scope is left.
 */
export function WakeLockProvider({ children }: WakeLockProviderProps) {
  // Single wake-lock binding shared by the entire subtree
  const wakeLock = useScreenWakeLock()

  return <WakeLockContext.Provider value={wakeLock}>{children}</WakeLockContext.Provider>
}

/**
 * Consumer hook — reads the wake-lock state from the nearest {@link WakeLockProvider}.
 * Throws when called outside a provider.
 */
export function useWakeLockContext() {
  const value = useContext(WakeLockContext)
  if (value === null) {
    throw new Error('useWakeLockContext must be used within a WakeLockProvider')
  }
  return value
}
