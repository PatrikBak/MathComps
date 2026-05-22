'use client'

import { useLocalStorage, useWindowEvent } from '@mantine/hooks'
import { useTranslations } from 'next-intl'
import { useEffect } from 'react'
import { useWakeLock } from 'react-screen-wake-lock'
import { toast } from 'sonner'

import { KEEP_SCREEN_ON_STORAGE_KEY } from '@/constants/local-storage-constants'

/**
 * Result returned by {@link useScreenWakeLock}.
 */
type UseScreenWakeLockResult = {
  /** Whether the Screen Wake Lock API is available in this browser. */
  supported: boolean
  /** Whether the user's persisted "keep screen on" intent is currently on. */
  enabled: boolean
  /** Flips the persisted intent and acquires or releases the lock accordingly. */
  setEnabled: (value: boolean) => void
}

/**
 * Wraps the Screen Wake Lock API with a localStorage-persisted intent so the
 * user's "keep screen on" preference survives reloads and applies across pages.
 *
 * On mount, if the persisted intent is on but no lock is currently held, arms
 * a one-shot pointerdown listener to acquire the lock on the next user gesture —
 * the API rejects programmatic requests made outside a gesture. Rejected
 * requests surface as a toast.
 */
export function useScreenWakeLock(): UseScreenWakeLockResult {
  // Translation hook for the unavailable-lock toast
  const tActions = useTranslations('ui.actions')

  // Persistent intent — survives reloads and applies across pages
  const [enabled, setEnabledState] = useLocalStorage<boolean>({
    key: KEEP_SCREEN_ON_STORAGE_KEY,
    defaultValue: false,
  })

  // Wake Lock binding — `released` is undefined before any request, false while
  // a lock is held, true once released. `reacquireOnPageVisible` re-requests
  // automatically when the tab returns to the foreground.
  const { isSupported, released, request, release } = useWakeLock({
    reacquireOnPageVisible: true,
    onError: () => toast.error(tActions('keepScreenOnUnavailable')),
  })

  // Auto-acquire on the next user gesture when intent is on but no lock is held —
  // covers the "user enabled previously, now on a fresh page" path. The handler
  // short-circuits once a lock is acquired (released === false).
  useWindowEvent('pointerdown', () => {
    if (!isSupported || !enabled || released === false) return
    request()
  })

  // Release the held lock when the consumer unmounts — the library leaks the
  // sentinel across SPA navigation otherwise, since route changes don't fire
  // visibilitychange and the document stays visible. `release` is memoized by
  // the library, so this cleanup runs only on actual unmount.
  useEffect(() => {
    return () => {
      release()
    }
  }, [release])

  // Toggle handler — updates both the persisted intent and the live lock state
  const setEnabled = (value: boolean) => {
    setEnabledState(value)
    if (value) {
      request()
    } else {
      release()
    }
  }

  // Public shape — internal lock handles stay hidden
  return { supported: isSupported, enabled, setEnabled }
}
