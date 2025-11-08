import { useMediaQuery } from '@mantine/hooks'
import { ChevronDown, ChevronUp, FilterX, Loader2 } from 'lucide-react'
import * as React from 'react'
import { useEffect, useMemo, useState } from 'react'

import { isExclusiveSelection } from '../../../shared/utils/event-utils'
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

  // --- Handlers for clearing filters ---
  const handleClearAll = () => {
    onFiltersChange(
      {
        ...initialFilters,
      },
      'discrete'
    )
  }

  // --- Handlers for toggling filters (with Ctrl+Click support) ---
  const handleToggleMulti = (
    key: 'tags' | 'authors' | 'seasons' | 'problemNumbers',
    idToToggle: string | number,
    event: React.MouseEvent
  ) => {
    // Handle problemNumbers separately (array of numbers)
    if (key === 'problemNumbers') {
      const numToToggle = idToToggle as number
      // Ctrl/Cmd+Click: exclusive selection (keep only this one)
      if (isExclusiveSelection(event)) {
        onFiltersChange({ ...filters, problemNumbers: [numToToggle] }, 'discrete')
        return
      }

      // Normal click: toggle this number
      const isSelected = filters.problemNumbers.includes(numToToggle)
      if (isSelected) {
        // Remove the number
        const updated = filters.problemNumbers.filter((number) => number !== numToToggle)
        onFiltersChange({ ...filters, problemNumbers: updated }, 'discrete')
      } else {
        // Add the number (sorted)
        onFiltersChange(
          {
            ...filters,
            problemNumbers: [...filters.problemNumbers, numToToggle].sort((a, b) => a - b),
          },
          'discrete'
        )
      }
      return
    }

    // Handle tags/authors/seasons (arrays of objects with slug)
    const slugToToggle = idToToggle as string
    // Ctrl/Cmd+Click: exclusive selection (keep only this one)
    if (isExclusiveSelection(event)) {
      const item = filters[key].find((item) => item.slug === slugToToggle)
      if (item) {
        onFiltersChange({ ...filters, [key]: [item] }, 'discrete')
      }
      return
    }

    // Normal click: toggle this item
    const isSelected = filters[key].some((item) => item.slug === slugToToggle)
    if (isSelected) {
      // Remove the item
      const updatedValues = filters[key].filter((item) => item.slug !== slugToToggle)
      onFiltersChange({ ...filters, [key]: updatedValues }, 'discrete')
    } else {
      // Add the item (find it from options)
      const itemToAdd =
        filterOptions[key].find((item) => item.slug === slugToToggle) ||
        baseOptions[key].find((item) => item.slug === slugToToggle)
      if (itemToAdd) {
        onFiltersChange({ ...filters, [key]: [...filters[key], itemToAdd] }, 'discrete')
      }
    }
  }
  const handleToggleSearchText = (event: React.MouseEvent) => {
    // Ctrl/Cmd+Click: exclusive selection (keep only search, remove all other filters)
    if (isExclusiveSelection(event)) {
      onFiltersChange(
        {
          ...initialFilters,
          searchText: filters.searchText,
          searchInSolution: filters.searchInSolution,
        },
        'text'
      )
      return
    }

    // Normal click: remove search text
    onFiltersChange({ ...filters, searchText: '', searchInSolution: false }, 'text')
  }

  // --- Handlers for toggling logic modes ---
  const handleToggleTagLogic = () => {
    const newLogic = filters.tagLogic === 'and' ? 'or' : 'and'
    onFiltersChange({ ...filters, tagLogic: newLogic }, 'discrete')
  }

  const handleToggleAuthorLogic = () => {
    const newLogic = filters.authorLogic === 'and' ? 'or' : 'and'
    onFiltersChange({ ...filters, authorLogic: newLogic }, 'discrete')
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
          onClick: handleToggleSearchText,
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
      chips: sortedSeasons.map((season) => ({
        id: `season-${season.slug}`,
        displayName: getLabel(seasonOptions, season.slug, seasonOptionsBase),
        onClick: (event: React.MouseEvent) => handleToggleMulti('seasons', season.slug, event),
      })),
    },
    {
      label: 'Poradie úlohy',
      chips: sortedProblemNumbers.map((number) => ({
        id: `number-${number}`,
        displayName: String(number),
        onClick: (event: React.MouseEvent) => handleToggleMulti('problemNumbers', number, event),
      })),
    },
    {
      label: 'Kľúčové slová',
      logic: filters.tagLogic,
      onLogicToggle: handleToggleTagLogic,
      chips: sortedTags.map((keyword) => ({
        id: `tag-${keyword.slug}`,
        displayName: getLabel(tagOptions, keyword.slug, tagOptionsBase),
        onClick: (event: React.MouseEvent) => handleToggleMulti('tags', keyword.slug, event),
      })),
    },
    {
      label: 'Autori',
      logic: filters.authorLogic,
      onLogicToggle: handleToggleAuthorLogic,
      chips: sortedAuthors.map((author) => ({
        id: `author-${author.slug}`,
        displayName: getLabel(authorOptions, author.slug, authorOptionsBase),
        onClick: (event: React.MouseEvent) => handleToggleMulti('authors', author.slug, event),
      })),
    },
  ].filter((group) => group.chips.length > 0)

  const activeTokenCount = filterGroups.reduce((sum, g) => sum + g.chips.length, 0)
  const hasAnyActive =
    activeTokenCount > 0 ||
    Boolean(filters.searchText && filters.searchText.trim().length > 0) ||
    Boolean(filters.searchInSolution)

  return (
    <div className="rounded-xl border border-slate-600/60 bg-slate-800 p-3 lg:p-4">
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
              <h2 className="font-semibold text-slate-200 whitespace-nowrap">Aktívne filtre</h2>
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

          {/* Compact count with spinner when searching */}
          {isSearching ? (
            <Loader2
              className="h-3 w-3 animate-spin text-slate-400 flex-shrink-0"
              aria-label="Vyhľadávam"
            />
          ) : (
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <div className="text-slate-400 flex-shrink-0 whitespace-nowrap text-xs">
                {problemCount} {slovakPlural(problemCount, ['úloha', 'úlohy', 'úloh'])}
              </div>
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

                    <CollapsibleChipGroup
                      chips={group.chips as ChipData[]}
                      mode={group.logic}
                      onModeToggle={group.onLogicToggle}
                    />
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
