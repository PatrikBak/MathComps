import { entriesOf } from '@/components/shared/utils/collection-utils'
import { normalizeForSearch } from '@/components/shared/utils/string-utils'

import {
  type Board,
  type Paper,
  type Proposal,
  PROPOSAL_AREAS,
  type ProposalArea,
  type SelectionCategory,
} from './selection-types'

/** Every answer to whether the board on screen holds a problem. */
export const BOARD_MEMBERSHIPS = ['selected', 'notSelected'] as const

/** Whether the board on screen holds a problem in one of its slots. */
export type BoardMembership = (typeof BOARD_MEMBERSHIPS)[number]

/**
 * What the pool is narrowed to.
 */
export type PoolFilter = {
  /** Text a problem's number, name or statement must contain, or a number like #7 naming one problem. */
  query: string
  /** The categories, by name, a problem must be recommended for at least one of; empty for any. */
  categories: string[]
  /** The areas a problem must belong to one of; empty for any. */
  areas: ProposalArea[]
  /** Whether the board on screen must hold a problem or must not; null for any. */
  membership: BoardMembership | null
  /** Whether the pool shows the set-aside problems instead of the live ones. */
  isShowingSetAside: boolean
}

/** A filter narrowing the pool by nothing. */
export const OPEN_POOL_FILTER: PoolFilter = {
  query: '',
  categories: [],
  areas: [],
  membership: null,
  isShowingSetAside: false,
}

/**
 * A filter narrowed to the categories the selection lists, in the order they run.
 *
 * @param filter - What the pool is narrowed to.
 * @param categories - The selection's categories, in the order they run.
 *
 * @returns The filter without the categories the selection doesn't list.
 */
export function withListedCategories(
  filter: PoolFilter,
  categories: readonly SelectionCategory[]
): PoolFilter {
  // The filter, holding each of the selection's categories it picked
  return {
    ...filter,
    categories: categories
      .map((category) => category.name)
      .filter((name) => filter.categories.includes(name)),
  }
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
    filter.membership !== null,
    filter.isShowingSetAside,
  ].filter(Boolean).length
}

/**
 * The facet whose own filter a count leaves out; null where every filter applies.
 */
type OwnFacet = 'categories' | 'areas' | 'membership' | null

/**
 * What a filter lets through of the pool, with the counts beside each facet's options.
 */
export type PoolMatches = {
  /** The problems every filter lets through, in the order of the board on screen. */
  shown: Proposal[]
  /** How many problems are recommended for each category, by name, under every filter but the categories' own. */
  categoryCounts: Record<string, number>
  /** How many problems belong to each area, under every filter but the areas' own. */
  areaCounts: Record<ProposalArea, number>
  /** How many problems the board on screen holds and how many it doesn't, under every other filter. */
  membershipCounts: Record<BoardMembership, number>
  /** How many of the pool's problems are set aside, whatever the filters say. */
  setAsideCount: number
}

/**
 * Runs the pool through a filter. A problem a round took has left the pool and never shows.
 *
 * @param proposals - Every proposal.
 * @param filter - What the pool is narrowed to.
 * @param activeBoard - The board on screen; null when there is none.
 * @param categories - The selection's categories, in the order they run.
 *
 * @returns What the filter lets through, with the facet counts.
 */
export function matchPool(
  proposals: readonly Proposal[],
  filter: PoolFilter,
  activeBoard: Board | null,
  categories: readonly SelectionCategory[]
): PoolMatches {
  // The pool: everything no round has taken
  const pool = proposals.filter((proposal) => !proposal.isUsed)

  // The problems on the board on screen
  const onBoard = new Set(activeBoard?.papers.flatMap((paper) => paper.slots) ?? [])

  // A function which says whether the board on screen holds a problem
  const membershipOf = (proposal: Proposal): BoardMembership =>
    onBoard.has(proposal.id) ? 'selected' : 'notSelected'

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

    // A problem on the board or off it as picked, or any problem while neither is picked
    membership: (proposal) =>
      filter.membership === null || membershipOf(proposal) === filter.membership,
  }

  // A function which says whether a problem passes every filter but the one facet named
  const passes = (proposal: Proposal, ownFacet: OwnFacet) =>
    proposal.isSetAside === filter.isShowingSetAside &&
    entriesOf(facetFilters).every(
      ([facet, letsThrough]) => facet === ownFacet || letsThrough(proposal)
    ) &&
    (searchTerm === '' || answersSearch(proposal))

  // What every filter lets through, in the order of the board on screen
  const shown = inBoardOrder(
    pool.filter((proposal) => passes(proposal, null)),
    activeBoard,
    filter.categories
  )

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
    categories.map((category) => category.name),
    (proposal, category) => proposal.recommended.includes(category)
  )

  // The problems in each area, counted under every filter but the areas' own
  const areaCounts = countByOption(
    'areas',
    PROPOSAL_AREAS,
    (proposal, area) => proposal.area === area
  )

  // The problems on the board and off it, counted under every other filter
  const membershipCounts = countByOption(
    'membership',
    BOARD_MEMBERSHIPS,
    (proposal, membership) => membershipOf(proposal) === membership
  )

  // How many of the pool's problems are set aside, whatever the filters say
  const setAsideCount = pool.filter((proposal) => proposal.isSetAside).length

  // What the filter lets through, and the counts beside its options
  return { shown, categoryCounts, areaCounts, membershipCounts, setAsideCount }
}

/** The runs a paper brings into the pool's order, in turn: its own slots, what the other papers hold, the rest. */
const PAPER_RUNS = ['ownSlots', 'otherPapers', 'rest'] as const

/** One of {@link PAPER_RUNS}. */
type PaperRun = (typeof PAPER_RUNS)[number]

/**
 * Where a problem runs in the pool's order.
 */
type PoolPlace = {
  /** The paper it runs under, by its place on the board; one past the last paper where no paper takes it. */
  paperIndex: number
  /** The run it stands in under that paper. */
  run: PaperRun
  /** Its slot's place on the board, the papers read one after another; 0 where the board doesn't hold it. */
  boardSpot: number
}

/**
 * Orders problems the way the board runs. Each paper brings its placed problems in slot order, then the rest of the
 * problems recommended for its category, by area and then by number. Under a Category filter only the papers of the
 * categories picked run, and a problem another paper holds runs under the first of them it is recommended for, after
 * its slots and before the rest, in the board's order. A problem recommended for several categories runs under the
 * first paper among them, and a problem no paper takes runs after every paper.
 *
 * @param problems - The problems.
 * @param board - The board on screen; null when there is none, which leaves every problem by area and then by number.
 * @param categories - The categories whose papers run, by name; empty for every paper.
 *
 * @returns The problems in that order.
 */
function inBoardOrder(
  problems: readonly Proposal[],
  board: Board | null,
  categories: readonly string[]
): Proposal[] {
  // The board's papers in the order it sets them out, none without a board
  const papers = board?.papers ?? []

  // Where each problem on the board sits, by id: its paper, and its slot's place on the board
  const placedAt = new Map(
    papers
      .flatMap((paper, paperIndex) => paper.slots.map((slot) => ({ slot, paperIndex })))
      .flatMap(({ slot, paperIndex }, boardSpot): [string, Omit<PoolPlace, 'run'>][] =>
        slot === null ? [] : [[slot, { paperIndex, boardSpot }]]
      )
  )

  // A function which says whether a paper runs: every paper while no category is picked, else one of a category
  // picked
  const runs = (paper: Paper) => categories.length === 0 || categories.includes(paper.category)

  // A function which says whether a paper takes a problem it doesn't hold: one recommended for its category, where
  // the paper runs
  const takes = (paper: Paper, problem: Proposal) =>
    runs(paper) && problem.recommended.includes(paper.category)

  // A function which says where a problem runs: at its slot where a running paper holds it, else under the first
  // paper taking it, else after every paper
  const placeOf = (problem: Proposal): PoolPlace => {
    // The slot holding it on the board, if any
    const placed = placedAt.get(problem.id)

    // A problem a running paper holds runs at its slot
    if (placed !== undefined && runs(papers[placed.paperIndex])) {
      return { ...placed, run: 'ownSlots' }
    }

    // The first paper taking it, -1 where none does
    const takenBy = papers.findIndex((paper) => takes(paper, problem))

    // Under that paper, or after every paper where none takes it: among what the other papers hold where the board
    // holds it, else among the rest
    return {
      paperIndex: takenBy === -1 ? papers.length : takenBy,
      run: placed === undefined ? 'rest' : 'otherPapers',
      boardSpot: placed?.boardSpot ?? 0,
    }
  }

  // The problems by paper, then run, then place on the board, then area, then number
  return [...problems].sort((first, second) => {
    // Where each of the two runs
    const firstPlace = placeOf(first)
    const secondPlace = placeOf(second)

    // The earlier paper first, then the earlier run, then the earlier spot on the board, then the area listed first,
    // then the lower number
    return (
      firstPlace.paperIndex - secondPlace.paperIndex ||
      PAPER_RUNS.indexOf(firstPlace.run) - PAPER_RUNS.indexOf(secondPlace.run) ||
      firstPlace.boardSpot - secondPlace.boardSpot ||
      PROPOSAL_AREAS.indexOf(first.area) - PROPOSAL_AREAS.indexOf(second.area) ||
      first.number - second.number ||
      first.id.localeCompare(second.id)
    )
  })
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
