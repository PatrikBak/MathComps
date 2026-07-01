import { FilterX } from 'lucide-react'

import { Button } from '@/components/shared/components/Button'

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
}

/**
 * Shown when active filters match nothing: a dashed panel with the message and a reset button.
 * Reusable by any filterable list.
 */
export function FilterEmptyState({ message, resetLabel, onReset }: FilterEmptyStateProps) {
  // The dashed panel with icon, message, and a reset
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-foreground/10 bg-surface/30 py-16 text-center">
      <FilterX size={40} className="mb-3 text-muted" />
      <p className="text-muted">{message}</p>
      <Button variant="secondary" size="sm" onClick={onReset} className="mt-4" shape="pill">
        {resetLabel}
      </Button>
    </div>
  )
}
