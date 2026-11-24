import { useTranslations } from 'next-intl'
import { type MouseEvent, useMemo } from 'react'

import { isExclusiveSelection } from '@/components/shared/utils/event-utils'

import { OPPOSITE_LOGIC } from '../constants/filter-constants'
import type { ChipData, ChipGroupLogic } from '../types/filter-chip-types'
import type { LabeledSlug, MarkStatusFilter } from '../types/problem-api-types'
import type { FilterOptionsWithCounts, SearchFiltersState } from '../types/problem-library-types'
import { generateCompetitionChips } from '../utils/competition-chips'
import type { CompetitionTree } from '../utils/competition-tree'
import { facetValueName, sortByFacetOrder } from '../utils/facet-order'
import { clearFilters, createFilterUpdater, toggleFilterValue } from '../utils/filter-update-utils'
import { useMarkStatusNames } from './use-mark-status-names'

/**
 * A filter holding values that carry their own names.
 */
type NamedValueFilter = 'seasons' | 'tags' | 'authors'

/**
 * One filter as the bar shows it: its heading, and the removable chips standing for what it narrows to.
 */
export type ActiveFilterGroup = {
  /** What the filter is called. */
  label: string
  /** The filter's chips, in the order its facet offers them. */
  chips: ChipData[]
  /** How the filter's values combine; null for a filter with no choice. */
  logic: ChipGroupLogic | null
}

/**
 * The options of {@link useActiveFilterGroups}.
 */
type UseActiveFilterGroupsOptions = {
  /** The filters currently applied. */
  filters: SearchFiltersState
  /** Option counts under the filters currently applied. */
  filterOptions: FilterOptionsWithCounts
  /** Every option the library can ever offer, whatever is filtered. */
  baseOptions: FilterOptionsWithCounts
  /** The competition taxonomy. */
  competitionTree: CompetitionTree
  /** Applies a change to the filters. */
  onFiltersChange: (newFilters: SearchFiltersState) => void
  /** Applies a mark status, or clears the filter on null. */
  onMarkStatusChange: (status: MarkStatusFilter | null) => void
}

/**
 * The filters applied, as the bar over the list shows them: one group per filter that narrows anything. A click on a
 * chip drops what it stands for, and a modified click keeps only that, on every chip but the mark status one.
 *
 * @param options - The filters, their options, and the ways to change them.
 * @returns The groups, in the order the bar reads them out.
 */
export function useActiveFilterGroups({
  filters,
  filterOptions,
  baseOptions,
  competitionTree,
  onFiltersChange,
  onMarkStatusChange,
}: UseActiveFilterGroupsOptions): ActiveFilterGroup[] {
  // Translations for the filters
  const tFilters = useTranslations('problems.filters')

  // A function which applies a click on the search chip: dropping the search, or under the modifier keeping it alone
  const handleSearchChipClick = (event: MouseEvent) => {
    // The modifier keeps the search and its scope, and clears every other filter within the list being browsed
    if (isExclusiveSelection(event)) {
      onFiltersChange({
        ...clearFilters(filters),
        searchText: filters.searchText,
        searchInSolution: filters.searchInSolution,
      })

      // Settled
      return
    }

    // A plain click drops the search, and its scope goes with it
    createFilterUpdater(filters, onFiltersChange)('searchText', '')
  }

  // A function which builds the click on one value's chip: dropping the value, or under the modifier keeping it alone
  const dropOrKeepAlone = (filter: NamedValueFilter, value: LabeledSlug) => (event: MouseEvent) => {
    // The filter with the value alone, or without it, since a chip's value is always one filtered on
    onFiltersChange({
      ...filters,
      [filter]: toggleFilterValue(filters[filter], value, isExclusiveSelection(event)),
    })
  }

  // A function which builds the chips of a filter holding named values, in the order its facet offers them
  const namedValueChips = (filter: NamedValueFilter): ChipData[] =>
    sortByFacetOrder(filters[filter], baseOptions[filter]).map((value) => ({
      id: `${filter}-${value.slug}`,
      displayName: facetValueName(value.slug, filterOptions[filter], baseOptions[filter]),
      onClick: dropOrKeepAlone(filter, value),
    }))

  // A function which builds the click on one problem number's chip: dropping it, or under the modifier keeping it alone
  const dropOrKeepNumberAlone = (number: number) => (event: MouseEvent) => {
    // The numbers with this one alone, or without it
    onFiltersChange({
      ...filters,
      problemNumbers: isExclusiveSelection(event)
        ? [number]
        : filters.problemNumbers.filter((existing) => existing !== number),
    })
  }

  // The problem numbers, which read as a sequence, so in numeric order
  const sortedProblemNumbers = [...filters.problemNumbers].sort((first, second) => first - second)

  // The term searched for, without the spaces around it
  const searchTerm = filters.searchText.trim()

  // The search chip, reading the term back with its scope
  const searchChips: ChipData[] = searchTerm
    ? [
        {
          id: 'search-text',
          displayName: filters.searchInSolution
            ? `"${searchTerm}" ${tFilters('searchInSolutionSuffix')}`
            : `"${searchTerm}"`,
          onClick: handleSearchChipClick,
        },
      ]
    : []

  // The name of each mark status
  const markStatusNames = useMarkStatusNames()

  // The mark status chip, clearing the filter on a click
  const markStatusChips: ChipData[] = filters.markStatus
    ? [
        {
          id: 'markStatus',
          displayName: markStatusNames[filters.markStatus],
          onClick: () => onMarkStatusChange(null),
        },
      ]
    : []

  // The competition chips, folded up to the shallowest level that covers each selection
  const competitionChips = useMemo(
    () => generateCompetitionChips(filters, competitionTree, onFiltersChange),
    [filters, competitionTree, onFiltersChange]
  )

  // Every filter, in the order the bar reads them out
  const groups: ActiveFilterGroup[] = [
    { label: tFilters('searchedText'), chips: searchChips, logic: null },
    { label: tFilters('markStatus'), chips: markStatusChips, logic: null },
    { label: tFilters('competitions'), chips: competitionChips, logic: null },
    { label: tFilters('seasons'), chips: namedValueChips('seasons'), logic: null },
    {
      label: tFilters('facets.problemNumber'),
      chips: sortedProblemNumbers.map((number) => ({
        id: `number-${number}`,
        displayName: String(number),
        onClick: dropOrKeepNumberAlone(number),
      })),
      logic: null,
    },
    {
      label: tFilters('facets.tags'),
      chips: namedValueChips('tags'),
      logic: {
        mode: filters.tagLogic,
        onModeToggle: () =>
          onFiltersChange({ ...filters, tagLogic: OPPOSITE_LOGIC[filters.tagLogic] }),
      },
    },
    {
      label: tFilters('facets.authors'),
      chips: namedValueChips('authors'),
      logic: {
        mode: filters.authorLogic,
        onModeToggle: () =>
          onFiltersChange({ ...filters, authorLogic: OPPOSITE_LOGIC[filters.authorLogic] }),
      },
    },
  ]

  // The filters that narrow anything, since a heading with no chips under it would be an empty row
  return groups.filter((group) => group.chips.length > 0)
}
