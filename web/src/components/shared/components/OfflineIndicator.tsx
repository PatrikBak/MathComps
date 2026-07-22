'use client'

import { useNetwork } from '@mantine/hooks'
import { WifiOff } from 'lucide-react'
import { useTranslations } from 'next-intl'

/**
 * A slim banner shown while the browser is offline, so a paused request reads as "you're offline"
 * rather than an eternal spinner with no explanation. Clears on its own once the connection returns.
 */
export function OfflineIndicator() {
  // Live online/offline status
  const { online } = useNetwork()

  // Network-status copy
  const t = useTranslations('ui.network')

  // Online: nothing to show
  if (online) {
    return null
  }

  // Offline: a centered pill at the bottom of the viewport
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-4"
    >
      <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-muted/50 bg-surface px-4 py-2 text-sm text-foreground shadow-lg">
        <WifiOff className="h-4 w-4 shrink-0 text-muted" aria-hidden />
        <span>{t('offline')}</span>
      </div>
    </div>
  )
}
