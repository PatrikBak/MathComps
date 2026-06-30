import { FilterX } from 'lucide-react'
import { useTranslations } from 'next-intl'

/**
 * Props for the {@link GuideEmptyState} component.
 */
type GuideEmptyStateProps = {
  /** Clears the active filters back to "all". */
  onReset: () => void
}

/**
 * Shown on a deck page when the active filters match no entities; offers a reset.
 */
export function GuideEmptyState({ onReset }: GuideEmptyStateProps) {
  // Empty-state copy + reset label
  const tDeck = useTranslations('guide.deck')

  // Render the empty-state panel with a reset button
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-foreground/10 bg-surface/30 py-16 text-center">
      <FilterX size={40} className="mb-3 text-muted" />
      <p className="text-muted">{tDeck('emptyState')}</p>
      <button
        type="button"
        onClick={onReset}
        className="mt-4 rounded-full border border-foreground/20 px-4 py-1.5 text-sm text-foreground transition-colors hover:border-muted"
      >
        {tDeck('clearFilters')}
      </button>
    </div>
  )
}
