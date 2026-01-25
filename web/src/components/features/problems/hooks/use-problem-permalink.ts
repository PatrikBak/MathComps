import { useClipboard } from '@mantine/hooks'
import { useLocale, useTranslations } from 'next-intl'
import { useCallback } from 'react'
import { toast } from 'sonner'

import { ROUTES } from '@/i18n/i18n'

/**
 * Hook for copying problem permalinks to the clipboard.
 *
 * @returns A function that copies a problem's permalink to the clipboard and shows a toast notification.
 */
export const useProblemPermalink = () => {
  // Translations for toast message
  const t = useTranslations('ui.actions')

  // Current locale for URL prefix
  const locale = useLocale()

  // Clipboard access
  const clipboard = useClipboard()

  return useCallback(
    (slug: string) => {
      // Generate locale-aware permalink with query param
      const url = `${window.location.origin}/${locale}${ROUTES.PROBLEMS}?id=${slug}`

      // Copy to clipboard and show toast
      clipboard.copy(url)

      // Inform user
      toast.success(t('problemLinkCopied'))
    },
    [clipboard, locale, t]
  )
}
