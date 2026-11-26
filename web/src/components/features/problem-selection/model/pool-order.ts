import { assertNever } from '@/components/shared/utils/assert-never'

import type { DiscussedSubject, DiscussionThread } from './selection-discussions'
import type { CommentsOrder } from './selection-routes'
import { isDraft } from './selection-state'
import { type Board, type Paper, type Proposal, PROPOSAL_AREAS } from './selection-types'

/**
 * The groups under each paper in the pool's order, in turn: the problems in its own slots, problems other papers hold,
 * then the rest.
 */
const PAPER_RUNS = ['ownSlots', 'otherPapers', 'rest'] as const

/** One of {@link PAPER_RUNS}. */
type PaperRun = (typeof PAPER_RUNS)[number]

/**
 * Where a problem sits in the pool's order.
 */
type PoolPlace = {
  /** The paper it sits under, by position on the board; one past the last paper for a problem no paper takes. */
  paperIndex: number
  /** The group it sits in under that paper. */
  run: PaperRun
  /** Its slot's position on the board, counting through the papers in order, or 0 when the board doesn't hold it. */
  spot: number
}

/**
 * Says where a board runs each problem of the pool. Under a Category filter only the papers of the categories picked
 * run. A problem a running paper holds runs at its slot; any other runs under the first running paper of a category it
 * is recommended for, what the board holds before the rest, and a problem no paper takes runs after every paper.
 *
 * @param board - The board on screen; null when there is none.
 * @param categories - The categories whose papers run, by name; empty for every paper.
 *
 * @returns A function which says where a problem runs.
 */
function poolPlacerOf(
  board: Board | null,
  categories: readonly string[]
): (problem: Proposal) => PoolPlace {
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
  // picked, which a paper with no category never is
  const runs = (paper: Paper) =>
    categories.length === 0 || (paper.category !== null && categories.includes(paper.category))

  // A function which says whether a paper takes a problem it doesn't hold: one recommended for its category, where
  // the paper runs, which leaves a paper with no category taking none
  const takes = (paper: Paper, problem: Proposal) =>
    runs(paper) && paper.category !== null && problem.recommended.includes(paper.category)

  // A function which says where a problem runs: at its slot where a running paper holds it, else under the first
  // paper taking it, else after every paper
  return (problem) => {
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
}

/**
 * Compares where two problems run in the pool's order.
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
 * The groups under a paper in the comments' order by problem, in turn: threads about the paper itself, then threads
 * about the problems in its slots.
 */
const PAPER_PARTS = ['paper', 'slots'] as const

/** One of {@link PAPER_PARTS}. */
type PaperPart = (typeof PAPER_PARTS)[number]

/**
 * Where a thread's subject sits in the comments' order by problem. The drafts come first, newest first, then the pool,
 * then the boards finalized into rounds, newest first. The pool runs like one more board whose papers are the
 * categories.
 */
type CommentPlace = {
  /** Its board's position among the drafts, the pool and the finalized boards, in that order. */
  rank: number
  /**
   * Its paper's position on its board. In the pool, the position of the first category it is recommended for, one
   * past the last category for a problem recommended for none.
   */
  group: number
  /** The group it sits in under that paper; the slots for every problem in the pool. */
  part: PaperPart
  /** Its slot's position in its paper, 0 for a thread about the paper; in the pool, the problem's number. */
  spot: number
}

/**
 * Compares where two threads' subjects sit in the comments' order by problem.
 *
 * @param first - Where the first sits.
 * @param second - Where the second sits.
 *
 * @returns Negative where the first runs earlier, positive where later, 0 where they share a place.
 */
function compareCommentPlaces(first: CommentPlace, second: CommentPlace): number {
  // The earlier board, then the earlier paper, then the paper's own threads, then the earlier spot
  return (
    first.rank - second.rank ||
    first.group - second.group ||
    PAPER_PARTS.indexOf(first.part) - PAPER_PARTS.indexOf(second.part) ||
    first.spot - second.spot
  )
}

/**
 * Says where a thread's subject sits in the comments' order by problem, against the selection's boards. A problem
 * several boards hold sits under the first of them in that order.
 *
 * @param boards - The selection's boards, oldest first.
 * @param categories - The selection's categories, by name, in the order they run.
 *
 * @returns A function which says where a subject sits.
 */
function commentPlacerOf(
  boards: readonly Board[],
  categories: readonly string[]
): (subject: DiscussedSubject) => CommentPlace {
  // The boards newest first
  const newestFirst = [...boards].reverse()

  // The drafts, newest first
  const drafts = newestFirst.filter(isDraft)

  // The boards finalized into rounds, opened or not, newest first
  const finalized = newestFirst.filter((board) => !isDraft(board))

  // Each board's rank by id: the drafts, one rank left for the pool, then the finalized boards
  const rankById = new Map([
    ...drafts.map(({ id }, index): [string, number] => [id, index]),
    ...finalized.map(({ id }, index): [string, number] => [id, drafts.length + 1 + index]),
  ])

  // The rank after every board, for a board missing from the boards given
  const goneRank = drafts.length + 1 + finalized.length

  // A function which says a board's rank by its id
  const rankOf = (boardId: string) => rankById.get(boardId) ?? goneRank

  // Where each problem on a board sits, by id, under the first board holding it: the map keeps the last of each id,
  // so the slots go in from the last board to the first
  const slotPlaces = new Map(
    [...drafts, ...finalized]
      .flatMap((board) =>
        board.papers.flatMap((paper, group) =>
          paper.slots.flatMap((slot, spot): [string, CommentPlace][] =>
            slot === null ? [] : [[slot, { rank: rankOf(board.id), group, part: 'slots', spot }]]
          )
        )
      )
      .reverse()
  )

  // A function which says where a subject sits
  return (subject) => {
    // By what the thread hangs off
    switch (subject.kind) {
      case 'proposal': {
        // The first category in the order they run that the problem is recommended for, -1 where none
        const category = categories.findIndex((name) => subject.proposal.recommended.includes(name))

        // At its slot where a board holds it, else in the pool under that category, by number
        return (
          slotPlaces.get(subject.proposal.id) ?? {
            rank: drafts.length,
            group: category === -1 ? categories.length : category,
            part: 'slots',
            spot: subject.proposal.number,
          }
        )
      }
      case 'paper':
        // At the head of its paper on its board
        return {
          rank: rankOf(subject.board.id),
          group: subject.board.papers.findIndex(({ id }) => id === subject.paper.id),
          part: 'paper',
          spot: 0,
        }

      // Every kind is handled above
      default:
        return assertNever(subject)
    }
  }
}

/**
 * Sorts the threads the filters let through into the chosen order.
 *
 * @param threads - The threads, newest activity first.
 * @param order - The chosen order.
 * @param boards - The selection's boards, oldest first.
 * @param categories - The selection's categories, by name, in the order they run.
 *
 * @returns The threads as given for newest first, or sorted by problem as {@link inProblemOrder} sorts them.
 */
export function threadsInOrder(
  threads: readonly DiscussionThread<DiscussedSubject>[],
  order: CommentsOrder,
  boards: readonly Board[],
  categories: readonly string[]
): DiscussionThread<DiscussedSubject>[] {
  // By the order asked for
  switch (order) {
    case 'newest':
      return [...threads]
    case 'problem':
      return inProblemOrder(threads, boards, categories)

    // Every order is handled above
    default:
      return assertNever(order)
  }
}

/**
 * Sorts threads by problem. The drafts come first, the newest first, then the pool, then the boards finalized into
 * rounds, the newest first. A board runs paper by paper, each paper's own threads first, then its problems in slot
 * order. The pool runs its problems by the first category each is recommended for, in the order the categories run,
 * then by number. Within one problem or paper, the oldest thread comes first.
 *
 * @param threads - The threads.
 * @param boards - The selection's boards, oldest first.
 * @param categories - The selection's categories, by name, in the order they run.
 *
 * @returns The threads in that order.
 */
function inProblemOrder(
  threads: readonly DiscussionThread<DiscussedSubject>[],
  boards: readonly Board[],
  categories: readonly string[]
): DiscussionThread<DiscussedSubject>[] {
  // A function which says where a thread's subject sits
  const placeOf = commentPlacerOf(boards, categories)

  // The threads by where their subjects sit, then each subject's oldest first
  return [...threads].sort(
    (first, second) =>
      compareCommentPlaces(placeOf(first.subject), placeOf(second.subject)) ||
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
  // A function which says where a problem runs on the board
  const placeOf = poolPlacerOf(board, categories)

  // The problems by where they run, then by area and number
  return [...problems].sort(
    (first, second) =>
      comparePlaces(placeOf(first), placeOf(second)) || compareProblems(first, second)
  )
}
