'use client'

import { useTranslations } from 'next-intl'

import Chip from '@/components/features/problems/components/Chip'

import type { HandoutSource } from './handout-metadata-types'

/**
 * One entry in the category chip row: a stable key for filter state
 * and a localized label for display.
 */
export type CategoryOption = {
  /** Stable, locale-independent identifier */
  key: string
  /** Localized display label shown inside the chip */
  label: string
}

/**
 * Props for the {@link HandoutFilters} component.
 */
type HandoutFiltersProps = {
  /** Sources to render as chips (only those with at least one matching handout) */
  availableSources: HandoutSource[]
  /** Categories to render as chips, with their localized labels and stable keys */
  availableCategories: CategoryOption[]
  /** Currently selected sources */
  selectedSources: HandoutSource[]
  /** Currently selected category keys */
  selectedCategories: string[]
  /** Toggle a source chip */
  onToggleSource: (source: HandoutSource) => void
  /** Toggle a category chip */
  onToggleCategory: (categoryKey: string) => void
}

/**
 * Two-row chip filter for the handouts list — source on top, category on bottom.
 * Each row is single-select: clicking a chip selects it exclusively; clicking
 * the active chip clears the row. Across rows, both selections must be satisfied
 * simultaneously (AND semantics). An empty row matches everything on that dimension.
 */
export function HandoutFilters({
  availableSources,
  availableCategories,
  selectedSources,
  selectedCategories,
  onToggleSource,
  onToggleCategory,
}: HandoutFiltersProps) {
  // Translations for filter row labels and source chip labels
  const tFilters = useTranslations('handouts.filters')
  const tStyles = useTranslations('handouts.styles')

  // Don't render the source row if there's only one (or zero) sources available — degenerate filter.
  const showSourceRow = availableSources.length > 1

  return (
    <div className="space-y-3 sm:space-y-4 mb-6 sm:mb-8">
      {showSourceRow && (
        <FilterRow label={tFilters('sourceLabel')}>
          {availableSources.map((source) => (
            <Chip
              key={source}
              clickable
              isSelected={selectedSources.includes(source)}
              onClick={() => onToggleSource(source)}
            >
              {tStyles(source)}
            </Chip>
          ))}
        </FilterRow>
      )}
      {availableCategories.length > 1 && (
        <FilterRow label={tFilters('topicLabel')}>
          {availableCategories.map((category) => (
            <Chip
              key={category.key}
              clickable
              isSelected={selectedCategories.includes(category.key)}
              onClick={() => onToggleCategory(category.key)}
            >
              {category.label}
            </Chip>
          ))}
        </FilterRow>
      )}
    </div>
  )
}

/**
 * Props for the {@link FilterRow} component.
 */
type FilterRowProps = {
  /** Row label shown to the left of the chips */
  label: string
  /** Chip elements */
  children: React.ReactNode
}

/**
 * One labeled row of chips. Label stacks above chips on mobile.
 */
function FilterRow({ label, children }: FilterRowProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
      <span className="text-xs sm:text-sm font-medium text-muted-foreground sm:min-w-[3.5rem] sm:shrink-0">
        {label}
      </span>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  )
}
