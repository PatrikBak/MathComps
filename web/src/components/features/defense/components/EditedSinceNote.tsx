'use client'

import { History } from 'lucide-react'
import { useTranslations } from 'next-intl'

/**
 * A note that the problem has been edited since a conversation about it started, and that the statement shown with
 * it is the one as it stood then.
 */
export function EditedSinceNote() {
  // Defense copy
  const t = useTranslations('defense')

  return (
    <p className="flex items-center gap-1.5 border-b border-foreground/10 px-4 py-2 text-xs text-warning sm:px-5">
      <History size={12} />
      {t('editedSince')}
    </p>
  )
}
