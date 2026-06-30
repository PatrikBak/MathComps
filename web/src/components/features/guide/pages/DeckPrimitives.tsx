import React from 'react'

import type { GuideFilters } from '../content/guide-filters'
import { GuideText } from '../layout/GuideText'

/**
 * The filter props shared by every filterable deck page.
 */
export type DeckPageProps = {
  /** Active single-select filters for this page. */
  filters: GuideFilters
  /** Updates the page's filters. */
  onFiltersChange: (filters: GuideFilters) => void
}

/**
 * Props for the {@link DeckGrid} component.
 */
type DeckGridProps = {
  /** The cards filling the grid. */
  children: React.ReactNode
}

/**
 * A responsive one/two-column card grid.
 */
export function DeckGrid({ children }: DeckGridProps) {
  return <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2">{children}</div>
}

/**
 * Props for the {@link PageHeader} component.
 */
type PageHeaderProps = {
  /** Section title. */
  title: string
  /** Intro prose. */
  description: React.ReactNode
}

/**
 * A deck page's opening: a visually-hidden title and intro prose.
 */
export function PageHeader({ title, description }: PageHeaderProps) {
  // Render the hidden title and intro prose
  return (
    <div className="mb-6">
      {/* Visually-hidden title */}
      <h2 className="sr-only">{title}</h2>
      {/* Intro prose */}
      <GuideText as="div" className="text-base sm:text-lg">
        {description}
      </GuideText>
    </div>
  )
}
