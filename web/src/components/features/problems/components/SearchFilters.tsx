import { useAuth } from '@clerk/nextjs'
import { Heart, Layers, Lightbulb, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import React, { useEffect, useRef } from 'react'

import { ManualHyphens } from '@/components/shared/components/ManualHyphens'
import { Tooltip } from '@/components/shared/components/Tooltip'
import { cn } from '@/components/shared/utils/css-utils'
import { useDeviceCapabilities } from '@/hooks/use-device-capabilities'
import { useLoginPromptToast } from '@/hooks/use-login-prompt-toast'

import {
  useSearchFiltersLogic,
  type UseSearchFiltersLogicProps,
} from '../hooks/use-search-filters-logic'
import { getProblemsPageUrl } from '../services/problem-api-urls'
import { createFilterUpdater } from '../utils/filter-update-utils'
import { serializeFilters } from '../utils/search-url-serialization'
import MultiSelectFacet from './facets/MultiSelectFacet'
import TreeSelectFacet from './facets/TreeSelectFacet'

/**
 * Props for {@link ModeToggleButton}
 */
type ModeToggleButtonProps = {
  /** Whether this button is active */
  isActive: boolean
  /** Click handler */
  onClick: () => void
  /** Button label */
  label: string
  /** Icon to show before label */
  icon?: React.ReactElement
  /** Whether button should show loading state */
  isLoading?: boolean
}

/**
 * Individual button within the mode toggle segmented control.
 */
const ModeToggleButton = ({ isActive, onClick, label, icon, isLoading }: ModeToggleButtonProps) => {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex-1 rounded-md px-2 py-2 text-sm font-medium transition-all duration-200 flex items-center justify-center gap-1.5 min-w-0',
        isActive ? 'text-white' : 'text-gray-400 hover:text-gray-300',
        isLoading && 'opacity-50 cursor-wait'
      )}
      title={label}
    >
      {/* Icon wrapper  */}
      <div className="shrink-0">
        {React.cloneElement(icon as React.ReactElement<{ className?: string }>, {
          className: cn(
            'h-3.5 w-3.5 transition-all duration-200',
            isActive ? 'fill-white text-white' : 'fill-none text-gray-400'
          ),
        })}
      </div>

      {/* Label */}
      <span className="truncate whitespace-nowrap">{label}</span>
    </button>
  )
}

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
        <div className="font-medium text-slate-200 mb-1.5">{t('search.title')}</div>
        <p className="text-slate-300/90">{t('search.text')}</p>
      </div>

      {/* Exclusive selection */}
      <div>
        <div className="font-medium text-slate-200 mb-1.5">{t('exclusive.title')}</div>
        {isTouchOnly ? (
          <p className="text-slate-300/90">{t('exclusive.touch', { intro: introText })}</p>
        ) : (
          <p className="text-slate-300/90">
            {t.rich('exclusive.desktop', {
              modifierKey,
              modifierName,
              intro: introText,
              kbd: (chunks: React.ReactNode) => (
                <kbd className="px-1 py-0.5 rounded bg-slate-600/50 text-xs font-mono">
                  {chunks}
                </kbd>
              ),
            })}
          </p>
        )}
      </div>

      {/* Logic toggle */}
      <div>
        <div className="font-medium text-slate-200 mb-1.5">{t('logic.title')}</div>
        <p className="text-slate-300/90">
          {t.rich('logic.text', {
            mono: (chunks: React.ReactNode) => (
              <span className="font-mono text-indigo-200">{chunks}</span>
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
        className="p-1 rounded text-slate-400 hover:text-amber-400/80 hover:bg-slate-700/50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 cursor-help"
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
type SearchFiltersProps = UseSearchFiltersLogicProps

/**
 * Sidebar filter UI for the problems library.
 */
export const SearchFilters = ({
  filters,
  onFiltersChange,
  filterOptions,
  baseOptions,
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

  // A function to show the login prompt toast to access favorites
  const showLoginPrompt = useLoginPromptToast()

  // Handle favorites button click
  const handleFavoritesClick = () => {
    // Still loading, do nothing
    if (!isLoaded) {
      return
    }

    // User is not signed in, show login prompt
    if (!isSignedIn) {
      // Create filters with favorites enabled to redirect correctly after login
      const nextFilters = { ...filters, favoritesOnly: true }
      const queryString = serializeFilters(nextFilters)
      const redirectUrl = getProblemsPageUrl(queryString)

      // Show login prompt with a redirect URL to the filter with favorite problems
      showLoginPrompt({ reason: t('myFavorites'), redirectUrl })
      return
    }

    // User is signed in, toggle favorites
    updateFilter('favoritesOnly', true, 'discrete')
  }

  // Clear favoritesOnly when user logs out
  useEffect(() => {
    if (isLoaded && !isSignedIn && filters.favoritesOnly) {
      updateFilter('favoritesOnly', false, 'discrete')
    }
  }, [isLoaded, isSignedIn, filters.favoritesOnly, updateFilter])

  return (
    <div className="flex flex-col rounded-lg border border-slate-600/40 bg-slate-800/95 shadow-lg lg:fixed lg:top-28 lg:bottom-8 lg:w-[var(--problems-sidebar-width)] lg:max-h-[calc(100vh-7rem)]">
      {/* Filters Body */}
      <div className="flex-grow overflow-y-auto p-3 sm:p-4 lg:p-5 lg:min-h-0">
        <div className="space-y-3 sm:space-y-4">
          {/* Section 0: Mode Switch - All vs Favorites */}
          <div className="mb-6">
            <div className="flex w-full rounded-lg p-1 border border-slate-600/40">
              <ModeToggleButton
                isActive={!filters.favoritesOnly}
                onClick={() => updateFilter('favoritesOnly', false, 'discrete')}
                icon={<Layers />}
                label={t('allProblems')}
              />
              <ModeToggleButton
                isActive={filters.favoritesOnly}
                onClick={handleFavoritesClick}
                isLoading={!isLoaded}
                icon={<Heart />}
                label={t('myFavorites')}
              />
            </div>
            {isLoaded && !isSignedIn && filters.favoritesOnly && (
              <p className="mt-2 text-xs text-slate-500 text-center px-2">
                {t('favoritesLoginRequired')}
              </p>
            )}
          </div>

          {/* Section 1: Full-text search */}
          <div>
            <div className="mb-2 sm:mb-3 flex items-center justify-between gap-2">
              <label htmlFor="search" className="text-xs sm:text-sm font-semibold text-slate-200">
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
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded text-slate-400 hover:text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
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
                  'ml-2 text-xs sm:text-[14px] leading-none text-slate-200 transition-colors',
                  !filters.searchText && 'text-slate-500'
                )}
              >
                {t('search.searchInSolution')}
              </label>
            </div>
          </div>

          {/* Section 2: Contextual Filters */}
          <div className="space-y-3 sm:space-y-4 border-t border-slate-500/70 pt-3 sm:pt-4 py-2">
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
          <div className="space-y-3 sm:space-y-4 border-t border-slate-500/70 pt-3 sm:pt-4">
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
