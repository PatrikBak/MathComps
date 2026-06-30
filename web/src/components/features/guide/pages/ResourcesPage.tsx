import { useTranslations } from 'next-intl'
import { useMemo } from 'react'

import { ResourceCard } from '../components/guide-card-adapters'
import { GUIDE_CONTENT, matchesResource, RESOURCE_FACETS } from '../content/guide-content'
import { type Resource, RESOURCE_LEVELS } from '../content/guide-content-types'
import { useGuideLabels } from '../content/guide-labels'
import TipBox from '../layout/TipBox'
import { DeckGrid, type DeckPageProps } from './DeckPrimitives'
import { FilteredDeckPage } from './FilteredDeckPage'
import { type AnyFilterDimension, toOptions, useFilteredDeckPage } from './use-filtered-deck-page'

/**
 * Comparator ranking resources by their position in {@link RESOURCE_LEVELS} (beginner before advanced).
 * @param first - One resource to order.
 * @param second - The resource to compare it against.
 * @returns Negative when {@link first} ranks before {@link second}, positive when after, zero when tied.
 */
function byResourceLevel(first: Resource, second: Resource) {
  // Order by each level's index in the canonical beginner→advanced sequence
  return RESOURCE_LEVELS.indexOf(first.level) - RESOURCE_LEVELS.indexOf(second.level)
}

/**
 * Deck page: study/community resources in one filterable grid. Cards stay in bucket order, so the
 * colored per-card token visually bands each kind together.
 */
export function ResourcesPage({ filters, onFiltersChange }: DeckPageProps) {
  // General guide strings
  const tGuide = useTranslations('guide')
  // Deck UI strings (filter chrome)
  const tDeck = useTranslations('guide.deck')
  // Localized labels for the filter values
  const labels = useGuideLabels()

  // This page's filter dimensions, rebuilt only when the labels/chrome change
  const dimensions = useMemo<AnyFilterDimension[]>(
    () => [
      {
        key: 'resourceLevel',
        label: tDeck('filters.level'),
        options: toOptions(RESOURCE_FACETS.levels, labels.resourceLevel),
      },
      {
        key: 'bucket',
        label: tDeck('filters.bucket'),
        options: toOptions(RESOURCE_FACETS.buckets, labels.bucket),
      },
    ],
    [tDeck, labels]
  )

  // Wire the dimensions and filter the resources, beginner-friendly first
  const { groups, matching, reset } = useFilteredDeckPage({
    content: GUIDE_CONTENT.resources,
    matches: matchesResource,
    dimensions,
    filters,
    onFiltersChange,
    sort: byResourceLevel,
  })

  // The shared skeleton: the intro, the flat card grid, then the learning tip at the very bottom
  return (
    <FilteredDeckPage
      title={tGuide('titles.resources')}
      description={tGuide('sections.resources.description')}
      filterGroups={groups}
      isEmpty={matching.length === 0}
      onReset={reset}
      footer={<TipBox>{tGuide('sections.resources.tips.ai')}</TipBox>}
    >
      <DeckGrid>
        {matching.map((resource) => (
          <ResourceCard key={resource.id} resource={resource} />
        ))}
      </DeckGrid>
    </FilteredDeckPage>
  )
}
