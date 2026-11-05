import {
  commentDtoKeyOf,
  commentsIn,
  countAllComments,
} from '@/components/features/comments/utils/comment-utils'
import { assertNever } from '@/components/shared/utils/assert-never'
import { entriesOf } from '@/components/shared/utils/collection-utils'
import { normalizeForSearch } from '@/components/shared/utils/string-utils'

import {
  type DiscussedSubject,
  type Discussion,
  type DiscussionThread,
  threadKeyOf,
  threadsByActivity,
} from './selection-discussions'
import type { PoolViewMode } from './selection-routes'
import {
  type Board,
  type Paper,
  type Proposal,
  PROPOSAL_AREAS,
  type ProposalArea,
  type SelectionCategory,
} from './selection-types'

/** Every answer to whether the board on screen holds a problem. */
const BOARD_MEMBERSHIPS = ['selected', 'notSelected'] as const

/** Whether the board on screen holds a problem. */
export type BoardMembership = (typeof BOARD_MEMBERSHIPS)[number]

/**
 * Every answer the pool's State facet can give: whether the board on screen holds a problem, or that a thread is about
 * a whole paper.
 */
const POOL_STANDINGS = [...BOARD_MEMBERSHIPS, 'wholePaper'] as const

/**
 * Where something the pool lists stands: a problem the board on screen holds or doesn't, or a thread about a whole
 * paper.
 */
export type PoolStanding = (typeof POOL_STANDINGS)[number]

/**
 * Whether a State answer follows the board on screen, so that another board on screen changes what it lets through.
 *
 * @param standing - The answer; null for none.
 *
 * @returns True for an answer on or off the board.
 */
export function followsBoard(standing: PoolStanding | null): standing is BoardMembership {
  // By the answer
  switch (standing) {
    case 'selected':
    case 'notSelected':
      return true
    case 'wholePaper':
    case null:
      return false

    // Every answer is handled above
    default:
      return assertNever(standing)
  }
}

/**
 * The answers each layout of the pool offers on its State facet, in the order the facet lists them, a whole paper only
 * where its threads are listed.
 */
export const OFFERED_STANDINGS: Record<PoolViewMode, readonly PoolStanding[]> = {
  problems: BOARD_MEMBERSHIPS,
  ratings: BOARD_MEMBERSHIPS,
  comments: POOL_STANDINGS,
}

/**
 * What the pool is narrowed to.
 */
export type PoolFilter = {
  /** Text a problem or a thread must contain, or a number like #7 naming one problem. */
  query: string
  /** The categories, by name, a problem or a thread must count toward at least one of; empty for any. */
  categories: string[]
  /** The areas a problem, or a thread's problem, must belong to one of; empty for any. */
  areas: ProposalArea[]
  /** Where what the pool lists must stand; null for anywhere. */
  standing: PoolStanding | null
  /** Whether the pool shows the set-aside problems instead of the live ones. */
  isShowingSetAside: boolean
}

/** A filter narrowing the pool by nothing. */
export const OPEN_POOL_FILTER: PoolFilter = {
  query: '',
  categories: [],
  areas: [],
  standing: null,
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
 * A filter as a layout of the pool reads it: a State answer the layout doesn't offer narrows nothing there, and is
 * still picked in a layout that offers it.
 *
 * @param filter - What the pool is narrowed to.
 * @param mode - The layout.
 *
 * @returns The filter the layout narrows by.
 */
export function filterForView(filter: PoolFilter, mode: PoolViewMode): PoolFilter {
  // The filter, its State answer dropped where the layout doesn't offer it
  return filter.standing === null || OFFERED_STANDINGS[mode].includes(filter.standing)
    ? filter
    : { ...filter, standing: null }
}

/**
 * The key a filter goes by against a board, alike for two searches differing only in the spaces around them.
 *
 * @param filter - What the pool is narrowed to.
 * @param board - The board the filter is read against; null for none.
 *
 * @returns The key.
 */
export function poolFilterKey(filter: PoolFilter, board: Board | null): string {
  // The filter with its search as the pool reads it, and the board
  return JSON.stringify([{ ...filter, query: filter.query.trim() }, board?.id ?? null])
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
    filter.standing !== null,
    filter.isShowingSetAside,
  ].filter(Boolean).length
}

/**
 * Whether a filter narrows by a search or a facet, in the set-aside view and the live one alike.
 *
 * @param filter - What the pool is narrowed to.
 *
 * @returns True where anything but the choice of the set-aside view narrows it.
 */
export function isNarrowed(filter: PoolFilter): boolean {
  // Any field narrowing the pool, the set-aside view left out
  return countActiveFilters({ ...filter, isShowingSetAside: false }) > 0
}

/**
 * The facet whose own filter a count leaves out; null where every filter applies.
 */
type OwnFacet = 'categories' | 'areas' | 'standing' | null

/**
 * The counts beside each facet's options, each item the pool lists counted at its weight: a problem as one, a thread
 * as the comments still standing in it.
 */
export type PoolCounts = {
  /** How much counts toward each category, by name, under every filter but the categories' own. */
  categoryCounts: Record<string, number>
  /** How much belongs to each area, under every filter but the areas' own. */
  areaCounts: Record<ProposalArea, number>
  /** How much stands each way, under every filter but the State's own. */
  standingCounts: Record<PoolStanding, number>
  /** How much is set aside, whatever the filters say. */
  setAsideCount: number
}

/**
 * What a filter lets through of what the pool lists, with the counts beside each facet's options.
 *
 * @template TItem - What the pool lists.
 */
export type PoolMatches<TItem> = PoolCounts & {
  /** What every filter lets through. */
  shown: TItem[]
}

/**
 * What a filter lets through of the discussions' threads and what it keeps out, with the counts beside each facet's
 * options.
 */
export type ThreadMatches = PoolMatches<DiscussionThread<DiscussedSubject>> & {
  /** The threads some filter keeps out, newest activity first. */
  hidden: DiscussionThread<DiscussedSubject>[]
}

/**
 * What the pool's filters read of a problem, for the problem itself and for its threads alike.
 */
type ProblemFacts = {
  /** The area it belongs to. */
  area: ProposalArea
  /** Whether the board on screen holds it. */
  membership: BoardMembership
  /** Whether it is set aside. */
  isSetAside: boolean
  /** The number a search like #7 finds it by. */
  number: number
}

/**
 * What the pool's filters read of one thing they narrow, a problem or a thread.
 */
type FilterFacts = {
  /** The categories, by name, it counts toward. */
  categories: readonly string[]
  /** What the filters read of the problem it is or hangs off; null for a thread about a whole paper. */
  problem: ProblemFacts | null
  /** Everything a search other than a number like #7 can match in it, folded like the search. */
  searchText: string
  /** How much it adds to a count beside an option. */
  weight: number
}

/**
 * Runs the pool through a filter. A problem a round took has left the pool and never shows.
 *
 * @param proposals - Every proposal.
 * @param filter - What the pool is narrowed to.
 * @param activeBoard - The board on screen; null when there is none.
 * @param categories - The selection's categories, in the order they run.
 *
 * @returns What the filter lets through in the order of the board on screen, with the facet counts, each problem
 * counted as one.
 */
export function matchPool(
  proposals: readonly Proposal[],
  filter: PoolFilter,
  activeBoard: Board | null,
  categories: readonly SelectionCategory[]
): PoolMatches<Proposal> {
  // The problems on the board on screen
  const onBoard = heldBy(activeBoard)

  // What the filter lets through of everything no round has taken, and the counts beside its options, each
  // problem weighed as one
  const matches = matchItems(
    proposals.filter((proposal) => !proposal.isUsed),
    (proposal) => ({
      ...proposalFactsOf(proposal, onBoard),
      searchText: searchableText(proposal),
      weight: 1,
    }),
    filter,
    categories
  )

  // What the filter lets through, in the order of the board on screen, and the counts beside its options
  return { ...matches, shown: inBoardOrder(matches.shown, activeBoard, filter.categories) }
}

/**
 * Runs the discussions' threads through a filter. A problem's thread stands as its problem does, whether a round took
 * the problem or not. A paper's thread counts toward its paper's category, belongs to no area, stands as about a whole
 * paper and is never set aside, and no search for a number finds it. Any other search finds a thread by what any of
 * its comments say, a problem's thread also by whatever finds its problem, and a paper's by its paper's and its
 * board's names. A thread laid out before is found by what its comments said then and by whatever has been posted in
 * it since, so an edit or a deletion never takes it out from under a search or brings it in.
 *
 * @param discussions - The discussions, each with its top-level comments.
 * @param filter - What the pool is narrowed to.
 * @param activeBoard - The board on screen; null when there is none.
 * @param categories - The selection's categories, in the order they run.
 * @param laidOut - The discussions as the threads were last laid out; none where they are laid out afresh.
 *
 * @returns What the filter lets through and what it keeps out, each newest activity first, with the facet counts, each
 * thread counted as the comments still standing in it.
 */
export function matchDiscussions(
  discussions: readonly Discussion<DiscussedSubject>[],
  filter: PoolFilter,
  activeBoard: Board | null,
  categories: readonly SelectionCategory[],
  laidOut: readonly Discussion<DiscussedSubject>[]
): ThreadMatches {
  // Each top-level comment as the threads were last laid out, by the key its thread keeps
  const laidOutComments = new Map(
    laidOut.flatMap(({ subject, comments }) =>
      comments.map((comment) => [threadKeyOf({ subject, comment }), comment] as const)
    )
  )

  // A function which reads what a thread's comments say: what they said as last laid out, and whatever has been posted
  // in it since
  const saidIn = (thread: DiscussionThread<DiscussedSubject>) => {
    // The thread's top-level comment as last laid out, if it was
    const before = laidOutComments.get(threadKeyOf(thread))

    // The top-level comment as last laid out and its replies as they stood, none where the thread was not laid out
    const commentsBefore = before === undefined ? [] : commentsIn(before)

    // The keys the laid-out comments keep through an edit
    const keysBefore = new Set(commentsBefore.map(commentDtoKeyOf))

    // The comments posted in the thread since it was last laid out
    const postedSince = commentsIn(thread.comment).filter(
      (comment) => !keysBefore.has(commentDtoKeyOf(comment))
    )

    // What the laid-out comments and the ones posted since say, the laid-out ones first
    return [...commentsBefore, ...postedSince].map(({ content }) => content)
  }

  // The problems on the board on screen
  const onBoard = heldBy(activeBoard)

  // A function which reads what the filters narrow by in a thread
  const factsOf = (thread: DiscussionThread<DiscussedSubject>): FilterFacts => {
    // What the thread hangs off, and its top-level comment
    const { subject, comment } = thread

    // What the thread's comments say
    const said = saidIn(thread)

    // How many of the thread's comments still stand
    const weight = countAllComments([comment])

    // By what the thread hangs off
    switch (subject.kind) {
      case 'proposal':
        return {
          ...proposalFactsOf(subject.proposal, onBoard),
          // The problem as a search finds it, and what the comments say, folded like the search
          searchText: normalizeForSearch([searchableText(subject.proposal), ...said].join('\n')),
          weight,
        }
      case 'paper':
        return {
          categories: [subject.paper.category],
          problem: null,
          // The paper's name and its board's, and what the comments say, folded like the search
          searchText: normalizeForSearch(
            [subject.paper.name, subject.board.name, ...said].join('\n')
          ),
          weight,
        }

      // Every kind is handled above
      default:
        return assertNever(subject)
    }
  }

  // Every thread with anything to show, newest activity first
  const threads = threadsByActivity(discussions)

  // What the filter lets through of the threads, and the counts beside its options
  const matches = matchItems(threads, factsOf, filter, categories)

  // The keys of the threads let through
  const shownKeys = new Set(matches.shown.map(threadKeyOf))

  // What the filter lets through, what it keeps out, and the counts
  return { ...matches, hidden: threads.filter((thread) => !shownKeys.has(threadKeyOf(thread))) }
}

/**
 * Runs what the pool lists through a filter, in the order it comes in.
 *
 * @template TItem - What the pool lists.
 *
 * @param items - Everything the pool lists.
 * @param factsOf - Reads what the filters narrow by in one item.
 * @param filter - What the pool is narrowed to.
 * @param categories - The selection's categories, in the order they run.
 *
 * @returns What the filter lets through, in the order it came in, with the facet counts.
 */
function matchItems<TItem>(
  items: readonly TItem[],
  factsOf: (item: TItem) => FilterFacts,
  filter: PoolFilter,
  categories: readonly SelectionCategory[]
): PoolMatches<TItem> {
  // The search text, folded for matching
  const searchTerm = normalizeForSearch(filter.query.trim())

  // The number a search like #7 names; undefined for any other search
  const searchedNumber = /^#(\d+)$/.exec(searchTerm)?.[1]

  // A function which says whether an item answers the search: by the number of the problem it is or hangs off, where
  // the search names one, else by the text anywhere in the item
  const answersSearch = (facts: FilterFacts) =>
    searchedNumber === undefined
      ? facts.searchText.includes(searchTerm)
      : facts.problem?.number === Number(searchedNumber)

  // What each facet's own filter lets through
  const facetFilters: Record<Exclude<OwnFacet, null>, (facts: FilterFacts) => boolean> = {
    // An item counting toward one of the categories picked, or any item while none is picked
    categories: (facts) =>
      filter.categories.length === 0 ||
      filter.categories.some((category) => facts.categories.includes(category)),

    // An item in one of the areas picked, or any item while none is picked
    areas: (facts) =>
      filter.areas.length === 0 ||
      (facts.problem !== null && filter.areas.includes(facts.problem.area)),

    // An item standing as picked, or any item while nothing is picked
    standing: (facts) => filter.standing === null || standingOf(facts) === filter.standing,
  }

  // A function which says whether an item passes every filter but the one facet named
  const passes = (facts: FilterFacts, ownFacet: OwnFacet) =>
    isSetAside(facts) === filter.isShowingSetAside &&
    entriesOf(facetFilters).every(
      ([facet, letsThrough]) => facet === ownFacet || letsThrough(facts)
    ) &&
    (searchTerm === '' || answersSearch(facts))

  // Each item with what the filters read of it
  const read = items.map((item) => ({ item, facts: factsOf(item) }))

  // What every filter lets through, in the order it came in
  const shown = read.filter(({ facts }) => passes(facts, null)).map(({ item }) => item)

  // A function which adds up the weights of the items a condition holds for
  const weighOut = (holds: (facts: FilterFacts) => boolean) =>
    read.reduce((total, { facts }) => total + (holds(facts) ? facts.weight : 0), 0)

  // A function which weighs the items holding each of a facet's options, under the other filters
  const countByOption = <TOption extends string>(
    facet: Exclude<OwnFacet, null>,
    options: readonly TOption[],
    holds: (facts: FilterFacts, option: TOption) => boolean
  ) =>
    Object.fromEntries(
      options.map((option) => [
        option,
        weighOut((facts) => passes(facts, facet) && holds(facts, option)),
      ])
    ) as Record<TOption, number>

  // The items counting toward each category, weighed under every filter but the categories' own
  const categoryCounts = countByOption(
    'categories',
    categories.map((category) => category.name),
    (facts, category) => facts.categories.includes(category)
  )

  // The items in each area, weighed under every filter but the areas' own
  const areaCounts = countByOption(
    'areas',
    PROPOSAL_AREAS,
    (facts, area) => facts.problem?.area === area
  )

  // The items standing each way, weighed under every other filter
  const standingCounts = countByOption(
    'standing',
    POOL_STANDINGS,
    (facts, standing) => standingOf(facts) === standing
  )

  // How much of what the pool lists is set aside, whatever the filters say
  const setAsideCount = weighOut(isSetAside)

  // What the filter lets through, and the counts beside its options
  return { shown, categoryCounts, areaCounts, standingCounts, setAsideCount }
}

/**
 * What the filters read of a problem, alike for the problem itself and for its threads.
 *
 * @param proposal - The problem.
 * @param onBoard - The ids of the problems the board on screen holds.
 *
 * @returns The facts, short of the text a search reads and the weight.
 */
function proposalFactsOf(
  proposal: Proposal,
  onBoard: ReadonlySet<string>
): Omit<FilterFacts, 'searchText' | 'weight'> {
  // What the problem is recommended for, its area, whether the board holds it, whether it is set aside, its number
  return {
    categories: proposal.recommended,
    problem: {
      area: proposal.area,
      membership: onBoard.has(proposal.id) ? 'selected' : 'notSelected',
      isSetAside: proposal.isSetAside,
      number: proposal.number,
    },
  }
}

/**
 * Where something the filters narrow stands: as the board on screen holds its problem, or about a whole paper.
 *
 * @param facts - What the filters read of it.
 *
 * @returns Where it stands.
 */
function standingOf(facts: FilterFacts): PoolStanding {
  // Whether the board holds the problem, or a whole paper where no problem is its subject
  return facts.problem === null ? 'wholePaper' : facts.problem.membership
}

/**
 * Whether something the filters narrow is set aside, which only a problem and its threads can be.
 *
 * @param facts - What the filters read of it.
 *
 * @returns True where its problem is set aside.
 */
function isSetAside(facts: FilterFacts): boolean {
  // The problem set aside, never a whole paper
  return facts.problem !== null && facts.problem.isSetAside
}

/**
 * The ids of the problems a board holds in its slots.
 *
 * @param board - The board; null when there is none, which holds nothing.
 *
 * @returns The ids.
 */
function heldBy(board: Board | null): ReadonlySet<string> {
  // Every filled slot's problem across the board's papers
  return new Set(
    board?.papers.flatMap((paper) => paper.slots).filter((slot) => slot !== null) ?? []
  )
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
