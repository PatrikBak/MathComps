'use client'

import { useLocalStorage, useWindowEvent } from '@mantine/hooks'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useRef } from 'react'
import { toast } from 'sonner'

import { KEEP_SCREEN_ON_STORAGE_KEY } from '@/constants/local-storage-constants'

/**
 * Result returned by {@link useScreenWakeLock}.
 */
export type UseScreenWakeLockResult = {
  /** Whether the Screen Wake Lock API is available in this browser. */
  supported: boolean
  /** Whether the user's persisted "keep screen on" intent is currently on. */
  enabled: boolean
  /** Flips the persisted intent and acquires or releases the lock accordingly. */
  setEnabled: (value: boolean) => void
}

/**
 * Owns a {@link WakeLockSentinel} directly via {@link Navigator.wakeLock} and
 * persists the user's "keep screen on" intent in localStorage so it survives
 * reloads and applies across pages.
 *
 * Two acquire paths share a single internal `acquire()` that returns a boolean
 * outcome — callers decide what to do on failure. The user toggle surfaces
 * failures as a toast; opportunistic background attempts (mount, first
 * pointerdown, tab returning to visible) stay silent.
 */
export function useScreenWakeLock(): UseScreenWakeLockResult {
  // Translation hook for the unavailable-lock toast
  const tActions = useTranslations('ui.actions')

  // Persistent intent — survives reloads and applies across pages
  const [enabled, setEnabledState] = useLocalStorage<boolean>({
    key: KEEP_SCREEN_ON_STORAGE_KEY,
    defaultValue: false,
  })

  // Feature detection — read once per render, no state needed
  const supported = typeof navigator !== 'undefined' && 'wakeLock' in navigator

  // Active sentinel — non-null while we hold the lock, cleared on release
  const sentinelRef = useRef<WakeLockSentinel | null>(null)

  // Coalesces overlapping acquire() calls. Without this, the user-toggle path
  // and the mount effect can both kick off navigator.wakeLock.request before
  // either resolves, leaving us with two sentinels and a leak.
  const inFlightRef = useRef(false)

  // Internal acquire — single source of truth. Resolves to true on a fresh
  // successful acquire, false on failure or short-circuit (already held,
  // already in flight, or unsupported). The boolean lets callers decide
  // whether to surface failures.
  const acquire = useCallback(async (): Promise<boolean> => {
    // Short-circuit if unsupported, already in flight, or already held
    if (!supported || sentinelRef.current || inFlightRef.current) return false
    inFlightRef.current = true
    try {
      // Try to acquire the lock and store it
      const sentinel = await navigator.wakeLock.request('screen')
      sentinelRef.current = sentinel
      // Clear the ref when the browser releases the sentinel externally (e.g.
      // when the tab is hidden) so the next opportunistic trigger re-acquires
      // instead of short-circuiting on a stale reference.
      sentinel.addEventListener('release', () => {
        if (sentinelRef.current === sentinel) sentinelRef.current = null
      })
      return true
    } catch {
      return false
    } finally {
      // Clear the flag indicating acquiring is in flight
      inFlightRef.current = false
    }
  }, [supported])

  // Internal release — clears the ref synchronously so guards see "no lock
  // held" immediately, then awaits the platform release.
  const release = useCallback(async () => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    sentinelRef.current = null
    await sentinel.release()
  }, [])

  // Shared opportunistic trigger — quiet by design, used by all three
  // background acquire paths below. Idempotence comes from acquire()'s
  // in-flight and sentinel guards, so firing this multiple times in quick
  // succession is safe.
  const tryAcquire = useCallback(() => {
    if (!enabled) return
    acquire()
  }, [enabled, acquire])

  // Mount + enable-flip — captures the transient activation still in flight
  // when the user navigated in via a link click. Re-runs when intent flips
  // true after localStorage hydrates; the in-flight guard absorbs the
  // overlap with a user-toggle call.
  useEffect(() => {
    tryAcquire()
  }, [tryAcquire])

  // First-pointerdown fallback — covers the cold-load path where the mount
  // effect fired without an active gesture. The handler short-circuits once
  // a lock is acquired via sentinelRef inside acquire().
  useWindowEvent('pointerdown', tryAcquire)

  // Re-acquire when the tab returns to the foreground — the browser drops
  // the sentinel on hide, and the sentinel's release handler clears our ref,
  // so this re-arms cleanly on the next visible event.
  useWindowEvent('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return
    tryAcquire()
  })

  // Release on unmount — we own the sentinel, so leaving the route scope
  // (e.g. navigating out of /handouts/*) must release explicitly. Route
  // changes don't fire visibilitychange and the document stays visible.
  useEffect(() => {
    return () => {
      release()
    }
  }, [release])

  // Public setter — user-initiated, surfaces failures as a toast. Stays
  // synchronous from the caller's perspective; the acquire promise is
  // chained internally.
  const setEnabled = (value: boolean) => {
    setEnabledState(value)
    if (value) {
      acquire().then((ok) => {
        if (!ok) toast.error(tActions('keepScreenOnUnavailable'))
      })
    } else {
      release()
    }
  }

  // Public shape — internal lock handles stay hidden
  return { supported, enabled, setEnabled }
}
