import { useAuth } from '@clerk/nextjs'
import { Lightbulb, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import React, { useEffect, useRef } from 'react'

import { ManualHyphens } from '@/components/shared/components/ManualHyphens'
import { Tooltip } from '@/components/shared/components/Tooltip'
import { cn } from '@/components/shared/utils/css-utils'
import { useDeviceCapabilities } from '@/hooks/use-device-capabilities'

import {
  useSearchFiltersLogic,
  type UseSearchFiltersLogicProps,
} from '../hooks/use-search-filters-logic'
import { createFilterUpdater } from '../utils/filter-update-utils'
import MultiSelectFacet from './facets/MultiSelectFacet'
import TreeSelectFacet from './facets/TreeSelectFacet'
import { ListsDropdown } from './ListsDropdown'

/**
 * A tooltip icon component that provides helpful information
 * about search functionality and selection shortcuts.
 */
function TipsAndTricks() {
  // The translations
  const t = useTranslations('problems.filters.tips')

  // Get the intro text
  const introText = t('intro')

  // Figure out the device for proper key display
  const { isMac, isTouchOnly } = useDeviceCapabilities()

  // Get the modifier key and name
  const modifierKey = isMac ? '⌘' : 'Ctrl'
  const modifierName = isMac ? 'Cmd' : 'Ctrl'

  // The JSX displayed in the tooltip
  const tooltipContent = (
    <div className="space-y-3 max-w-xs text-xs sm:text-sm">
      {/* Search languages */}
      <div>
        <div className="font-medium text-foreground mb-1.5">{t('search.title')}</div>
        <p className="text-muted-foreground">{t('search.text')}</p>
      </div>

      {/* Exclusive selection */}
      <div>
        <div className="font-medium text-foreground mb-1.5">{t('exclusive.title')}</div>
        {isTouchOnly ? (
          <p className="text-muted-foreground">{t('exclusive.touch', { intro: introText })}</p>
        ) : (
          <p className="text-muted-foreground">
            {t.rich('exclusive.desktop', {
              modifierKey,
              modifierName,
              intro: introText,
              kbd: (chunks: React.ReactNode) => (
                <kbd className="px-1 py-0.5 rounded bg-foreground/10 text-xs font-mono">
                  {chunks}
                </kbd>
              ),
            })}
          </p>
        )}
      </div>

      {/* Logic toggle */}
      <div>
        <div className="font-medium text-foreground mb-1.5">{t('logic.title')}</div>
        <p className="text-muted-foreground">
          {t.rich('logic.text', {
            mono: (chunks: React.ReactNode) => (
              <span className="font-mono text-focus-light">{chunks}</span>
            ),
            hyphens: (chunks: React.ReactNode) => <ManualHyphens text={String(chunks)} />,
          })}
        </p>
      </div>
    </div>
  )

  // Render the tooltip
  return (
    <Tooltip content={tooltipContent} placement="left">
      <span
        className="p-1 rounded text-muted hover:text-warning/80 hover:bg-foreground/5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-focus cursor-help"
        aria-label={t('title')}
      >
        <Lightbulb className="h-4 w-4" />
      </span>
    </Tooltip>
  )
}

/**
 * Props for the {@link SearchFilters} component
 */
type SearchFiltersProps = UseSearchFiltersLogicProps & {
  /** When filtering by a shared list, the display name of that list. Null otherwise. */
  sharedListName?: string | null
}

/**
 * Sidebar filter UI for the problems library.
 */
export const SearchFilters = ({
  filters,
  onFiltersChange,
  filterOptions,
  baseOptions,
  sharedListName,
}: SearchFiltersProps) => {
  // Translations
  const t = useTranslations('problems.filters')

  // Ref for the search input
  const searchTextRef = useRef<HTMLInputElement | null>(null)

  // Auth state
  const { isLoaded, isSignedIn } = useAuth()

  // Use a helper hook which provided the data needed to render the filters
  const {
    competitionTreeOpts,
    defaultExpandedIds,
    selectedTreeIds,
    handleCompetitionTreeChange,
    seasonOpts,
    tagOpts,
    authorOpts,
    numberOpts,
  } = useSearchFiltersLogic({
    filters,
    onFiltersChange,
    filterOptions,
    baseOptions,
  })

  // A helper function to update filters
  const updateFilter = createFilterUpdater(filters, onFiltersChange)

  // Clear user-specific filters when user logs out
  useEffect(() => {
    if (isLoaded && !isSignedIn && (filters.favoritesOnly || filters.markStatus)) {
      onFiltersChange({ ...filters, favoritesOnly: false, markStatus: null }, 'discrete')
    }
  }, [isLoaded, isSignedIn, filters, onFiltersChange])

  return (
    <div className="flex flex-col rounded-lg border border-foreground/10 bg-surface/95 shadow-lg lg:fixed lg:top-28 lg:bottom-8 lg:w-[var(--problems-sidebar-width)] lg:max-h-[calc(100vh-7rem)]">
      {/* Filters Body */}
      <div className="flex-grow overflow-y-auto p-3 sm:p-4 lg:p-5 lg:min-h-0">
        <div className="space-y-3 sm:space-y-4">
          {/* Section 0: Lists Dropdown — All / Liked / Custom lists */}
          <div className="mb-6">
            <ListsDropdown
              filters={filters}
              onFiltersChange={onFiltersChange}
              sharedListName={sharedListName}
            />
          </div>

          {/* Section 1: Full-text search */}
          <div>
            <div className="mb-2 sm:mb-3 flex items-center justify-between gap-2">
              <label htmlFor="search" className="text-xs sm:text-sm font-semibold text-foreground">
                {t('search.label')}
              </label>
              <TipsAndTricks />
            </div>
            <div className="relative">
              <input
                ref={searchTextRef}
                type="text"
                id="search"
                value={filters.searchText}
                onChange={(e) => updateFilter('searchText', e.target.value, 'text')}
                className={cn('form-input', filters.searchText && 'pr-9')}
                placeholder={t('search.placeholder')}
              />
              {filters.searchText && (
                <button
                  type="button"
                  onClick={() => {
                    updateFilter('searchText', '', 'text')
                    searchTextRef.current?.focus()
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded text-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                  aria-label={t('search.clear')}
                  title={t('search.clear')}
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="flex items-center mt-2 sm:mt-3">
              <input
                id="search-solution"
                type="checkbox"
                checked={filters.searchInSolution}
                onChange={(event) =>
                  updateFilter('searchInSolution', event.target.checked, 'discrete')
                }
                className="form-checkbox"
                disabled={!filters.searchText}
              />
              <label
                htmlFor="search-solution"
                className={cn(
                  'ml-2 text-xs sm:text-[14px] leading-none text-foreground transition-colors',
                  !filters.searchText && 'text-muted/40'
                )}
              >
                {t('search.searchInSolution')}
              </label>
            </div>
          </div>

          {/* Section 2: Contextual Filters */}
          <div className="space-y-3 sm:space-y-4 border-t border-muted/40 pt-3 sm:pt-4 py-2">
            <TreeSelectFacet
              title={t('facets.competition')}
              options={competitionTreeOpts}
              selected={selectedTreeIds}
              onChange={handleCompetitionTreeChange}
              searchPlaceholder={t('facets.searchCompetitions')}
              closedLabel={t('facets.allCompetitions')}
              defaultExpandedIds={defaultExpandedIds}
            />

            <MultiSelectFacet
              title={t('facets.season')}
              options={seasonOpts}
              selected={filters.seasons.map((item) => item.slug)}
              onChange={(next) => {
                updateFilter(
                  'seasons',
                  next.map((slug: string) => ({ slug, displayName: slug })),
                  'discrete'
                )
              }}
              searchPlaceholder={t('facets.searchSeasons')}
              closedLabel={t('facets.allSeasons')}
            />

            {/* Problem Numbers as a multi-select facet */}
            <MultiSelectFacet
              title={t('facets.problemNumber')}
              options={numberOpts}
              selected={filters.problemNumbers.map(String)}
              onChange={(next) => {
                onFiltersChange(
                  {
                    ...filters,
                    problemNumbers: next.map((id: string) => parseInt(id, 10)),
                  },
                  'discrete'
                )
              }}
              showSearch={false}
              closedLabel={t('facets.anyOrder')}
            />
          </div>

          {/* Section 3: Attribute Filters (Multi-select) */}
          <div className="space-y-3 sm:space-y-4 border-t border-muted/40 pt-3 sm:pt-4">
            <MultiSelectFacet
              title={t('facets.tags')}
              titleTooltip={t('facets.tagsTooltip')}
              closedLabel={t('facets.selectTags')}
              options={tagOpts}
              selected={filters.tags.map((item) => item.slug)}
              onChange={(next) => {
                updateFilter(
                  'tags',
                  next.map((slug: string) => ({ slug, displayName: slug })),
                  'discrete'
                )
              }}
              searchPlaceholder={t('facets.searchTags')}
              logic={{
                mode: filters.tagLogic,
                onChange: (mode) => updateFilter('tagLogic', mode, 'discrete'),
                labels: {
                  or: t('facets.logic.or'),
                  and: t('facets.logic.and'),
                },
              }}
              grouping={{
                keys: ['Area', 'Type', 'Goal', 'Technique'],
                labels: {
                  Area: t('facets.grouping.Area'),
                  Type: t('facets.grouping.Type'),
                  Goal: t('facets.grouping.Goal'),
                  Technique: t('facets.grouping.Technique'),
                },
              }}
            />

            <MultiSelectFacet
              title={t('facets.authors')}
              closedLabel={t('facets.selectAuthors')}
              options={authorOpts}
              selected={filters.authors.map((item) => item.slug)}
              onChange={(next) => {
                updateFilter(
                  'authors',
                  next.map((slug: string) => ({ slug, displayName: slug })),
                  'discrete'
                )
              }}
              searchPlaceholder={t('facets.searchAuthors')}
              logic={{
                mode: filters.authorLogic,
                onChange: (mode) => updateFilter('authorLogic', mode, 'discrete'),
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
