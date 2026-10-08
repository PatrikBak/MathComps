import { useTranslations } from 'next-intl'
import type { ReactNode } from 'react'

import { FOCUS_RING_CLASS } from '@/components/shared/components/Button'
import { cn } from '@/components/shared/utils/css-utils'

import { FACET_CONTROL_CLASS, FACET_PILL_ACTIVE_CLASS, FACET_PILL_CLASS } from './FacetTrigger'

/**
 * Props for the {@link FacetTogglePill} component.
 */
type FacetTogglePillProps = {
  /** Whether the filter is in force. */
  isOn: boolean
  /** Turns the filter on or off. */
  onToggle: () => void
  /** What the pill says. */
  children: ReactNode
}

/**
 * One yes-or-no filter in a row of facet pills, pressed while it is in force.
 */
export function FacetTogglePill({ isOn, onToggle, children }: FacetTogglePillProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={isOn}
      className={cn(FACET_CONTROL_CLASS, FACET_PILL_CLASS, isOn && FACET_PILL_ACTIVE_CLASS)}
    >
      {children}
    </button>
  )
}

/**
 * Props for the {@link FacetClearButton} component.
 */
type FacetClearButtonProps = {
  /** Opens every filter in the row back up. */
  onClear: () => void
}

/**
 * A button opening every filter in a row of facet pills back up.
 */
export function FacetClearButton({ onClear }: FacetClearButtonProps) {
  // Filter copy
  const t = useTranslations('ui.filters')

  return (
    <button
      type="button"
      onClick={onClear}
      className={cn(
        'shrink-0 rounded-md px-2 py-1 text-xs text-muted transition-colors hover:text-foreground',
        FOCUS_RING_CLASS
      )}
    >
      {t('clearFilters')}
    </button>
  )
}
