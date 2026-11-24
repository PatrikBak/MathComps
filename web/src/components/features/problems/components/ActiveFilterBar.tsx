import { ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useMemo } from 'react'

import { SurfacePanel } from '@/components/shared/components/SurfacePanel'
import { cn } from '@/components/shared/utils/css-utils'
import { useMinWidth } from '@/hooks/use-breakpoint'
import { useKeyedToggle } from '@/hooks/use-keyed-toggle'

import { ACTIVE_FILTERS_CONSTANTS } from '../constants/filter-constants'
import { PROBLEM_COUNT_ATTRIBUTE } from '../constants/problem-list-attributes'
import { useActiveFilterGroups } from '../hooks/use-active-filter-groups'
import { useAuthGatedFilter } from '../hooks/use-auth-gated-filter'
import { usePrefetchCompetitionBrowser } from '../hooks/use-competition-browser'
import { useCompetitionBrowserModal } from '../hooks/use-competition-browser-modal'
import type { MarkStatusFilter } from '../types/problem-api-types'
import type { ProblemCardView } from '../types/problem-card-types'
import type { FilterOptionsWithCounts, SearchFiltersState } from '../types/problem-library-types'
import { buildCompetitionTree, validateCompetitionPaths } from '../utils/competition-tree'
import { clearFilters } from '../utils/filter-update-utils'
import { createDefaultFilters } from '../utils/url-initialization'
import { CollapsibleChipGroup } from './CollapsibleChipGroup'
import {
  CompetitionBrowserModal,
  type CompetitionBrowserSelection,
} from './CompetitionBrowserModal'
import { BAR_BUTTON_CLASS, BAR_BUTTON_MUTED_CLASS, FilterBarActions } from './FilterBarActions'
import { FilterMark } from './FilterMark'
import { MobileFilterButton } from './MobileFilterDrawer'

/**
 * The panel the filter rows scroll inside.
 */
const FILTER_ROWS_CLASS = cn(
  'max-h-[40vh] overflow-y-auto pr-1 mt-3 lg:mt-4',
  'animate-in fade-in slide-in-from-top-2 duration-200 transition-none'
)

/**
 * One filter row: its heading beside its chips, once there is width for the two of them.
 */
const FILTER_ROW_CLASS = cn(
  'grid grid-cols-1 gap-y-1.5',
  'sm:grid-cols-[5.5rem_1fr] sm:items-baseline sm:gap-x-4 sm:gap-y-0',
  'md:grid-cols-[6rem_1fr] lg:grid-cols-[6.5rem_1fr] xl:grid-cols-[7rem_1fr]'
)

/**
 * The props of {@link ActiveFilterBar}.
 */
type ActiveFilterBarProps = {
  /** The filters currently applied. */
  filters: SearchFiltersState
  /** Option counts under the filters currently applied. */
  filterOptions: FilterOptionsWithCounts
  /** Every option the library can ever offer, whatever is filtered. */
  baseOptions: FilterOptionsWithCounts
  /** Applies a change the user made in the bar. */
  onFiltersChange: (newFilters: SearchFiltersState) => void
  /** Total number of problems matching the active filters. */
  problemCount: number
  /** Whether technique tags (e.g. substitution, factoring) are showing. */
  showTechniqueTags: boolean
  /** Toggles technique tags. */
  onShowTechniqueTagsChange: (show: boolean) => void
  /** How the problems' cards are drawn. */
  cardView: ProblemCardView
  /** Draws the problems' cards another way. */
  onCardViewChange: (view: ProblemCardView) => void
  /** Opens the filter drawer, which stands in for the sidebar where there is no room for one. */
  onMobileFilterClick: () => void
  /** Whether search results are currently being fetched. */
  isSearching: boolean
}

/**
 * The strip above the results: how many problems match, what is filtering them as
 * removable chips, how the cards are drawn, and the controls that act on the whole result set.
 *
 * The chip rows start folded away below the sidebar breakpoint, and above it once there are enough
 * chips to crowd the bar. The user's own expanding or collapsing then holds until no filter shows a
 * chip any more.
 */
export function ActiveFilterBar({
  filters,
  filterOptions,
  baseOptions,
  onFiltersChange,
  problemCount,
  showTechniqueTags,
  onShowTechniqueTagsChange,
  cardView,
  onCardViewChange,
  onMobileFilterClick,
  isSearching,
}: ActiveFilterBarProps) {
  // Plural translations
  const tPlurals = useTranslations('plurals')

  // Translations for the filter bar
  const tFilters = useTranslations('problems.filters')

  // Whether the viewport is wide enough for the sidebar
  const isSidebarVisible = useMinWidth('lg')

  // The competition browser's open state and the controls that change it
  const competitionBrowser = useCompetitionBrowserModal()

  // A function which warms the competition browser
  const prefetchCompetitionBrowser = usePrefetchCompetitionBrowser()

  // A function which applies a filter only a signed-in reader may have
  const { applyOrPrompt } = useAuthGatedFilter(onFiltersChange)

  // The competition taxonomy
  const competitionTree = useMemo(
    () => buildCompetitionTree(baseOptions.competitions, baseOptions.competitions),
    [baseOptions.competitions]
  )

  // A function which applies the mark status the user picked, or clears the filter
  const handleMarkStatusChange = (status: MarkStatusFilter | null) => {
    // Clearing the filter asks nothing of anybody, so it needs no account behind it
    if (status === null) {
      // The library goes back to showing marked and unmarked alike
      onFiltersChange({ ...filters, markStatus: null })

      // Nothing else to weigh
      return
    }

    // Marks are the user's own, so a signed-out one is asked to sign in and brought back to this same filter
    applyOrPrompt({ ...filters, markStatus: status }, tFilters('markStatusAuthReason'))
  }

  // The filters applied, as groups of removable chips
  const filterGroups = useActiveFilterGroups({
    filters,
    filterOptions,
    baseOptions,
    competitionTree,
    onFiltersChange,
    onMarkStatusChange: handleMarkStatusChange,
  })

  // How many chips there are altogether, across every group
  const activeChipCount = filterGroups.reduce((sum, group) => sum + group.chips.length, 0)

  // Whether the chip rows are expanded. The reader's own toggle holds until no filter shows a chip any more, and
  // before they touch it, the rows open on their own while the sidebar leaves room and few enough chips show
  const { value: areRowsExpanded, toggle: toggleRows } = useKeyedToggle({
    key: activeChipCount > 0,
    defaultValue:
      isSidebarVisible && activeChipCount <= ACTIVE_FILTERS_CONSTANTS.maxFiltersForAutoExpand,
  })

  // Whether anything is filtering at all, including a search scope that carries no chip of its own
  const hasAnyActiveFilter = activeChipCount > 0 || filters.searchInSolution

  // A function which applies a competition the user picked in the competition browser
  const handleCompetitionSelect = (selection: CompetitionBrowserSelection) => {
    // The season reads under its own name, falling back to the slug if the options are stale
    const seasonDisplayName =
      baseOptions.seasons.find((season) => season.slug === selection.seasonSlug)?.displayName ??
      selection.seasonSlug

    // What was picked, checked against the taxonomy the chips are drawn from
    const competitionSelections = validateCompetitionPaths([selection.path], competitionTree)

    // The browser picks one competition outright, so everything else is cleared, the favorites or list being browsed
    // included
    onFiltersChange({
      ...createDefaultFilters(),
      seasons: [{ slug: selection.seasonSlug, displayName: seasonDisplayName, fullName: null }],
      competitionSelection: competitionSelections ?? [],
    })

    // The filters already wrote the URL, so closing must not write it a second time
    competitionBrowser.closeWithoutUrlUpdate()
  }

  return (
    <SurfacePanel radius="xl" className="mr-2 px-3 py-2.5 sm:px-4 sm:py-3">
      {/* Header row */}
      <div
        className={cn(
          'flex min-w-0 flex-nowrap items-center justify-between',
          'gap-x-0.5 min-[400px]:gap-x-1.5 min-[650px]:gap-2'
        )}
      >
        {/* Status */}
        <div className="flex shrink-0 items-center gap-0.5 min-[400px]:gap-1.5 min-[650px]:gap-2 text-sm">
          {/* The filters' mark and how many are set, or the drawer trigger where there is no sidebar */}
          {isSidebarVisible ? (
            <h2 className="flex flex-shrink-0 items-center">
              <FilterMark count={activeChipCount} />
              <span className="sr-only">{tFilters('activeFilters')}</span>
            </h2>
          ) : (
            <MobileFilterButton onClick={onMobileFilterClick} activeFilterCount={activeChipCount} />
          )}

          {/* The count, hidden under a spinner while the search runs and keeping its room, since the actions beside
              it fill whatever room it leaves */}
          <div className="relative ml-2 flex-shrink-0 whitespace-nowrap text-xs text-muted">
            <span
              className={cn(isSearching && 'invisible')}
              {...PROBLEM_COUNT_ATTRIBUTE.stamp(isSearching ? null : String(problemCount))}
            >
              {tPlurals('problems', { count: problemCount })}
            </span>
            {isSearching && (
              <Loader2
                className="absolute left-0 top-1/2 h-3 w-3 -translate-y-1/2 animate-spin"
                aria-label={tFilters('searching')}
              />
            )}
          </div>

          {/* The way to expand the chip rows, or fold them away */}
          {filterGroups.length > 0 && (
            <button
              onClick={toggleRows}
              className={cn(
                BAR_BUTTON_CLASS,
                BAR_BUTTON_MUTED_CLASS,
                'w-7 shrink-0 justify-center px-0'
              )}
              aria-label={areRowsExpanded ? tFilters('hideFilters') : tFilters('showFilters')}
              title={areRowsExpanded ? tFilters('hideFilters') : tFilters('showFilters')}
            >
              {areRowsExpanded ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </button>
          )}
        </div>

        {/* Actions */}
        <FilterBarActions
          filters={filters}
          onMarkStatusChange={handleMarkStatusChange}
          canReset={hasAnyActiveFilter}
          onReset={() => onFiltersChange(clearFilters(filters))}
          cardView={cardView}
          onCardViewChange={onCardViewChange}
          showTechniqueTags={showTechniqueTags}
          onShowTechniqueTagsChange={onShowTechniqueTagsChange}
          onOpenCompetitionBrowser={competitionBrowser.open}
          onPrefetchCompetitionBrowser={prefetchCompetitionBrowser}
        />
      </div>

      {/* Filter rows */}
      {filterGroups.length > 0 && areRowsExpanded && (
        <div className={FILTER_ROWS_CLASS}>
          <div className="space-y-3 sm:space-y-4">
            {filterGroups.map((group, groupIndex) => (
              <div key={group.label}>
                {/* Group row */}
                <div className={FILTER_ROW_CLASS}>
                  {/* Group header */}
                  <span className="whitespace-nowrap text-sm font-medium text-muted">
                    {group.label}:
                  </span>

                  {/* Chips */}
                  <CollapsibleChipGroup chips={group.chips} logic={group.logic} />
                </div>

                {/* Divider between groups on mobile */}
                {groupIndex < filterGroups.length - 1 && (
                  <div className="mt-3 border-t border-foreground/5 sm:hidden" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Competition browser */}
      <CompetitionBrowserModal
        isOpen={competitionBrowser.isOpen}
        onClose={competitionBrowser.closeWithUrlUpdate}
        onSelectCompetition={handleCompetitionSelect}
      />
    </SurfacePanel>
  )
}
