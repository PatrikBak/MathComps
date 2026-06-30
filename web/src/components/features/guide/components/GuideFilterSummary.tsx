import { ChevronDown, ChevronUp } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { cn } from '@/components/shared/utils/css-utils'

import { ROOMY_HIDDEN } from './guide-filter-layout'
import { type FilterPillGroup, getActiveSelections } from './guide-filter-model'

/**
 * Props for the {@link GuideFilterSummary} component.
 */
type GuideFilterSummaryProps = {
  /** The filter dimensions. */
  groups: FilterPillGroup[]
  /** Whether the filter grid is expanded. */
  opened: boolean
  /** Toggles the filter grid open/closed. */
  onToggle: () => void
}

/**
 * The cramped-screen header for the filter bar: a chevron toggle that expands the pill grid, plus the
 * active selections shown as removable chips so a collapsed bar still reveals what's applied. Hidden
 * on roomy viewports, where the grid is always open and this header would be redundant.
 */
export function GuideFilterSummary({ groups, opened, onToggle }: GuideFilterSummaryProps) {
  // Deck label translations
  const tDeck = useTranslations('guide.deck')
  // The toggle's visible label, which also names the control for assistive tech
  const filtersLabel = tDeck('filters.label')

  // The dimensions narrowed away from "all", as removable chips
  const activeSelections = getActiveSelections(groups)

  // A toggle row, with the active-selection chips alongside it while collapsed
  return (
    <div className={cn('flex flex-wrap items-center gap-2', ROOMY_HIDDEN)}>
      {/* The expand/collapse toggle */}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={opened}
        className="inline-flex items-center gap-1.5 rounded-full border border-foreground/30 px-4 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:border-muted hover:text-foreground"
      >
        {filtersLabel}
        {/* Chevron points up when expanded, down when there's more to reveal */}
        {opened ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {/* While collapsed, surface the active selections as chips that clear their dimension on click */}
      {!opened &&
        activeSelections.map((selection) => (
          <button
            key={selection.key}
            type="button"
            onClick={selection.onClear}
            className="inline-flex items-center gap-1 rounded-full border border-brand bg-brand/20 px-3 py-1 text-sm font-medium text-foreground transition-colors hover:bg-brand/30"
          >
            {selection.label}
            <span aria-hidden className="text-muted-foreground">
              ×
            </span>
          </button>
        ))}
    </div>
  )
}
