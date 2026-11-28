import {
  commentDtoKeyOf,
  commentsIn,
  countAllComments,
} from '@/components/features/comments/utils/comment-utils'
import { assertNever } from '@/components/shared/utils/assert-never'
import { entriesOf } from '@/components/shared/utils/collection-utils'
import { normalizeForSearch } from '@/components/shared/utils/string-utils'

import {
  type BoardMembership,
  POOL_STANDINGS,
  type PoolFilter,
  type PoolStanding,
} from './pool-filter'
import { inBoardOrder } from './pool-order'
import {
  paperTargetKeyOf,
  type RecommendationTarget,
  recommendedKeysOf,
  targetKeyOf,
} from './recommendation-targets'
import {
  type DiscussedSubject,
  type Discussion,
  type DiscussionThread,
  threadKeyOf,
  threadsByActivity,
} from './selection-discussions'
import { type Board, type Proposal, PROPOSAL_AREAS, type ProposalArea } from './selection-types'

/**
 * The facet whose own filter a count leaves out; null where every filter applies.
 */
type OwnFacet = 'targets' | 'areas' | 'standing' | null

/**
 * The counts beside each facet's options, each item the pool lists counted at its weight: a problem as one, a thread
 * as the comments still standing in it.
 */
export type PoolCounts = {
  /** How much counts toward each recommendation target, by its key, under every filter but the targets' own. */
  targetCounts: Record<string, number>
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
  /** The keys of the recommendation targets it counts toward. */
  targets: readonly string[]
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
 * @param targets - What a problem can be recommended for, in the order it runs.
 *
 * @returns What the filter lets through in the order of the board on screen, with the facet counts, each problem
 * counted as one.
 */
export function matchPool(
  proposals: readonly Proposal[],
  filter: PoolFilter,
  activeBoard: Board | null,
  targets: readonly RecommendationTarget[]
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
    targets
  )

  // What the filter lets through, in the order of the board on screen, and the counts beside its options
  return { ...matches, shown: inBoardOrder(matches.shown, activeBoard, filter.targets) }
}

/**
 * Runs the discussions' threads through a filter. A problem's thread stands as its problem does, whether a round took
 * the problem or not. A paper's thread counts toward its paper's target, belongs to no area, stands as about a whole
 * paper and is never set aside, and no search for a number finds it. Any other search finds a thread by what any of
 * its comments say, a problem's thread also by whatever finds its problem, and a paper's by its paper's and its
 * board's names. A thread laid out before is found by what its comments said then and by whatever has been posted in
 * it since, so an edit or a deletion never takes it out from under a search or brings it in.
 *
 * @param discussions - The discussions, each with its top-level comments.
 * @param filter - What the pool is narrowed to.
 * @param activeBoard - The board on screen; null when there is none.
 * @param targets - What a problem can be recommended for, in the order it runs.
 * @param laidOut - The discussions as the threads were last laid out; none where they are laid out afresh.
 *
 * @returns What the filter lets through and what it keeps out, each newest activity first, with the facet counts, each
 * thread counted as the comments still standing in it.
 */
export function matchDiscussions(
  discussions: readonly Discussion<DiscussedSubject>[],
  filter: PoolFilter,
  activeBoard: Board | null,
  targets: readonly RecommendationTarget[],
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
      case 'paper': {
        // The key of the paper's target, if it has one
        const targetKey = paperTargetKeyOf(subject.paper, subject.board)

        // What the filters read of the paper's thread
        return {
          // The paper's target, none for a finalized board's paper with no category
          targets: targetKey === null ? [] : [targetKey],
          problem: null,
          // The paper's name and its board's, and what the comments say, folded like the search
          searchText: normalizeForSearch(
            [subject.paper.name, subject.board.name, ...said].join('\n')
          ),
          weight,
        }
      }

      // Every kind is handled above
      default:
        return assertNever(subject)
    }
  }

  // Every thread with anything to show, newest activity first
  const threads = threadsByActivity(discussions)

  // What the filter lets through of the threads, and the counts beside its options
  const matches = matchItems(threads, factsOf, filter, targets)

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
 * @param targets - What a problem can be recommended for, in the order it runs.
 *
 * @returns What the filter lets through, in the order it came in, with the facet counts.
 */
function matchItems<TItem>(
  items: readonly TItem[],
  factsOf: (item: TItem) => FilterFacts,
  filter: PoolFilter,
  targets: readonly RecommendationTarget[]
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
    // An item counting toward one of the targets picked, or any item while none is picked
    targets: (facts) =>
      filter.targets.length === 0 || filter.targets.some((key) => facts.targets.includes(key)),

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

  // The items counting toward each target, weighed under every filter but the targets' own
  const targetCounts = countByOption('targets', targets.map(targetKeyOf), (facts, key) =>
    facts.targets.includes(key)
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
  return { shown, targetCounts, areaCounts, standingCounts, setAsideCount }
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
  // The keys of what the problem is recommended for, its area, whether the board holds it, whether it is set aside,
  // its number
  return {
    targets: recommendedKeysOf(proposal),
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
