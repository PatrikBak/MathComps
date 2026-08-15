import { Check, ChevronDown, ChevronUp, FilterX, Grid3X3, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import * as React from 'react'
import { useMemo, useState } from 'react'

import { useMinWidth } from '@/hooks/use-breakpoint'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../../shared/components/DropdownMenu'
import { cn } from '../../../shared/utils/css-utils'
import { isExclusiveSelection } from '../../../shared/utils/event-utils'
import { ACTIVE_FILTERS_CONSTANTS } from '../constants/filter-constants'
import { usePrefetchCompetitionBrowser } from '../hooks/use-competition-browser'
import { useCompetitionBrowserModal } from '../hooks/use-competition-browser-modal'
import type { MarkStatusFilter } from '../types/problem-api-types'
import type { FilterOptionsWithCounts, SearchFiltersState } from '../types/problem-library-types'
import { generateCompetitionChips } from '../utils/competition-chips'
import { buildCompetitionTree, resolveCompetitionPaths } from '../utils/competition-tree'
import { createDefaultFilters } from '../utils/url-initialization'
import { ActionsMenu } from './ActionsMenu'
import type { ChipData } from './CollapsibleChipGroup'
import { CollapsibleChipGroup } from './CollapsibleChipGroup'
import {
  CompetitionBrowserModal,
  type CompetitionBrowserSelection,
} from './CompetitionBrowserModal'
import { MobileFilterButton } from './MobileFilterDrawer'
import { ShareButton } from './ShareButton'

/**
 * The panel the filter rows scroll inside.
 */
const FILTER_ROWS_CLASS = cn(
  'max-h-[40vh] overflow-y-auto pr-1',
  'border-t border-foreground/10 mt-3 pt-3 lg:mt-4 lg:pt-4',
  'animate-in fade-in slide-in-from-top-2 duration-200'
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
 * The props of {@link ActiveFiltersBar}.
 */
type ActiveFiltersBarProps = {
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
  /** Opens the mobile filter drawer; only provided on narrow viewports. */
  onMobileFilterClick?: () => void
  /** Whether search results are currently being fetched. */
  isSearching: boolean
}

/**
 * The strip above the results: how many problems match, what is filtering them as
 * removable chips, and the controls that act on the whole result set.
 *
 * The chips fold themselves up below the sidebar breakpoint always, and above it once there are
 * enough of them to crowd the bar. The user's own expanding or collapsing then holds until
 * nothing is filtered any more.
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
  // The unfiltered state
  const defaultFilters = createDefaultFilters()

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

  // What the user said about the chips being expanded, or null while they have said nothing
  const [manualExpansionOverride, setManualExpansionOverride] = useState<boolean | null>(null)

  // The competition taxonomy
  const competitionTree = useMemo(
    () => buildCompetitionTree(baseOptions.competitions, baseOptions.competitions),
    [baseOptions.competitions]
  )

  // A function which applies a competition the user picked in the competition browser
  const handleCompetitionSelect = (selection: CompetitionBrowserSelection) => {
    // The season reads under its own name, falling back to the slug if the options are stale
    const seasonDisplayName =
      baseOptions.seasons.find((season) => season.slug === selection.seasonSlug)?.displayName ??
      selection.seasonSlug

    // What was picked, resolved against the taxonomy the chips are drawn from
    const competitionSelections = resolveCompetitionPaths([selection.path], competitionTree)

    // The browser picks one competition outright, so everything else is cleared rather than kept
    onFiltersChange({
      ...defaultFilters,
      seasons: [{ slug: selection.seasonSlug, displayName: seasonDisplayName, fullName: null }],
      competitionSelection: competitionSelections ?? [],
    })

    // The filters already wrote the URL, so closing must not write it a second time
    competitionBrowser.closeWithoutUrlUpdate()
  }

  // How many filters are set
  const activeFilterCount =
    filters.seasons.length +
    filters.problemNumbers.length +
    filters.tags.length +
    filters.authors.length +
    filters.competitionSelection.length +
    (filters.searchText.trim() ? 1 : 0)

  // Nothing filtered means no crowding to have had an opinion about, so a standing one is dropped
  if (activeFilterCount === 0 && manualExpansionOverride !== null) {
    // The bar decides for itself again
    setManualExpansionOverride(null)
  }

  // The user's say overrides the automatic decision, which otherwise goes on how many chips there are
  const areFiltersExpanded =
    manualExpansionOverride !== null
      ? manualExpansionOverride
      : isSidebarVisible && activeFilterCount <= ACTIVE_FILTERS_CONSTANTS.maxFiltersForAutoExpand

  // A function which takes the library back to showing everything
  const handleClearAll = () => {
    onFiltersChange({
      ...defaultFilters,
    })
  }

  // A function which applies a click on a value chip, honouring the modifier that narrows to one
  const handleToggleMulti = (
    key: 'tags' | 'authors' | 'seasons' | 'problemNumbers',
    idToToggle: string | number,
    event: React.MouseEvent
  ) => {
    // Problem numbers are held as bare numbers, so they cannot go through the slug path below
    if (key === 'problemNumbers') {
      // The chip's own number
      const numToToggle = idToToggle as number

      // The modifier narrows the whole filter to this one number
      if (isExclusiveSelection(event)) {
        onFiltersChange({ ...filters, problemNumbers: [numToToggle] })

        return
      }

      // Whether the chip stands for something already filtered on
      const isSelected = filters.problemNumbers.includes(numToToggle)

      // A number already filtered on comes back out on a click, and any other one goes in
      if (isSelected) {
        // Everything but the one clicked survives
        const updated = filters.problemNumbers.filter((number) => number !== numToToggle)

        // And the survivors become the filter
        onFiltersChange({ ...filters, problemNumbers: updated })
      } else {
        // Numbers read as a sequence, so a new one takes its place in order
        onFiltersChange({
          ...filters,
          problemNumbers: [...filters.problemNumbers, numToToggle].sort(
            (first, second) => first - second
          ),
        })
      }

      return
    }

    // Every other filter is held as a slug carrying the name it reads under
    const slugToToggle = idToToggle as string

    // The modifier narrows the whole filter to this one value
    if (isExclusiveSelection(event)) {
      // The value as it already sits in the filters, which is where its name comes from
      const selectedValue = filters[key].find((value) => value.slug === slugToToggle)

      // A chip naming something no longer filtered on has nothing to narrow to
      if (selectedValue) {
        // So it is the only one left standing
        onFiltersChange({ ...filters, [key]: [selectedValue] })
      }

      return
    }

    // Whether the chip stands for something already filtered on
    const isSelected = filters[key].some((value) => value.slug === slugToToggle)

    // A value already filtered on comes back out on a click, and any other one goes in
    if (isSelected) {
      // Everything but the one clicked survives
      const updatedValues = filters[key].filter((value) => value.slug !== slugToToggle)

      // And the survivors become the filter
      onFiltersChange({ ...filters, [key]: updatedValues })
    } else {
      // The value's name comes from the current counts, or from the full set if it has dropped out
      const valueToAdd =
        filterOptions[key].find((value) => value.slug === slugToToggle) ||
        baseOptions[key].find((value) => value.slug === slugToToggle)

      // A value neither set knows cannot be named, so it is not worth filtering on
      if (valueToAdd) {
        // So it joins the ones already there
        onFiltersChange({ ...filters, [key]: [...filters[key], valueToAdd] })
      }
    }
  }

  // A function which applies a click on the search-text chip
  const handleToggleSearchText = (event: React.MouseEvent) => {
    // The modifier keeps the search and drops every other filter
    if (isExclusiveSelection(event)) {
      onFiltersChange({
        ...defaultFilters,
        searchText: filters.searchText,
        searchInSolution: filters.searchInSolution,
      })

      return
    }

    // A plain click drops the search, and its scope goes with it
    onFiltersChange({ ...filters, searchText: '', searchInSolution: false })
  }

  // A function which flips the tag filter between matching any tag and matching all of them
  const handleToggleTagLogic = () => {
    // The only other mode there is
    const newLogic = filters.tagLogic === 'and' ? 'or' : 'and'

    // Which the tag filter runs under from here
    onFiltersChange({ ...filters, tagLogic: newLogic })
  }

  // A function which flips the author filter between matching any author and all of them
  const handleToggleAuthorLogic = () => {
    // The only other mode there is
    const newLogic = filters.authorLogic === 'and' ? 'or' : 'and'

    // Which the author filter runs under from here
    onFiltersChange({ ...filters, authorLogic: newLogic })
  }

  // A function which applies the mark status the user picked, or clears the filter
  const handleMarkStatusChange = (status: MarkStatusFilter | null) => {
    onFiltersChange({ ...filters, markStatus: status })
  }

  /**
   * A value as the chips address it: what identifies it, and what it reads as.
   */
  type SingleOption = {
    /** Identifies the value, matching the slug it is filtered by. */
    id: string
    /** How the value reads on its chip. */
    displayName: string
  }

  // The season names, under the current counts and in full
  const seasonOptions = filterOptions.seasons.map((facet) => ({
    id: facet.slug,
    displayName: facet.displayName,
  }))
  const seasonOptionsBase = baseOptions.seasons.map((facet) => ({
    id: facet.slug,
    displayName: facet.displayName,
  }))

  // The tag names, under the current counts and in full
  const tagOptions = filterOptions.tags.map((facet) => ({
    id: facet.slug,
    displayName: facet.displayName,
  }))
  const tagOptionsBase = baseOptions.tags.map((facet) => ({
    id: facet.slug,
    displayName: facet.displayName,
  }))

  // The author names, under the current counts and in full
  const authorOptions = filterOptions.authors.map((facet) => ({
    id: facet.slug,
    displayName: facet.displayName,
  }))
  const authorOptionsBase = baseOptions.authors.map((facet) => ({
    id: facet.slug,
    displayName: facet.displayName,
  }))

  /**
   * Reads a value's name, holding it steady when filtering elsewhere drops the value out
   * of the current counts. A value neither set knows falls back to its own id.
   *
   * @param options - The names under the current counts.
   * @param id - The value to name.
   * @param base - The names across everything, whatever is filtered.
   * @returns The value's name.
   */
  const getLabel = (options: SingleOption[], id: string, base: SingleOption[]): string => {
    // The name it reads under right now
    const current = options.find((option) => option.id === id)?.displayName

    // Which is the answer whenever the value still shows up in the counts
    if (current) return current

    // Otherwise the full set still knows it, and failing even that the id has to do
    return base.find((option) => option.id === id)?.displayName ?? id
  }

  // The competition chips, folded up to the shallowest level that covers each selection
  const competitionChips = useMemo(() => {
    return generateCompetitionChips(filters, competitionTree, onFiltersChange)
  }, [filters, competitionTree, onFiltersChange])

  // The search chip, which reads the term back with its scope, or nothing when there is no term
  const searchTextChip =
    filters.searchText && filters.searchText.trim().length > 0
      ? {
          id: 'search-text',
          displayName: `"${filters.searchText.trim()}"${filters.searchInSolution ? ` ${tFilters('searchInSolutionSuffix')}` : ''}`,
          onClick: handleToggleSearchText,
        }
      : null

  /**
   * Puts the values filtered on back into the order the facet offers them in. A value the facet
   * no longer offers goes to the end.
   *
   * @param selected - The values filtered on.
   * @param originalOptions - The facet's options, in the order it offers them.
   * @returns The same values, in the facet's order.
   */
  const sortByOriginalOrder = <T extends { slug: string }>(selected: T[], originalOptions: T[]) => {
    // Where each value sits in the facet, so ordering the chips is a lookup
    const positionMap = new Map<string, number>()

    // The facet's own order is the index, read off as it is walked
    for (let index = 0; index < originalOptions.length; index++) {
      positionMap.set(originalOptions[index].slug, index)
    }

    // Ordered as the facet orders them, so the chips read the way the sidebar does
    return [...selected].sort((firstItem, secondItem) => {
      // A value the facet no longer offers sorts to the end
      const firstPosition = positionMap.get(firstItem.slug) ?? Number.MAX_SAFE_INTEGER
      const secondPosition = positionMap.get(secondItem.slug) ?? Number.MAX_SAFE_INTEGER

      // Earlier in the facet means earlier in the bar
      return firstPosition - secondPosition
    })
  }

  // The seasons in the order their facet offers them in
  const sortedSeasons = sortByOriginalOrder(filters.seasons, baseOptions.seasons)

  // The numbers read as a sequence, so they go in numeric order
  const sortedProblemNumbers = [...filters.problemNumbers].sort((first, second) => first - second)

  // The tags and the authors, each in its own facet's order
  const sortedTags = sortByOriginalOrder(filters.tags, baseOptions.tags)
  const sortedAuthors = sortByOriginalOrder(filters.authors, baseOptions.authors)

  // The chips under their headings, in the order the bar reads them out
  const filterGroups = [
    // The search chip, when there is a term
    ...(searchTextChip
      ? [
          {
            label: tFilters('searchedText'),
            chips: [searchTextChip],
          },
        ]
      : []),
    // The mark-status chip, when the filter is set
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
                onClick: () => onFiltersChange({ ...filters, markStatus: null }),
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
      chips: sortedTags.map((tag) => ({
        id: `tag-${tag.slug}`,
        displayName: getLabel(tagOptions, tag.slug, tagOptionsBase),
        onClick: (event: React.MouseEvent) => handleToggleMulti('tags', tag.slug, event),
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
  ]
    // A heading with no chips under it would be an empty row
    .filter((group) => group.chips.length > 0)

  // How many chips there are altogether, across every heading
  const activeChipCount = filterGroups.reduce((sum, group) => sum + group.chips.length, 0)

  // Whether anything is filtering at all, including the states that carry no chip of their own
  const hasAnyActiveFilter =
    activeChipCount > 0 ||
    Boolean(filters.searchText && filters.searchText.trim().length > 0) ||
    Boolean(filters.searchInSolution) ||
    Boolean(filters.markStatus)

  // The colour the mark status reads in
  const markStatusColorClass =
    filters.markStatus === 'marked'
      ? 'text-success'
      : filters.markStatus === 'unmarked'
        ? 'text-warning'
        : 'text-muted hover:text-muted-foreground'

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
      {/* Header row */}
      <div className="flex flex-nowrap items-center justify-between gap-x-0.5 min-[400px]:gap-x-1.5 gap-custom-expand min-w-0">
        {/* Status */}
        <div className="flex items-center gap-0.5 min-[400px]:gap-1.5 gap-custom-expand text-sm flex-shrink min-w-0">
          {/* Active-filters heading, or the drawer trigger where there is no sidebar */}
          {isSidebarVisible ? (
            <div className="flex items-center gap-2 flex-shrink-0">
              <h2 className="font-semibold text-foreground whitespace-nowrap">
                {tFilters('activeFilters')}
              </h2>
              {activeChipCount > 0 && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-focus text-xs font-medium text-focus-foreground">
                  {activeChipCount}
                </span>
              )}
            </div>
          ) : (
            onMobileFilterClick && (
              <MobileFilterButton
                onClick={onMobileFilterClick}
                activeFilterCount={activeChipCount}
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

        {/* Actions */}
        <div className="flex flex-nowrap items-center justify-end gap-x-0 min-[400px]:gap-x-1 sm:gap-x-2 flex-shrink-0">
          {/* Competition browser button */}
          <button
            onClick={competitionBrowser.open}
            onMouseEnter={prefetchCompetitionBrowser}
            className="inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs text-muted
              hover:bg-foreground/5 hover:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-focus
              whitespace-nowrap"
            aria-label={tFilters('competitionsOverview')}
            title={tFilters('competitionsOverview')}
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
                  ${markStatusColorClass}`}
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
              onCloseAutoFocus={(event) => event.preventDefault()}
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
            disabled={!hasAnyActiveFilter}
            className="inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs text-muted
               hover:bg-foreground/5 hover:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-focus
               disabled:opacity-30 disabled:pointer-events-none whitespace-nowrap"
            aria-label={tFilters('resetFilters')}
            title={tFilters('resetFilters')}
          >
            <FilterX className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="hidden sm:inline">{tFilters('reset')}</span>
          </button>

          {/* Overflow menu */}
          <ActionsMenu
            showTechniqueTags={showTechniqueTags}
            onShowTagsChange={onShowTechniqueTagsChange}
            filters={filters}
          />
        </div>
      </div>

      {/* Filter rows */}
      {filterGroups.length > 0 && areFiltersExpanded && (
        <div
          className={FILTER_ROWS_CLASS}
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgb(71 85 105) transparent',
          }}
        >
          <div className="space-y-3 sm:space-y-4">
            {filterGroups.map((group, groupIndex) => {
              return (
                <div key={group.label}>
                  {/* Group row */}
                  <div className={FILTER_ROW_CLASS}>
                    {/* Group header */}
                    <span className="whitespace-nowrap text-sm font-medium text-muted">
                      {group.label}:
                    </span>

                    {/* Chips */}
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

                  {/* Divider between groups on mobile */}
                  {groupIndex < filterGroups.length - 1 && (
                    <div className="mt-3 border-t border-foreground/5 sm:hidden" />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Competition browser */}
      <CompetitionBrowserModal
        isOpen={competitionBrowser.isOpen}
        onClose={competitionBrowser.closeWithUrlUpdate}
        onSelectCompetition={handleCompetitionSelect}
      />
    </div>
  )
}
