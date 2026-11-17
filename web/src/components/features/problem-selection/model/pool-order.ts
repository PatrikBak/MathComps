import { assertNever } from '@/components/shared/utils/assert-never'

import {
  type DiscussedSubject,
  discussionTargetOf,
  type DiscussionThread,
} from './selection-discussions'
import type { CommentsOrder } from './selection-routes'
import { type Board, type Paper, type Proposal, PROPOSAL_AREAS } from './selection-types'

/**
 * The groups under each paper in the pool's order, in turn: threads about whole papers of its category, the problems
 * in its own slots, problems other papers hold, then the rest. Only threads go in the first group.
 */
const PAPER_RUNS = ['papers', 'ownSlots', 'otherPapers', 'rest'] as const

/** One of {@link PAPER_RUNS}. */
type PaperRun = (typeof PAPER_RUNS)[number]

/**
 * Where a problem or a thread sits in the pool's order.
 */
type PoolPlace = {
  /**
   * The paper it sits under, by position on the board. One past the last paper for a problem no paper takes, two past
   * it for a thread about a paper whose category has no running paper.
   */
  paperIndex: number
  /** The group it sits in under that paper. */
  run: PaperRun
  /**
   * For a problem, its slot's position on the board, counting through the papers in order, or 0 when the board doesn't
   * hold it. For a thread about a paper, its board's position among the selection's boards, newest first.
   */
  spot: number
}

/**
 * How a board orders the pool under the categories picked.
 */
type BoardRunner = {
  /** The board's papers in the order it sets them out, none without a board. */
  papers: readonly Paper[]
  /** Whether a paper runs: no category is picked, or its category is. */
  runs: (paper: Paper) => boolean
  /** Where a problem sits. */
  placeOf: (problem: Proposal) => PoolPlace
}

/**
 * The order a board runs the pool in. Under a Category filter only the papers of the categories picked run. A
 * problem a running paper holds runs at its slot; any other runs under the first running paper of a category it is
 * recommended for, what the board holds before the rest, and a problem no paper takes runs after every paper.
 *
 * @param board - The board on screen; null when there is none.
 * @param categories - The categories whose papers run, by name; empty for every paper.
 *
 * @returns The papers, which of them run, and where a problem runs.
 */
function boardRunnerOf(board: Board | null, categories: readonly string[]): BoardRunner {
  // The board's papers in the order it sets them out, none without a board
  const papers = board?.papers ?? []

  // Where each problem on the board sits, by id: its paper, and its slot's place on the board
  const placedAt = new Map(
    papers
      .flatMap((paper, paperIndex) => paper.slots.map((slot) => ({ slot, paperIndex })))
      .flatMap(({ slot, paperIndex }, spot): [string, Omit<PoolPlace, 'run'>][] =>
        slot === null ? [] : [[slot, { paperIndex, spot }]]
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
      spot: placed?.spot ?? 0,
    }
  }

  // The papers, which of them run, and where a problem runs
  return { papers, runs, placeOf }
}

/**
 * Compares where two things run in the pool's order.
 *
 * @param first - Where the first runs.
 * @param second - Where the second runs.
 *
 * @returns Negative where the first runs earlier, positive where later, 0 where they share a place.
 */
function comparePlaces(first: PoolPlace, second: PoolPlace): number {
  // The earlier paper first, then the earlier run, then the earlier spot
  return (
    first.paperIndex - second.paperIndex ||
    PAPER_RUNS.indexOf(first.run) - PAPER_RUNS.indexOf(second.run) ||
    first.spot - second.spot
  )
}

/**
 * Compares two problems sharing a place in the pool's order.
 *
 * @param first - The first problem.
 * @param second - The second problem.
 *
 * @returns Negative where the first runs earlier, positive where later.
 */
function compareProblems(first: Proposal, second: Proposal): number {
  // The area listed first, then the lower number, then the id
  return (
    PROPOSAL_AREAS.indexOf(first.area) - PROPOSAL_AREAS.indexOf(second.area) ||
    first.number - second.number ||
    first.id.localeCompare(second.id)
  )
}

/**
 * Sorts the threads the filters let through into the chosen order.
 *
 * @param threads - The threads, newest activity first.
 * @param order - The chosen order.
 * @param board - The board on screen; null when there is none.
 * @param categories - The categories picked, by name; empty for none.
 * @param boards - The selection's boards, oldest first.
 *
 * @returns The threads as given for newest first, or sorted by problem as {@link inProblemOrder} sorts them.
 */
export function threadsInOrder(
  threads: readonly DiscussionThread<DiscussedSubject>[],
  order: CommentsOrder,
  board: Board | null,
  categories: readonly string[],
  boards: readonly Board[]
): DiscussionThread<DiscussedSubject>[] {
  // By the order asked for
  switch (order) {
    case 'newest':
      return [...threads]
    case 'problem':
      return inProblemOrder(threads, board, categories, boards)

    // Every order is handled above
    default:
      return assertNever(order)
  }
}

/**
 * Sorts threads by problem, in the order {@link inBoardOrder} gives the problems, used problems included. Threads about
 * a whole paper come first under the board's paper of the same category, whichever board their own paper is on, the
 * newest board's first. When no paper of their category runs, they go last. Within one problem or paper, the oldest
 * thread comes first.
 *
 * @param threads - The threads.
 * @param board - The board on screen; null when there is none.
 * @param categories - The categories whose papers run, by name; empty for every paper.
 * @param boards - The selection's boards, oldest first.
 *
 * @returns The threads in that order.
 */
function inProblemOrder(
  threads: readonly DiscussionThread<DiscussedSubject>[],
  board: Board | null,
  categories: readonly string[],
  boards: readonly Board[]
): DiscussionThread<DiscussedSubject>[] {
  // The board's papers, which of them run, and where a problem runs
  const { papers, runs, placeOf } = boardRunnerOf(board, categories)

  // A function which says where a thread's subject runs
  const subjectPlaceOf = (subject: DiscussedSubject): PoolPlace => {
    // By what the thread hangs off
    switch (subject.kind) {
      case 'proposal':
        return placeOf(subject.proposal)
      case 'paper': {
        // The running paper of the paper's category, -1 where none runs
        const headed = papers.findIndex(
          (paper) => runs(paper) && paper.category === subject.paper.category
        )

        // The paper's board's place among the boards, the newest first
        const newness = boards.length - 1 - boards.findIndex(({ id }) => id === subject.board.id)

        // At the head of that paper's run, or after everything where none runs
        return {
          paperIndex: headed === -1 ? papers.length + 1 : headed,
          run: 'papers',
          spot: newness,
        }
      }

      // Every kind is handled above
      default:
        return assertNever(subject)
    }
  }

  // A function which compares two subjects sharing a place, which only two problems or two papers do: two problems
  // by area and number, two papers by id
  const compareSubjects = (first: DiscussedSubject, second: DiscussedSubject) => {
    // By what the first hangs off
    switch (first.kind) {
      case 'proposal':
        return second.kind === 'proposal' ? compareProblems(first.proposal, second.proposal) : 0
      case 'paper':
        return discussionTargetOf(first).targetId.localeCompare(discussionTargetOf(second).targetId)

      // Every kind is handled above
      default:
        return assertNever(first)
    }
  }

  // The threads by where their subjects run, then each subject's oldest first
  return [...threads].sort(
    (first, second) =>
      comparePlaces(subjectPlaceOf(first.subject), subjectPlaceOf(second.subject)) ||
      compareSubjects(first.subject, second.subject) ||
      Date.parse(first.comment.createdAt) - Date.parse(second.comment.createdAt) ||
      first.comment.id.localeCompare(second.comment.id)
  )
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
export function inBoardOrder(
  problems: readonly Proposal[],
  board: Board | null,
  categories: readonly string[]
): Proposal[] {
  // Where each problem runs on the board
  const { placeOf } = boardRunnerOf(board, categories)

  // The problems by where they run, then by area and number
  return [...problems].sort(
    (first, second) =>
      comparePlaces(placeOf(first), placeOf(second)) || compareProblems(first, second)
  )
}
