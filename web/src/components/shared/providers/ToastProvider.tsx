'use client'

import { AlertTriangle, Check, Info, WifiOff, XCircle } from 'lucide-react'
import { useEffect, useSyncExternalStore } from 'react'
import { toast, Toaster } from 'sonner'

/**
 * Toast provider that wraps Sonner's Toaster with custom behavior.
 * Dismisses all toasts immediately when the user switches away from the tab,
 * so they don't persist when the user returns.
 */
export function ToastProvider() {
  // Subscribe to visibility changes
  const isPageHidden = useSyncExternalStore(
    (callback) => {
      document.addEventListener('visibilitychange', callback)
      return () => document.removeEventListener('visibilitychange', callback)
    },
    // Get the current visibility state
    () => document.hidden,
    // Get the server-side visibility state
    () => false
  )

  useEffect(() => {
    // Dismiss all toasts when the page becomes hidden (user switches tabs)
    if (isPageHidden) {
      toast.dismiss()
    }
  }, [isPageHidden])

  return (
    <Toaster
      position="bottom-center"
      closeButton
      icons={{
        success: <Check className="h-5 w-5" />,
        error: <XCircle className="h-5 w-5" />,
        info: <Info className="h-5 w-5" />,
        warning: <AlertTriangle className="h-5 w-5" />,
        loading: <WifiOff className="h-5 w-5 animate-pulse" />,
      }}
      gap={8}
    />
  )
}
