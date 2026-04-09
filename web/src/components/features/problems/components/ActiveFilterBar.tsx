import { useMediaQuery } from '@mantine/hooks'
import { Check, ChevronDown, ChevronUp, FilterX, Grid3X3, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import * as React from 'react'
import { useEffect, useMemo, useState } from 'react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../../shared/components/DropdownMenu'
import { isExclusiveSelection } from '../../../shared/utils/event-utils'
import { ACTIVE_FILTERS_CONSTANTS } from '../constants/filter-constants'
import { usePrefetchContestBrowser } from '../hooks/use-contest-browser'
import { useContestBrowserModal } from '../hooks/use-contest-browser-modal'
import type {
  FilterOptionsWithCounts,
  MarkStatusFilter,
  SearchFiltersState,
} from '../types/problem-library-types'
import { generateCompetitionChips } from '../utils/competition-chips'
import { interpretSelectionParts } from '../utils/selection-interpreter'
import { createDefaultFilters } from '../utils/url-initialization'
import { ActionsMenu } from './ActionsMenu'
import type { ChipData } from './CollapsibleChipGroup'
import { CollapsibleChipGroup } from './CollapsibleChipGroup'
import { ContestBrowserModal, type ContestBrowserSelection } from './ContestBrowserModal'
import { MobileFilterButton } from './MobileFilterDrawer'
import { ShareButton } from './ShareButton'

/**
 * Props for the {@link ActiveFiltersBar} component.
 */
type ActiveFiltersBarProps = {
  /** Current user selections across all filter dimensions. */
  filters: SearchFiltersState
  /** Available options with counts reflecting the current filtered result set. */
  filterOptions: FilterOptionsWithCounts
  /** Snapshot of all available options at page load. */
  baseOptions: FilterOptionsWithCounts
  /** Notifies parent of filter changes; type distinguishes UI updates (discrete vs text debouncing). */
  onFiltersChange: (newFilters: SearchFiltersState, type: 'discrete' | 'text') => void
  /** Total number of problems matching the active filters. */
  problemCount: number
  /** Whether technique tags (e.g., substitution, factoring) are currently visible on problem cards. */
  showTechniqueTags: boolean
  /** Toggles visibility of technique tags on problem cards. */
  onShowTechniqueTagsChange: (show: boolean) => void
  /** Opens the mobile filter drawer; only provided on narrow viewports. */
  onMobileFilterClick?: () => void
  /** Indicates that search results are currently being fetched; shows loading state for count. */
  isSearching: boolean
}

/**
 * The component which displays:
 * 1. A count of the number of problems matching the active filters
 * 2. A list of active filters as removable chips
 * 3. A "Clear All" button to reset all filters
 * 4. A "Technique Tags" toggle (inside a menu) to show/hide technique tags on problem cards
 * 5. A "Contest Browser" button to open a modal for selecting competitions
 * 6. A "Share" button to share the current filters (visible on xl screens only)
 * 7. A "Mark Status" dropdown to filter by marked/unmarked problems
 * 8. A "Mobile Filter" button to open the mobile filter drawer on narrow viewports
 * 9. A button to expand/collapse the filter sidebar. If there are too many filters,
 *    the sidebar will always be collapsed automatically.
 */
export default function ActiveFiltersBar({
  filters,
  filterOptions,
  baseOptions,
  onFiltersChange,
  problemCount,
  showTechniqueTags,
  onShowTechniqueTagsChange,
  onMobileFilterClick,
  isSearching,
}: ActiveFiltersBarProps) {
  // Get default filters for reset functionality
  const defaultFilters = createDefaultFilters()

  // Translations for plurals
  const tPlurals = useTranslations('plurals')

  // Translations for the filters bar
  const tFilters = useTranslations('problems.filters')

  // Sidebar is visible on the desktop viewports
  // Visibility is needed for instance to show the button to open the sidebar
  const isSidebarVisible = useMediaQuery('(min-width: 1024px)')

  // Contest browser modal state - synced with URL
  const contestBrowser = useContestBrowserModal()

  // The prefetcher for the contest browser modal, used in on hover to start before click
  const prefetchContestBrowser = usePrefetchContestBrowser()

  // This value is used to override the automatic expansion/collapse logic
  // If it is set to true, the sidebar will always be expanded.
  // If it is set to false, the sidebar will always be collapsed.
  // If it is null, the sidebar will follow the automatic expansion/collapse logic.
  const [manualExpansionOverride, setManualExpansionOverride] = useState<boolean | null>(null)

  // Handle contest selection from the browser modal
  const handleContestSelect = (selection: ContestBrowserSelection) => {
    // Look up season display name from the base option...The result
    // should be there, unless the season slug is somehow invalid or
    // the base options are stale?
    const seasonDisplayName =
      baseOptions.seasons.find((season) => season.slug === selection.seasonSlug)?.displayName ??
      selection.seasonSlug

    // Build selection parts for the function which will
    // figure out the contest selection (based on the competition tree)
    // Note: categorySlug and roundSlug can be null, so we filter them out
    const parts: string[] = [
      selection.competitionSlug,
      selection.categorySlug,
      selection.roundSlug,
    ].filter((part): part is string => part != null)

    // Use existing utility to resolve display names from the competition tree
    const contestSelections = interpretSelectionParts([parts], baseOptions.competitions)

    // Update filters with the new selection
    onFiltersChange(
      {
        ...defaultFilters,
        seasons: [{ slug: selection.seasonSlug, displayName: seasonDisplayName }],
        contestSelection: contestSelections ?? [],
      },
      'discrete'
    )

    // Close modal UI state without a second URL update (filters already handled it)
    contestBrowser.closeWithoutUrlUpdate()
  }

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
        ...defaultFilters,
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
          ...defaultFilters,
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

  // Handler for changing the tag logic
  const handleToggleTagLogic = () => {
    const newLogic = filters.tagLogic === 'and' ? 'or' : 'and'
    onFiltersChange({ ...filters, tagLogic: newLogic }, 'discrete')
  }

  // Handler for changing the author logic
  const handleToggleAuthorLogic = () => {
    const newLogic = filters.authorLogic === 'and' ? 'or' : 'and'
    onFiltersChange({ ...filters, authorLogic: newLogic }, 'discrete')
  }

  // Handler for changing the mark status filter
  const handleMarkStatusChange = (status: MarkStatusFilter | null) => {
    onFiltersChange({ ...filters, markStatus: status }, 'discrete')
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
          displayName: `"${filters.searchText}"${filters.searchInSolution ? ` ${tFilters('searchInSolutionSuffix')}` : ''}`,
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
            label: tFilters('searchedText'),
            chips: [searchTextChip],
          },
        ]
      : []),
    // Show mark status chip when filtering by marked/unmarked
    ...(filters.markStatus
      ? [
          {
            label: tFilters('markStatus'),
            chips: [
              {
                id: 'markStatus',
                displayName:
                  filters.markStatus === 'marked'
                    ? tFilters('markStatusMarked')
                    : filters.markStatus === 'unmarked'
                      ? tFilters('markStatusUnmarked')
                      : 'Invalid mark status',
                onClick: () => onFiltersChange({ ...filters, markStatus: null }, 'discrete'),
              },
            ],
          },
        ]
      : []),
    {
      label: tFilters('competitions'),
      chips: competitionChips,
    },
    {
      label: tFilters('seasons'),
      chips: sortedSeasons.map((season) => ({
        id: `season-${season.slug}`,
        displayName: getLabel(seasonOptions, season.slug, seasonOptionsBase),
        onClick: (event: React.MouseEvent) => handleToggleMulti('seasons', season.slug, event),
      })),
    },
    {
      label: tFilters('facets.problemNumber'),
      chips: sortedProblemNumbers.map((number) => ({
        id: `number-${number}`,
        displayName: String(number),
        onClick: (event: React.MouseEvent) => handleToggleMulti('problemNumbers', number, event),
      })),
    },
    {
      label: tFilters('facets.tags'),
      logic: filters.tagLogic,
      onLogicToggle: handleToggleTagLogic,
      chips: sortedTags.map((keyword) => ({
        id: `tag-${keyword.slug}`,
        displayName: getLabel(tagOptions, keyword.slug, tagOptionsBase),
        onClick: (event: React.MouseEvent) => handleToggleMulti('tags', keyword.slug, event),
      })),
    },
    {
      label: tFilters('facets.authors'),
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
    Boolean(filters.searchInSolution) ||
    Boolean(filters.markStatus)

  return (
    <div className="rounded-xl border border-foreground/10 bg-surface p-3 lg:p-4">
      {/* Custom breakpoints for label visibility */}
      <style>{`
        /* Show labels and expand gaps on wider mobile screens (no sidebar yet) */
        @media (min-width: 650px) {
          .label-custom-show { display: inline !important; }
          .gap-custom-expand { gap: 0.5rem !important; }
        }
        /* Hide labels again when sidebar appears (lg) — not enough room */
        @media (min-width: 1024px) and (max-width: 1279px) {
          .label-custom-show { display: none !important; }
        }
      `}</style>
      {/* Header Row */}
      <div className="flex flex-nowrap items-center justify-between gap-x-0.5 min-[400px]:gap-x-1.5 gap-custom-expand min-w-0">
        {/* STATUS (Left Side) */}
        <div className="flex items-center gap-0.5 min-[400px]:gap-1.5 gap-custom-expand text-sm flex-shrink min-w-0">
          {isSidebarVisible ? (
            <div className="flex items-center gap-2 flex-shrink-0">
              <h2 className="font-semibold text-foreground whitespace-nowrap">
                {tFilters('activeFilters')}
              </h2>
              {activeTokenCount > 0 && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-focus text-xs font-medium text-focus-foreground">
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
          <div className="hidden lg:block h-6 w-px bg-foreground/10 flex-shrink-0" />

          {/* Compact count with spinner when searching */}
          {isSearching ? (
            <Loader2
              className="ml-2 h-3 w-3 animate-spin text-muted flex-shrink-0"
              aria-label={tFilters('searching')}
            />
          ) : (
            <div className="ml-2 flex items-center gap-1.5 flex-shrink-0">
              <div className="text-muted flex-shrink-0 whitespace-nowrap text-xs">
                {tPlurals('problems', { count: problemCount })}
              </div>
            </div>
          )}

          {/* Toggle button to expand/collapse filter chips */}
          {filterGroups.length > 0 && (
            <button
              onClick={() => setManualExpansionOverride(!areFiltersExpanded)}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted
                hover:bg-foreground/5 hover:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-focus
                flex-shrink-0"
              aria-label={areFiltersExpanded ? tFilters('hideFilters') : tFilters('showFilters')}
              title={areFiltersExpanded ? tFilters('hideFilters') : tFilters('showFilters')}
            >
              {areFiltersExpanded ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </button>
          )}
        </div>

        {/* ACTION (Right Side) */}
        <div className="flex flex-nowrap items-center justify-end gap-x-0 min-[400px]:gap-x-1 sm:gap-x-2 flex-shrink-0">
          {/* Contest browser button */}
          <button
            onClick={contestBrowser.open}
            onMouseEnter={prefetchContestBrowser}
            className="inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs text-muted
              hover:bg-foreground/5 hover:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-focus
              whitespace-nowrap"
            aria-label={tFilters('contestsOverview')}
            title={tFilters('contestsOverview')}
          >
            <Grid3X3 className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="hidden label-custom-show">{tFilters('competitions')}</span>
          </button>

          {/* Share button */}
          <ShareButton
            filters={filters}
            className="hidden xl:inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs text-muted
            hover:bg-foreground/5 hover:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-focus
            disabled:opacity-30 disabled:pointer-events-none whitespace-nowrap"
          />

          {/* Mark status dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={`inline-flex h-7 items-center gap-1 rounded-md px-2.5 text-xs whitespace-nowrap
                  hover:bg-foreground/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus
                  ${filters.markStatus === 'marked' ? 'text-success' : filters.markStatus === 'unmarked' ? 'text-warning' : 'text-muted hover:text-muted-foreground'}`}
                aria-label={tFilters('markStatus')}
                title={tFilters('markStatus')}
              >
                <Check className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="hidden label-custom-show">
                  {filters.markStatus
                    ? filters.markStatus === 'marked'
                      ? tFilters('markStatusMarked')
                      : tFilters('markStatusUnmarked')
                    : tFilters('markStatus')}
                </span>
                <ChevronDown className="h-3 w-3 flex-shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-40"
              onCloseAutoFocus={(e) => e.preventDefault()}
            >
              <DropdownMenuItem
                className="cursor-pointer"
                onSelect={() => handleMarkStatusChange(null)}
              >
                <span className={!filters.markStatus ? 'text-focus-light/80' : ''}>
                  {tFilters('markStatusAll')}
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer"
                onSelect={() => handleMarkStatusChange('marked')}
              >
                <span className={filters.markStatus === 'marked' ? 'text-success/80' : ''}>
                  {tFilters('markStatusMarked')}
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer"
                onSelect={() => handleMarkStatusChange('unmarked')}
              >
                <span className={filters.markStatus === 'unmarked' ? 'text-warning/80' : ''}>
                  {tFilters('markStatusUnmarked')}
                </span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Reset button */}
          <button
            onClick={handleClearAll}
            disabled={!hasAnyActive}
            className="inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs text-muted
               hover:bg-foreground/5 hover:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-focus
               disabled:opacity-30 disabled:pointer-events-none whitespace-nowrap"
            aria-label={tFilters('resetFilters')}
            title={tFilters('resetFilters')}
          >
            <FilterX className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="hidden sm:inline">{tFilters('reset')}</span>
          </button>

          {/* Actions Menu */}
          <ActionsMenu
            showTechniqueTags={showTechniqueTags}
            onShowTagsChange={onShowTechniqueTagsChange}
            filters={filters}
          />
        </div>
      </div>

      {/* Filter Rows - only show when filters are active and expanded */}
      {filterGroups.length > 0 && areFiltersExpanded && (
        <div
          className="max-h-[40vh] overflow-y-auto border-t border-foreground/10 pt-3 mt-3 lg:mt-4 lg:pt-4 animate-in fade-in slide-in-from-top-2 duration-200 pr-1"
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
                    {/* Group header (what we're filtering by) */}
                    <span className="whitespace-nowrap text-sm font-medium text-muted">
                      {group.label}:
                    </span>

                    {/* Chip Group (the actual filters) */}
                    <CollapsibleChipGroup
                      chips={group.chips as ChipData[]}
                      logicalChipsProps={
                        group.logic && group.onLogicToggle
                          ? {
                              mode: group.logic,
                              onModeToggle: group.onLogicToggle,
                            }
                          : undefined
                      }
                    />
                  </div>

                  {/* Divider between groups on mobile only (not after the last one) */}
                  {groupIndex < filterGroups.length - 1 && (
                    <div className="mt-3 border-t border-foreground/5 sm:hidden" />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Contest Browser Modal */}
      <ContestBrowserModal
        isOpen={contestBrowser.isOpen}
        onClose={contestBrowser.closeWithUrlUpdate}
        onSelectContest={handleContestSelect}
      />
    </div>
  )
}
