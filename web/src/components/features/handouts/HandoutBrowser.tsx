'use client'

import { useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'

import { CommentCountProvider } from '@/components/features/comments/components/CommentCountContext'
import type { Locale } from '@/i18n/i18n'

import {
  HANDOUT_SOURCES,
  type HandoutMetadata,
  type HandoutSection,
  type HandoutSource,
  isReadyHandout,
} from './handout-metadata-types'
import { PlannedHandoutCard, ReadyHandoutCard } from './HandoutCard'
import { type CategoryOption, HandoutFilters } from './HandoutFilters'

/**
 * One handout pre-flattened with its parent section's category attached.
 */
type HandoutWithCategory = {
  /** The handout itself */
  handout: HandoutMetadata
  /** Stable locale-independent key for the category (from section.categoryKey) */
  categoryKey: string
  /** Localized display label for the category */
  categoryLabel: string
}

/**
 * Props for the {@link HandoutBrowser} component.
 */
type HandoutBrowserProps = {
  /** Locale-filtered handout sections from the server */
  sections: HandoutSection[]
  /** Current locale */
  locale: Locale
}

/**
 * Top-level client wrapper for the handouts list that handles filtering too.
 */
export function HandoutBrowser({ sections, locale }: HandoutBrowserProps) {
  // Translations for the planned heading and empty state
  const tFilters = useTranslations('handouts.filters')
  const t = useTranslations('handouts')

  // Flatten sections into individual handouts, each carrying its category.
  const allHandouts: HandoutWithCategory[] = useMemo(
    () =>
      // Handle all sections
      sections.flatMap((section) => {
        // Extract category key and label
        const categoryKey = section.categoryKey
        const categoryLabel = section.category[locale] ?? section.categoryKey

        // Flatten handouts from the section
        return section.handouts.map((handout) => ({ handout, categoryKey, categoryLabel }))
      }),
    [sections, locale]
  )

  // Determine available sources (only those with at least one ready handout in the data)
  const availableSources: HandoutSource[] = useMemo(
    () =>
      HANDOUT_SOURCES.filter((source) =>
        allHandouts.some((item) => isReadyHandout(item.handout) && item.handout.source === source)
      ),
    [allHandouts]
  )

  // Determine available categories in section order
  const availableCategories: CategoryOption[] = useMemo(
    () =>
      sections.map((section) => ({
        key: section.categoryKey,
        label: section.category[locale] ?? section.categoryKey,
      })),
    [sections, locale]
  )

  // Filter selection state
  const [selectedSources, setSelectedSources] = useState<HandoutSource[]>([])
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])

  // A handout passes when it satisfies every active row (AND across dimensions):
  // category row AND source row must both match. Each row is single-select, so
  // the selected chip is the only value checked. An empty row matches everything
  // for that dimension — equivalent to "no filter applied".
  const matches = (item: HandoutWithCategory) => {
    if (selectedCategories.length > 0 && !selectedCategories.includes(item.categoryKey))
      return false
    if (selectedSources.length > 0 && !selectedSources.includes(item.handout.source)) return false
    return true
  }

  // Split into ready and planned (after filter); preserve JSON order within each
  const readyMatches = allHandouts.filter((item) => isReadyHandout(item.handout) && matches(item))
  const plannedMatches = allHandouts.filter(
    (item) => !isReadyHandout(item.handout) && matches(item)
  )

  // Collect all ready handout ids for batched comment counts
  const handoutIds = readyMatches
    .map((item) => (isReadyHandout(item.handout) ? item.handout.id : null))
    .filter((id): id is string => id !== null)

  // Empty state when nothing matches
  const hasNothing = readyMatches.length === 0 && plannedMatches.length === 0

  // Layout: filter chips → ready cards grid → planned sub-section
  return (
    <div>
      {/* Filter chips */}
      <HandoutFilters
        availableSources={availableSources}
        availableCategories={availableCategories}
        selectedSources={selectedSources}
        selectedCategories={selectedCategories}
        onToggleSource={(source) =>
          setSelectedSources((previous) => (previous.includes(source) ? [] : [source]))
        }
        onToggleCategory={(categoryKey) =>
          setSelectedCategories((previous) => (previous.includes(categoryKey) ? [] : [categoryKey]))
        }
      />

      {hasNothing ? (
        /* Empty state */
        <p className="text-sm sm:text-base text-muted-foreground py-8 text-center">
          {tFilters('empty')}
        </p>
      ) : (
        <CommentCountProvider targetType="Handout" targetIds={handoutIds}>
          {/* Ready cards grid */}
          {readyMatches.length > 0 && (
            <ul role="list" className="grid gap-y-6 sm:gap-y-8 gap-x-4 md:grid-cols-2">
              {readyMatches.map((item) => {
                // This should not be possible
                if (!isReadyHandout(item.handout)) return null

                return (
                  <li key={item.handout.id}>
                    <ReadyHandoutCard
                      handout={item.handout}
                      category={item.categoryLabel}
                      locale={locale}
                    />
                  </li>
                )
              })}
            </ul>
          )}

          {/* Planned sub-section */}
          {plannedMatches.length > 0 && (
            <div className={readyMatches.length > 0 ? 'mt-10 sm:mt-14' : ''}>
              <h2 className="text-xs sm:text-sm uppercase tracking-wider text-muted-foreground mb-4 sm:mb-5">
                {t('plannedHeading')}
              </h2>
              <ul role="list" className="grid gap-y-6 sm:gap-y-8 gap-x-4 md:grid-cols-2">
                {plannedMatches.map((item, i) => (
                  <li key={`${item.categoryKey}-${i}`}>
                    <PlannedHandoutCard
                      handout={item.handout}
                      category={item.categoryLabel}
                      locale={locale}
                    />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CommentCountProvider>
      )}
    </div>
  )
}
