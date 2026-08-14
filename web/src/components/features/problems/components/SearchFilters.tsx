import { useAuth } from '@clerk/nextjs'
import { Lightbulb, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import React, { useEffect, useRef } from 'react'

import { MultiSelectFacet } from '@/components/shared/components/facets/components/MultiSelectFacet'
import { TreeSelectFacet } from '@/components/shared/components/facets/components/TreeSelectFacet'
import { Kbd } from '@/components/shared/components/Kbd'
import { ManualHyphens } from '@/components/shared/components/ManualHyphens'
import { Tooltip } from '@/components/shared/components/Tooltip'
import { cn } from '@/components/shared/utils/css-utils'
import { useDeviceCapabilities } from '@/hooks/use-device-capabilities'

import {
  useSearchFiltersLogic,
  type UseSearchFiltersLogicProps,
} from '../hooks/use-search-filters-logic'
import { createFilterUpdater } from '../utils/filter-update-utils'
import { ListsDropdown } from './ListsDropdown'

/**
 * The hint beside the search box, explaining what the filters can do that isn't visible:
 * which languages a search covers, the modifier that narrows a facet to one value, and
 * what the AND/OR toggle means.
 */
function TipsAndTricks() {
  // Translations for the filter hints
  const t = useTranslations('problems.filters.tips')

  // The lead-in both the touch and desktop wordings are built around
  const introText = t('intro')

  // The modifier is named differently per platform, and absent entirely on touch
  const { isMac, isTouchOnly } = useDeviceCapabilities()

  // The key as it is printed, and as it is spoken
  const modifierKey = isMac ? '⌘' : 'Ctrl'
  const modifierName = isMac ? 'Cmd' : 'Ctrl'

  // The hint's body
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
              kbd: (chunks: React.ReactNode) => <Kbd>{chunks}</Kbd>,
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
 * The props of {@link SearchFilters}.
 */
type SearchFiltersProps = UseSearchFiltersLogicProps & {
  /** When filtering by a shared list, the display name of that list. Null otherwise. */
  sharedListName?: string | null
}

/**
 * The problem library's filter sidebar: full-text search, then the facets that narrow by
 * where a problem came from and what it is about.
 */
export const SearchFilters = ({
  filters,
  onFiltersChange,
  filterOptions,
  baseOptions,
  sharedListName,
}: SearchFiltersProps) => {
  // Translations for the filter sidebar
  const t = useTranslations('problems.filters')

  // The search box
  const searchTextRef = useRef<HTMLInputElement | null>(null)

  // Two filters are only meaningful to a signed-in user, so their sign-in state matters
  const { isLoaded, isSignedIn } = useAuth()

  // Everything the facets render from, and the one handler the tree writes back through
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

  // A function which writes one filter back, carrying the rules that tie filters together
  const updateFilter = createFilterUpdater(filters, onFiltersChange)

  // Signing out has to take the filters that only mean something signed in with it
  useEffect(() => {
    // Waiting for the auth state to load keeps a signed-in user's filters from being dropped
    if (isLoaded && !isSignedIn && (filters.favoritesOnly || filters.markStatus)) {
      onFiltersChange({ ...filters, favoritesOnly: false, markStatus: null })
    }
  }, [isLoaded, isSignedIn, filters, onFiltersChange])

  return (
    <div className="flex flex-col rounded-lg border border-foreground/10 bg-surface/95 shadow-lg lg:fixed lg:top-28 lg:bottom-8 lg:w-[var(--problems-sidebar-width)] lg:max-h-[calc(100vh-7rem)]">
      {/* Scrolling body, holding every facet */}
      <div className="flex-grow overflow-y-auto p-3 sm:p-4 lg:p-5 lg:min-h-0">
        <div className="space-y-3 sm:space-y-4">
          {/* List picker */}
          <div className="mb-6">
            <ListsDropdown
              filters={filters}
              onFiltersChange={onFiltersChange}
              sharedListName={sharedListName}
            />
          </div>

          {/* Full-text search */}
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
                onChange={(event) => updateFilter('searchText', event.target.value)}
                className={cn('form-input', filters.searchText && 'pr-9')}
                placeholder={t('search.placeholder')}
              />
              {filters.searchText && (
                <button
                  type="button"
                  onClick={() => {
                    // Emptying the term also drops the search-in-solutions scope
                    updateFilter('searchText', '')

                    // Clearing by the button would otherwise leave the caret nowhere
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
                onChange={(event) => updateFilter('searchInSolution', event.target.checked)}
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

          {/* Where a problem came from */}
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
                  next.map((slug: string) => ({ slug, displayName: slug, fullName: null }))
                )
              }}
              searchPlaceholder={t('facets.searchSeasons')}
              closedLabel={t('facets.allSeasons')}
            />

            <MultiSelectFacet
              title={t('facets.problemNumber')}
              options={numberOpts}
              selected={filters.problemNumbers.map(String)}
              onChange={(next) => {
                onFiltersChange({
                  ...filters,
                  problemNumbers: next.map((id: string) => parseInt(id, 10)),
                })
              }}
              showSearch={false}
              closedLabel={t('facets.anyOrder')}
            />
          </div>

          {/* What a problem is about, and who wrote it */}
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
                  next.map((slug: string) => ({ slug, displayName: slug, fullName: null }))
                )
              }}
              searchPlaceholder={t('facets.searchTags')}
              logic={{
                mode: filters.tagLogic,
                onChange: (mode) => updateFilter('tagLogic', mode),
                labels: {
                  or: t('facets.logic.or'),
                  and: t('facets.logic.and'),
                },
              }}
              grouping={{
                keys: ['area', 'type', 'goal', 'technique'],
                labels: {
                  area: t('facets.grouping.area'),
                  type: t('facets.grouping.type'),
                  goal: t('facets.grouping.goal'),
                  technique: t('facets.grouping.technique'),
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
                  next.map((slug: string) => ({ slug, displayName: slug, fullName: null }))
                )
              }}
              searchPlaceholder={t('facets.searchAuthors')}
              logic={{
                mode: filters.authorLogic,
                onChange: (mode) => updateFilter('authorLogic', mode),
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
