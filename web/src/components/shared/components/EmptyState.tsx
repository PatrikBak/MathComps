import { FilterX, type LucideIcon } from 'lucide-react'

import { Button } from '@/components/shared/components/Button'
import { cn } from '@/components/shared/utils/css-utils'

/**
 * The dashed panel a stand-in sits in when it has to fit inside a column rather than fill a page.
 */
export const COMPACT_PANEL_CLASS =
  'flex flex-col items-center gap-2 rounded-lg border border-dashed border-foreground/15 px-4 py-10 text-center'

/**
 * The dashed panel a stand-in sits in when it fills the space a page's list would.
 */
export const PAGE_PANEL_CLASS =
  'flex flex-col items-center justify-center rounded-xl border border-dashed border-foreground/10 bg-surface/30 py-16 text-center'

/**
 * Props for the {@link EmptyState} component.
 */
type EmptyStateProps = {
  /** The message saying why the list is empty. */
  message: string
  /** The label of the button leading out of the empty list. */
  actionLabel: string
  /** Leads out of the empty list, such as by clearing the filters. */
  onAction: () => void
  /** The icon above the message. */
  icon?: LucideIcon
  /** True for the panel sized to sit in a column rather than to fill a page. */
  compact?: boolean
}

/**
 * A dashed panel saying why a list is empty, with a button leading out of it.
 */
export function EmptyState({
  message,
  actionLabel,
  onAction,
  icon: Icon = FilterX,
  compact = false,
}: EmptyStateProps) {
  // The dashed panel with icon, message, and the way out
  return (
    <div className={compact ? COMPACT_PANEL_CLASS : PAGE_PANEL_CLASS}>
      <Icon size={compact ? 22 : 40} className={cn('text-muted', !compact && 'mb-3')} />
      <p className={cn('text-muted', compact && 'text-sm')}>{message}</p>
      <Button
        variant="secondary"
        size="sm"
        onClick={onAction}
        className={cn(!compact && 'mt-4')}
        shape={compact ? 'default' : 'pill'}
      >
        {actionLabel}
      </Button>
    </div>
  )
}
