import { useTranslations } from 'next-intl'
import { useMemo } from 'react'

import { OtherCard } from '../components/guide-card-adapters'
import {
  GUIDE_CONTENT,
  matchesOtherCompetition,
  OTHER_COMPETITION_FACETS,
} from '../content/guide-content'
import { useGuideLabels } from '../content/guide-labels'
import { DeckGrid, type DeckPageProps } from './DeckPrimitives'
import { FilteredDeckPage } from './FilteredDeckPage'
import { type AnyFilterDimension, toOptions, useFilteredDeckPage } from './use-filtered-deck-page'

/**
 * Deck page: other (non-olympiad) competitions in one filterable grid (kind/level/country).
 */
export function OtherPage({ filters, onFiltersChange }: DeckPageProps) {
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
        key: 'schoolLevel',
        label: tDeck('filters.level'),
        options: toOptions(OTHER_COMPETITION_FACETS.levels, labels.schoolLevel),
      },
      {
        key: 'kind',
        label: tDeck('filters.kind'),
        options: toOptions(OTHER_COMPETITION_FACETS.kinds, labels.kind),
      },
      {
        key: 'country',
        label: tDeck('filters.country'),
        options: toOptions(OTHER_COMPETITION_FACETS.countries, labels.country),
      },
    ],
    [tDeck, labels]
  )

  // Wire the dimensions and filter the competitions to the active selection
  const { groups, matching, reset } = useFilteredDeckPage({
    content: GUIDE_CONTENT.otherCompetitions,
    matches: matchesOtherCompetition,
    dimensions,
    filters,
    onFiltersChange,
  })

  // The shared page skeleton, filled with one card per competition
  return (
    <FilteredDeckPage
      title={tGuide('titles.otherCompetitions')}
      description={tGuide('sections.otherCompetitions.description')}
      filterGroups={groups}
      isEmpty={matching.length === 0}
      onReset={reset}
    >
      <DeckGrid>
        {matching.map((competition) => (
          <OtherCard key={competition.id} competition={competition} />
        ))}
      </DeckGrid>
    </FilteredDeckPage>
  )
}
