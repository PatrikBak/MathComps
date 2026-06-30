import { useTranslations } from 'next-intl'
import { useMemo } from 'react'

import { SeminarCard } from '../components/guide-card-adapters'
import { GUIDE_CONTENT, matchesSeminar, SEMINAR_FACETS } from '../content/guide-content'
import { useGuideLabels } from '../content/guide-labels'
import { BulletList } from '../layout/BulletList'
import TipBox from '../layout/TipBox'
import { DeckGrid, type DeckPageProps } from './DeckPrimitives'
import { FilteredDeckPage } from './FilteredDeckPage'
import { type AnyFilterDimension, toOptions, useFilteredDeckPage } from './use-filtered-deck-page'

/**
 * Deck page: correspondence seminars in one filterable grid (level/country).
 */
export function SeminarsPage({ filters, onFiltersChange }: DeckPageProps) {
  // General guide strings
  const tGuide = useTranslations('guide')
  // Seminar-section strings
  const tSeminars = useTranslations('guide.sections.seminars')
  // Deck UI strings
  const tDeck = useTranslations('guide.deck')
  // Localized labels for the filter values
  const labels = useGuideLabels()

  // Common seminar features (raw array)
  const features = tSeminars.raw('features') as string[]

  // This page's filter dimensions, rebuilt only when the labels/chrome change
  const dimensions = useMemo<AnyFilterDimension[]>(
    () => [
      {
        key: 'schoolLevel',
        label: tDeck('filters.level'),
        options: toOptions(SEMINAR_FACETS.levels, labels.schoolLevel),
      },
      {
        key: 'country',
        label: tDeck('filters.country'),
        options: toOptions(SEMINAR_FACETS.countries, labels.country),
      },
    ],
    [tDeck, labels]
  )

  // Wire the dimensions and filter the seminars to the active selection
  const { groups, matching, reset } = useFilteredDeckPage({
    content: GUIDE_CONTENT.seminars,
    matches: matchesSeminar,
    dimensions,
    filters,
    onFiltersChange,
  })

  // The shared page skeleton: a feature-bulleted intro, the grid, and a closing tip
  return (
    <FilteredDeckPage
      title={tGuide('titles.seminars')}
      description={
        <>
          <p>{tGuide('sections.seminars.description')}</p>
          <BulletList className="mt-4" items={features} />
        </>
      }
      filterGroups={groups}
      isEmpty={matching.length === 0}
      onReset={reset}
      footer={<TipBox>{tGuide('sections.seminars.tip')}</TipBox>}
    >
      <DeckGrid>
        {matching.map((seminar) => (
          <SeminarCard key={seminar.id} seminar={seminar} />
        ))}
      </DeckGrid>
    </FilteredDeckPage>
  )
}
