import { FilterX, type LucideIcon } from 'lucide-react'

import { Button } from '@/components/shared/components/Button'
import { cn } from '@/components/shared/utils/css-utils'

/**
 * The dashed panel a stand-in sits in when it has to fit inside a column rather than fill a page.
 */
export const COMPACT_PANEL_CLASS =
  'flex flex-col items-center gap-2 rounded-lg border border-dashed border-foreground/15 px-4 py-10 text-center'

/**
 * Props for the {@link FilterEmptyState} component.
 */
type FilterEmptyStateProps = {
  /** The "nothing matches" message. */
  message: string
  /** Label for the reset button. */
  resetLabel: string
  /** Clears the active filters back to "all". */
  onReset: () => void
  /** The icon above the message. */
  icon?: LucideIcon
  /** True for the panel sized to sit in a column rather than to fill a page. */
  compact?: boolean
}

/**
 * Shown when active filters match nothing: a dashed panel with the message and a reset button.
 * Reusable by any filterable list.
 */
export function FilterEmptyState({
  message,
  resetLabel,
  onReset,
  icon: Icon = FilterX,
  compact = false,
}: FilterEmptyStateProps) {
  // The dashed panel with icon, message, and a reset
  return (
    <div
      className={
        compact
          ? COMPACT_PANEL_CLASS
          : cn(
              'flex flex-col items-center justify-center border border-dashed text-center',
              'rounded-xl border-foreground/10 bg-surface/30 py-16'
            )
      }
    >
      <Icon size={compact ? 22 : 40} className={cn('text-muted', !compact && 'mb-3')} />
      <p className={cn('text-muted', compact && 'text-sm')}>{message}</p>
      <Button
        variant="secondary"
        size="sm"
        onClick={onReset}
        className={cn(!compact && 'mt-4')}
        shape={compact ? 'default' : 'pill'}
      >
        {resetLabel}
      </Button>
    </div>
  )
}
