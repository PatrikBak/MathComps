'use client'

import { AlertCircle, AlertTriangle, Check, Info, WifiOff } from 'lucide-react'
import { useEffect } from 'react'
import { Toaster } from 'sonner'

/**
 * Toast provider that wraps Sonner's Toaster with custom behavior.
 * Dismisses all toasts immediately when the user switches away from the tab,
 * so they don't persist when the user returns.
 */
export function ToastProvider() {
  useEffect(() => {
    // Dismiss all toasts when the page becomes hidden (user switches tabs)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Remove all toast elements instantly from the DOM
        const toasts = document.querySelectorAll('[data-sonner-toast]')
        requestAnimationFrame(() => {
          toasts.forEach((toast) => {
            ;(toast as HTMLElement).style.display = 'none'
          })
        })
      }
    }

    // Listen for visibility changes
    document.addEventListener('visibilitychange', handleVisibilityChange)

    // Clean up the event listener on unmount
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  return (
    <Toaster
      position="bottom-center"
      closeButton
      icons={{
        success: <Check className="h-5 w-5" />,
        error: <AlertCircle className="h-5 w-5" />,
        info: <Info className="h-5 w-5" />,
        warning: <AlertTriangle className="h-5 w-5" />,
        loading: <WifiOff className="h-5 w-5 animate-pulse" />,
      }}
      toastOptions={{
        unstyled: false,
        classNames: {
          toast: 'group',
          title: 'hyphens-none break-words',
        },
      }}
      gap={8}
    />
  )
}
