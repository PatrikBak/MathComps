import {
  HOSTED_COMPETITION_CATEGORIES,
  type HostedCompetitionCategory,
} from '@/components/features/hosted-competitions/model/hosted-competition-types'
import { entriesOf } from '@/components/shared/utils/collection-utils'
import { normalizeForSearch } from '@/components/shared/utils/string-utils'

import { type Board, type Proposal, PROPOSAL_AREAS, type ProposalArea } from './selection-types'

/**
 * What the pool is narrowed to.
 */
export type PoolFilter = {
  /** Text a problem's number, name or statement must contain, or a number like #7 naming one problem. */
  query: string
  /** The categories a problem must be recommended for at least one of; empty for any. */
  categories: HostedCompetitionCategory[]
  /** The areas a problem must belong to one of; empty for any. */
  areas: ProposalArea[]
  /** Whether only problems the board on screen does not hold show. */
  isOffBoardOnly: boolean
  /** Whether the pool shows the set-aside problems instead of the live ones. */
  isShowingSetAside: boolean
}

/** A filter narrowing the pool by nothing. */
export const OPEN_POOL_FILTER: PoolFilter = {
  query: '',
  categories: [],
  areas: [],
  isOffBoardOnly: false,
  isShowingSetAside: false,
}

/**
 * How many of a filter's fields narrow anything.
 *
 * @param filter - What the pool is narrowed to.
 *
 * @returns The count, the search among them once it holds more than spaces.
 */
export function countActiveFilters(filter: PoolFilter): number {
  // How many of the fields narrow the pool
  return [
    filter.query.trim() !== '',
    filter.categories.length > 0,
    filter.areas.length > 0,
    filter.isOffBoardOnly,
    filter.isShowingSetAside,
  ].filter(Boolean).length
}

/**
 * The facet whose own filter a count leaves out; null where every filter applies.
 */
type OwnFacet = 'categories' | 'areas' | null

/**
 * What a filter lets through of the pool, with the counts beside each facet's options.
 */
export type PoolMatches = {
  /** The problems every filter lets through, lowest number first. */
  shown: Proposal[]
  /** How many problems are recommended for each category, under every filter but the categories' own. */
  categoryCounts: Record<HostedCompetitionCategory, number>
  /** How many problems belong to each area, under every filter but the areas' own. */
  areaCounts: Record<ProposalArea, number>
  /** How many of the pool's problems are set aside, whatever the filters say. */
  setAsideCount: number
}

/**
 * Runs the pool through a filter. A problem a round took has left the pool and never shows.
 *
 * @param proposals - Every proposal.
 * @param filter - What the pool is narrowed to.
 * @param activeBoard - The board on screen; null when there is none.
 *
 * @returns What the filter lets through, with the facet counts.
 */
export function matchPool(
  proposals: readonly Proposal[],
  filter: PoolFilter,
  activeBoard: Board | null
): PoolMatches {
  // The pool: everything no round has taken
  const pool = proposals.filter((proposal) => !proposal.isUsed)

  // The problems on the board on screen
  const onBoard = new Set(activeBoard?.papers.flatMap((paper) => paper.slots) ?? [])

  // The search text, folded for matching
  const searchTerm = normalizeForSearch(filter.query.trim())

  // The number a search like #7 names; undefined for any other search
  const searchedNumber = /^#(\d+)$/.exec(searchTerm)?.[1]

  // A function which says whether a problem answers the search: by the number the search names, where it names
  // one, else by the text anywhere in the problem
  const answersSearch = (proposal: Proposal) =>
    searchedNumber === undefined
      ? searchableText(proposal).includes(searchTerm)
      : proposal.number === Number(searchedNumber)

  // What each facet's own filter lets through
  const facetFilters: Record<Exclude<OwnFacet, null>, (proposal: Proposal) => boolean> = {
    // A problem recommended for one of the categories picked, or any problem while none is picked
    categories: (proposal) =>
      filter.categories.length === 0 ||
      filter.categories.some((category) => proposal.recommended.includes(category)),

    // A problem in one of the areas picked, or any problem while none is picked
    areas: (proposal) => filter.areas.length === 0 || filter.areas.includes(proposal.area),
  }

  // A function which says whether a problem passes every filter but the one facet named
  const passes = (proposal: Proposal, ownFacet: OwnFacet) =>
    proposal.isSetAside === filter.isShowingSetAside &&
    entriesOf(facetFilters).every(
      ([facet, letsThrough]) => facet === ownFacet || letsThrough(proposal)
    ) &&
    (!filter.isOffBoardOnly || !onBoard.has(proposal.id)) &&
    (searchTerm === '' || answersSearch(proposal))

  // What every filter lets through, lowest number first
  const shown = pool
    .filter((proposal) => passes(proposal, null))
    .sort((first, second) => first.number - second.number || first.id.localeCompare(second.id))

  // A function which counts the problems holding each of a facet's options, under the other filters
  const countByOption = <TOption extends string>(
    facet: Exclude<OwnFacet, null>,
    options: readonly TOption[],
    holds: (proposal: Proposal, option: TOption) => boolean
  ) =>
    Object.fromEntries(
      options.map((option) => [
        option,
        pool.filter((proposal) => passes(proposal, facet) && holds(proposal, option)).length,
      ])
    ) as Record<TOption, number>

  // The problems recommended for each category, counted under every filter but the categories' own
  const categoryCounts = countByOption(
    'categories',
    HOSTED_COMPETITION_CATEGORIES,
    (proposal, category) => proposal.recommended.includes(category)
  )

  // The problems in each area, counted under every filter but the areas' own
  const areaCounts = countByOption(
    'areas',
    PROPOSAL_AREAS,
    (proposal, area) => proposal.area === area
  )

  // How many of the pool's problems are set aside, whatever the filters say
  const setAsideCount = pool.filter((proposal) => proposal.isSetAside).length

  // What the filter lets through, and the counts beside its options
  return { shown, categoryCounts, areaCounts, setAsideCount }
}

/**
 * Everything a search can match in a problem: its number, its working name and every statement it has.
 *
 * @param proposal - The problem.
 *
 * @returns The text, lower-cased and without its diacritics.
 */
function searchableText(proposal: Proposal): string {
  // The number with its #, the working name and every statement, run together and folded like the search
  return normalizeForSearch(
    [
      `#${proposal.number}`,
      proposal.title,
      ...Object.values(proposal.texts).map((text) => text?.statement ?? ''),
    ].join(' ')
  )
}
