import { useMediaQuery } from '@mantine/hooks'
import { ChevronDown, ChevronUp, FilterX } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { slovakPlural } from '../../../shared/utils/string-utils'
import { ACTIVE_FILTERS_CONSTANTS } from '../constants/filter-constants'
import type { FilterOptionsWithCounts, SearchFiltersState } from '../types/problem-library-types'
import { generateCompetitionChips } from '../utils/competition-chips'
import { ActionsMenu } from './ActionsMenu'
import type { ChipData } from './CollapsibleChipGroup'
import { CollapsibleChipGroup } from './CollapsibleChipGroup'
import { MobileFilterButton } from './MobileFilterDrawer'
import { ShareButton } from './ShareButton'

/**
 * Props for the ActiveFiltersBar component.
 * This component displays all currently active filters as removable chips,
 * shows the count of matching problems, and provides controls for resetting
 * filters and accessing additional actions.
 */
type ActiveFiltersBarProps = {
  /** Current user selections across all filter dimensions. */
  filters: SearchFiltersState
  /** Available options with counts reflecting the current filtered result set. */
  filterOptions: FilterOptionsWithCounts
  /**
   * Snapshot of all available options at page load; ensures chips retain readable
   * labels even when filtering narrows options to zero (avoiding empty-state flicker).
   */
  baseOptions: FilterOptionsWithCounts
  /** Default filter state used when user clicks Reset. */
  initialFilters: SearchFiltersState
  /** Notifies parent of filter changes; type distinguishes UI updates (discrete vs text debouncing). */
  onFiltersChange: (newFilters: SearchFiltersState, type: 'discrete' | 'text') => void
  /** Total number of problems matching the active filters. */
  problemCount: number
  /** Whether technique tags (e.g., substitution, factoring) are currently visible on problem cards. */
  showTechniqueTags: boolean
  /** Toggles visibility of technique tags on problem cards. */
  onShowTagsChange: (show: boolean) => void
  /** Opens the mobile filter drawer; only provided on narrow viewports. */
  onMobileFilterClick?: () => void
  /** Indicates that search results are currently being fetched; shows loading state for count. */
  isSearching: boolean
}

export default function ActiveFiltersBar({
  filters,
  filterOptions,
  baseOptions,
  initialFilters,
  onFiltersChange,
  problemCount,
  showTechniqueTags,
  onShowTagsChange,
  onMobileFilterClick,
  isSearching,
}: ActiveFiltersBarProps) {
  const isSidebarVisible = useMediaQuery('(min-width: 1024px)')

  // Track manual user override; null means "auto mode" - follow filter count logic
  const [manualExpansionOverride, setManualExpansionOverride] = useState<boolean | null>(null)

  // Count total active filters across all dimensions
  const activeFilterCount =
    filters.seasons.length +
    filters.problemNumbers.length +
    filters.tags.length +
    filters.authors.length +
    filters.contestSelection.length +
    (filters.searchText ? 1 : 0)

  // Determine expansion state: manual override takes precedence, otherwise auto-decide based on filter count
  const areFiltersExpanded =
    manualExpansionOverride !== null
      ? manualExpansionOverride
      : isSidebarVisible && activeFilterCount <= ACTIVE_FILTERS_CONSTANTS.maxFiltersForAutoExpand

  // Reset manual override when filters are cleared (let auto-behavior take over again)
  useEffect(() => {
    if (activeFilterCount === 0) {
      setManualExpansionOverride(null)
    }
  }, [activeFilterCount])

  // --- Handlers for removing filters ---
  const handleClearAll = () => {
    onFiltersChange(
      {
        ...initialFilters,
      },
      'discrete'
    )
  }

  const handleRemoveMulti = (key: 'tags' | 'authors' | 'seasons', idToRemove: string) => {
    const updatedValues = filters[key].filter((item) => item.slug !== idToRemove)
    onFiltersChange({ ...filters, [key]: updatedValues }, 'discrete')
  }

  const handleRemoveProblemNumber = (numToRemove: number) => {
    const updated = filters.problemNumbers.filter((n) => n !== numToRemove)
    onFiltersChange({ ...filters, problemNumbers: updated }, 'discrete')
  }

  const handleRemoveSearchText = () => {
    onFiltersChange({ ...filters, searchText: '', searchInSolution: false }, 'text')
  }

  // --- Data Transformation and Grouping ---

  /**
   * Simplified option structure for internal mapping.
   * Transforms facet options into a minimal structure for label lookups.
   */
  type SingleOption = {
    /** Unique identifier matching the original facet slug */
    id: string
    /** Human-readable display name for the option */
    displayName: string
  }

  const seasonOptions = filterOptions.seasons.map((facet) => ({
    id: facet.slug,
    displayName: facet.displayName,
  }))
  const seasonOptionsBase = baseOptions.seasons.map((facet) => ({
    id: facet.slug,
    displayName: facet.displayName,
  }))

  const tagOptions = filterOptions.tags.map((facet) => ({
    id: facet.slug,
    displayName: facet.displayName,
  }))
  const tagOptionsBase = baseOptions.tags.map((facet) => ({
    id: facet.slug,
    displayName: facet.displayName,
  }))
  const authorOptions = filterOptions.authors.map((facet) => ({
    id: facet.slug,
    displayName: facet.displayName,
  }))
  const authorOptionsBase = baseOptions.authors.map((facet) => ({
    id: facet.slug,
    displayName: facet.displayName,
  }))

  /**
   * Returns a stable, human-readable label for the given id.
   * Looks in current options first, then falls back to base options.
   */
  const getLabel = (options: SingleOption[], id: string, base: SingleOption[]): string => {
    const current = options.find((option) => option.id === id)?.displayName
    if (current) return current
    return base.find((option) => option.id === id)?.displayName ?? id
  }

  // Generate competition chips using shared utility
  const competitionChips = useMemo(() => {
    return generateCompetitionChips(filters, baseOptions, onFiltersChange)
  }, [filters, baseOptions, onFiltersChange])

  // Create search text chip if there's an active search
  const searchTextChip =
    filters.searchText && filters.searchText.trim().length > 0
      ? {
          id: 'search-text',
          displayName: `"${filters.searchText}"${filters.searchInSolution ? ' (v zadaní aj riešení)' : ''}`,
          onRemove: handleRemoveSearchText,
        }
      : null

  // Sort selected items by their position in the original options
  const sortByOriginalOrder = <T extends { slug: string }>(selected: T[], originalOptions: T[]) => {
    const positionMap = new Map<string, number>()
    for (let index = 0; index < originalOptions.length; index++) {
      positionMap.set(originalOptions[index].slug, index)
    }
    return [...selected].sort((a, b) => {
      const positionA = positionMap.get(a.slug) ?? Number.MAX_SAFE_INTEGER
      const positionB = positionMap.get(b.slug) ?? Number.MAX_SAFE_INTEGER
      return positionA - positionB
    })
  }

  // Sort all chips (competitions are already sorted)
  const sortedSeasons = sortByOriginalOrder(filters.seasons, baseOptions.seasons)
  const sortedProblemNumbers = [...filters.problemNumbers].sort((a, b) => a - b)
  const sortedTags = sortByOriginalOrder(filters.tags, baseOptions.tags)
  const sortedAuthors = sortByOriginalOrder(filters.authors, baseOptions.authors)

  const filterGroups = [
    // Show search text first if active (most immediate/recent filter)
    ...(searchTextChip
      ? [
          {
            label: 'Hľadaný text',
            chips: [searchTextChip],
          },
        ]
      : []),
    {
      label: 'Súťaže',
      chips: competitionChips,
    },
    {
      label: 'Ročníky',
      chips: sortedSeasons.map((item) => ({
        id: `season-${item.slug}`,
        displayName: getLabel(seasonOptions, item.slug, seasonOptionsBase),
        onRemove: () => handleRemoveMulti('seasons', item.slug),
      })),
    },
    {
      label: 'Poradie úlohy',
      chips: sortedProblemNumbers.map((n) => ({
        id: `number-${n}`,
        displayName: String(n),
        onRemove: () => handleRemoveProblemNumber(n),
      })),
    },
    {
      label: 'Kľúčové slová',
      logic: filters.tagLogic,
      chips: sortedTags.map((item) => ({
        id: `tag-${item.slug}`,
        displayName: getLabel(tagOptions, item.slug, tagOptionsBase),
        onRemove: () => handleRemoveMulti('tags', item.slug),
      })),
    },
    {
      label: 'Autori',
      logic: filters.authorLogic,
      chips: sortedAuthors.map((item) => ({
        id: `author-${item.slug}`,
        displayName: getLabel(authorOptions, item.slug, authorOptionsBase),
        onRemove: () => handleRemoveMulti('authors', item.slug),
      })),
    },
  ].filter((group) => group.chips.length > 0)

  const activeTokenCount = filterGroups.reduce((sum, g) => sum + g.chips.length, 0)
  const hasAnyActive =
    activeTokenCount > 0 ||
    Boolean(filters.searchText && filters.searchText.trim().length > 0) ||
    Boolean(filters.searchInSolution)

  return (
    <div className="rounded-xl border border-slate-600/60 bg-slate-800/90 p-3 backdrop-blur-sm lg:p-4">
      {/* Custom breakpoint for Share button visibility + Mobile padding reduction */}
      <style>{`
        @media (min-width: 500px) {
          .share-custom-show { display: inline-flex !important; }
          .separator-custom-show { display: block !important; }
          .separator-custom-hide { display: none !important; }
          /* Hide Share items in dropdown menu at larger screens */
          .share-custom-hide-content > :first-child,
          .share-custom-hide-content > :nth-child(2) { display: none !important; }
        }
      `}</style>
      {/* Header Row - completely prevent wrapping */}
      <div className="flex flex-nowrap items-center justify-between gap-x-2 min-w-0">
        {/* STATUS (Left Side) */}
        <div className="flex items-center gap-2 text-sm flex-shrink min-w-0">
          {isSidebarVisible ? (
            <div className="flex items-center gap-2 flex-shrink-0">
              <h2 className="font-semibold text-slate-300 whitespace-nowrap">Aktívne filtre</h2>
              {activeTokenCount > 0 && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-500 text-xs font-medium text-white">
                  {activeTokenCount}
                </span>
              )}
            </div>
          ) : (
            onMobileFilterClick && (
              <MobileFilterButton
                onClick={onMobileFilterClick}
                activeFilterCount={activeTokenCount}
              />
            )
          )}

          {/* Separator */}
          <div className="h-6 w-px bg-slate-600/40 flex-shrink-0" />

          {/* Compact count - show loading skeleton when searching */}
          {isSearching ? (
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <div className="h-3.5 w-16 animate-pulse rounded bg-slate-700" />
            </div>
          ) : (
            <div className="text-slate-400 flex-shrink-0 whitespace-nowrap text-xs">
              {problemCount} {slovakPlural(problemCount, ['úloha', 'úlohy', 'úloh'])}
            </div>
          )}
        </div>

        {/* ACTION (Right Side) */}
        <div className="flex flex-nowrap items-center justify-end gap-x-1.5 sm:gap-x-2 flex-shrink-0">
          {/* Toggle button to expand/collapse filter chips - only show when there are active filters */}
          {filterGroups.length > 0 && (
            <button
              onClick={() => setManualExpansionOverride(!areFiltersExpanded)}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400
                hover:bg-white/5 hover:text-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500
                flex-shrink-0"
              aria-label={areFiltersExpanded ? 'Skryť filtre' : 'Zobraziť filtre'}
              title={areFiltersExpanded ? 'Skryť filtre' : 'Zobraziť filtre'}
            >
              {areFiltersExpanded ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </button>
          )}
          {/* Share button - custom breakpoint at 700px */}
          <ShareButton
            filters={filters}
            className="hidden share-custom-show h-7 items-center gap-1.5 rounded-md px-2.5 text-xs text-slate-400
            hover:bg-white/5 hover:text-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500
            disabled:opacity-30 disabled:pointer-events-none whitespace-nowrap"
          />

          {/* Reset button - icon always visible, text hidden on small screens */}
          <button
            onClick={handleClearAll}
            disabled={!hasAnyActive}
            className="inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs text-slate-400
               hover:bg-white/5 hover:text-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500
               disabled:opacity-30 disabled:pointer-events-none whitespace-nowrap"
            aria-label="Resetovať filtre"
            title="Resetovať filtre"
          >
            <FilterX className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="hidden sm:inline">Resetovať</span>
          </button>

          {/* Actions Menu - contains Share (mobile only) and Technique toggle (always) */}
          <ActionsMenu
            showTechniqueTags={showTechniqueTags}
            onShowTagsChange={onShowTagsChange}
            filters={filters}
          />
        </div>
      </div>

      {/* Filter Rows - only show when filters are active and expanded */}
      {filterGroups.length > 0 && areFiltersExpanded && (
        <div
          className="max-h-[40vh] overflow-y-auto border-t border-slate-600/60 pt-3 mt-3 lg:mt-4 lg:pt-4 animate-in fade-in slide-in-from-top-2 duration-200 pr-1"
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgb(71 85 105) transparent',
          }}
        >
          <div className="space-y-3 sm:space-y-4">
            {filterGroups.map((group, groupIndex) => {
              return (
                <div key={group.label}>
                  <div className="grid grid-cols-1 gap-y-1.5 sm:grid-cols-[5.5rem_1fr] sm:items-baseline sm:gap-x-4 sm:gap-y-0 md:grid-cols-[6rem_1fr] lg:grid-cols-[6.5rem_1fr] xl:grid-cols-[7rem_1fr]">
                    <span className="whitespace-nowrap text-sm font-medium text-slate-400">
                      {group.label}:
                    </span>

                    <CollapsibleChipGroup chips={group.chips as ChipData[]} mode={group.logic} />
                  </div>

                  {/* Divider between groups on mobile only (not after the last one) */}
                  {groupIndex < filterGroups.length - 1 && (
                    <div className="mt-3 border-t border-slate-600/30 sm:hidden" />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
