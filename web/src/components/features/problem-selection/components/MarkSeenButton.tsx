'use client'

import { Eye } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { RefObject } from 'react'

import { Button } from '@/components/shared/components/Button'
import { useFocusHandOff } from '@/hooks/use-focus-hand-off'

/**
 * Props for the {@link MarkSeenButton} component.
 */
type MarkSeenButtonProps = {
  /** Marks what the tab shows as seen. */
  onPress: () => void
  /** What takes the focus when the button leaves holding it. */
  fallbackRef: RefObject<HTMLElement | null>
}

/**
 * The eye marking what a Comments tab shows as seen, so only what comes after shows as new. Leaving the page while it
 * holds the focus, it hands the focus on as {@link useFocusHandOff} does.
 */
export function MarkSeenButton({ onPress, fallbackRef }: MarkSeenButtonProps) {
  // Discussion copy
  const t = useTranslations('problemSelection.comments')

  // The focus handed on as the button leaves holding it
  const handOff = useFocusHandOff<HTMLSpanElement>(fallbackRef)

  return (
    <span {...handOff} className="inline-flex">
      <Button
        size="icon"
        variant="ghost"
        aria-label={t('markSeen')}
        title={t('markSeen')}
        onClick={onPress}
      >
        <Eye size={16} />
      </Button>
    </span>
  )
}
