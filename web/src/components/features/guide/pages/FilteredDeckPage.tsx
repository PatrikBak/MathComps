import React from 'react'

import { type FilterPillGroup } from '../components/guide-filter-model'
import { GuideEmptyState } from '../components/GuideEmptyState'
import { GuideFilterBar } from '../components/GuideFilterBar'
import { PageHeader } from './DeckPrimitives'

/**
 * Props for the {@link FilteredDeckPage} component.
 */
type FilteredDeckPageProps = {
  /** Section title. */
  title: string
  /** Intro prose. */
  description: React.ReactNode
  /** The filter dimensions for this page. */
  filterGroups: FilterPillGroup[]
  /** Whether the active filters match nothing. */
  isEmpty: boolean
  /** Clears the filters back to "all". */
  onReset: () => void
  /** The matching cards (a flat grid or grouped sections), shown when something matches. */
  children: React.ReactNode
  /** Optional content after the body (e.g. a closing tip). */
  footer?: React.ReactNode
}

/**
 * The shared skeleton for a filterable deck page: intro, filter bar, then the matching cards
 * (or an empty state), with an optional footer.
 */
export function FilteredDeckPage({
  title,
  description,
  filterGroups,
  isEmpty,
  onReset,
  children,
  footer,
}: FilteredDeckPageProps) {
  // The intro, the filter bar, the body, then any footer
  return (
    <div>
      <PageHeader title={title} description={description} />
      <GuideFilterBar groups={filterGroups} />

      {/* Nothing matches? the empty state, otherwise the body */}
      {isEmpty ? <GuideEmptyState onReset={onReset} /> : children}

      {footer}
    </div>
  )
}
