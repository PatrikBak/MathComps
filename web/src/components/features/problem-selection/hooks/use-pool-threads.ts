'use client'

import type { NewcomerPlace } from '@/components/shared/utils/first-seen-order'
import type { UseAddressedChoiceResult } from '@/hooks/use-addressed-choice'
import { useFirstSeenOrder } from '@/hooks/use-first-seen-order'
import { useKeyedState } from '@/hooks/use-keyed-state'

import { useLoadedSelection, useSelectionWorkspace } from '../components/SelectionWorkspaceProvider'
import {
  followsBoard,
  matchDiscussions,
  type PoolCounts,
  poolFilterKey,
} from '../model/pool-filters'
import { threadsInOrder } from '../model/pool-order'
import { poolDiscussionPartsOf } from '../model/seen-marks'
import {
  type DiscussedSubject,
  discussedSubjectsOf,
  discussionTargetOf,
  type DiscussionThread,
  showTheSame,
  threadKeyOf,
  underSubjectsOf,
} from '../model/selection-discussions'
import type { CommentsOrder } from '../model/selection-routes'
import type { UsePoolFiltersResult } from './use-pool-filters'
import { usePoolThreadFilters } from './use-pool-thread-filters'
import {
  useSelectionDiscussions,
  type UseSelectionDiscussionsResult,
} from './use-selection-discussions'
import { useIsWritingSelection } from './use-selection-write'

/**
 * What {@link usePoolThreads} hands back.
 */
type UsePoolThreadsResult = Pick<UseSelectionDiscussionsResult, 'uiState' | 'retry'> & {
  /** The threads the filters let through, in the order they are held in; null until the first read has landed. */
  threads: DiscussionThread<DiscussedSubject>[] | null
  /** The threads the filters keep out, newest activity first. */
  hidden: DiscussionThread<DiscussedSubject>[]
  /** How many comments stand beside each of the filters' options; null until the first read has landed. */
  counts: PoolCounts | null
  /**
   * Whether showing the latest read would change the threads the filters let through, holding its last answer while
   * that can't be told.
   */
  hasNews: boolean
  /**
   * Shows what the latest read brings to the threads the filters let through, telling the server what they then show
   * was seen.
   */
  showNews: () => void
  /**
   * What the threads are narrowed to, each change made through it taking in everything waiting and laying the threads
   * out afresh.
   */
  filters: UsePoolFiltersResult
  /** The order of the threads. Each change shows everything waiting and lays the threads out again. */
  order: UseAddressedChoiceResult<CommentsOrder>
  /**
   * The key the list is redrawn under. It changes with every filter change except the search, with the order, and with
   * the board on screen while the filter or the order depends on it. A search keeps the list, so typing never redraws
   * it.
   */
  listKey: string
}

/** Whether each order depends on the board on screen, so a board change lays the threads out again. */
const ORDER_FOLLOWS_BOARD: Record<CommentsOrder, boolean> = { newest: false, problem: true }

/** Where a thread arriving after the layout goes in each order: on top, or into its place in the order. */
const NEWCOMER_PLACES: Record<CommentsOrder, NewcomerPlace> = { newest: 'top', problem: 'inPlace' }

/**
 * The threads of the discussions of what the selection holds that the pool's filters let through: each problem's,
 * taken by a round or not, and each paper's, as {@link matchDiscussions} reads them.
 *
 * Each layout sorts the threads in the chosen order, newest first or by problem as {@link threadsInOrder} sorts them.
 * They then keep their places until the next layout, so nothing moves under the reader. A new thread goes on top when
 * newest first, and into its place when by problem. The threads are laid out again when the discussions are shown
 * again, when the filters change, when the order changes, and when the board on screen changes while a State answer on
 * or off the board is picked or the order is by problem. They are let through and sorted against the selection and
 * the discussions as they stood then, so between layouts an edit or a deletion never moves a thread in or out under a
 * search. What a later read brings counts as news where it would change the threads the filters let through, and so
 * does a change another reviewer makes to the selection, a problem set aside or placed on the board among them. The
 * reader's own writes to the selection show at once. News stays news through the reader's own writes to comments,
 * which leave it untold for a moment. Asking for it takes it into the discussions of the threads let through and of
 * those the read would let through, or into every discussion while the read can't be told, lays the threads out
 * against the selection as it now stands, and tells the server what they then show was seen. The filters and the order handed back work as {@link usePoolThreadFilters} tells.
 *
 * @returns The threads let through and those kept out, what waits to be shown, the counts, the filters, the order,
 * the list's key, and the state of the read.
 */
export function usePoolThreads(): UsePoolThreadsResult {
  // The selection, with the board on screen
  const selection = useLoadedSelection()

  // Every problem and every paper, each paper with the board it is on
  const subjects = discussedSubjectsOf(selection)

  // The subjects' discussions, as shown and as the latest read would leave them, and how far the read has got
  const { shown, uiState, retry, showNews: showLatest } = useSelectionDiscussions({ subjects })

  // The board on screen and the selection's categories
  const { activeBoard, categories } = selection

  // What the pool is narrowed to and the order its comments run in, with the ways of changing both
  const { poolFilters, commentsOrder } = useSelectionWorkspace()

  // What the threads are narrowed to
  const { filter } = poolFilters

  // The order the threads run in
  const order = commentsOrder.option

  // The board on screen while the State answer picked follows it; none while what the filters let through doesn't
  // hang on the board
  const followedBoard = followsBoard(filter.standing) ? activeBoard : null

  // The key of what the threads are narrowed to: the filter, with the board while they follow it
  const filterKey = poolFilterKey(filter, followedBoard)

  // The board on screen while the order depends on it; null otherwise
  const orderedOnBoard = ORDER_FOLLOWS_BOARD[order] ? activeBoard : null

  // The key of the order, with the board while the order depends on it
  const orderKey = JSON.stringify([order, orderedOnBoard?.id ?? null])

  // The key the threads are laid out again under: it changes with each showing, each filter change and each order
  // change
  const layoutKey = `${shown?.showings ?? 0}:${filterKey}:${orderKey}`

  // Whether a write of the reader's to the selection is out, the read it waits for included
  const isWritingSelection = useIsWritingSelection()

  // The subjects and the board on screen as they stand
  const asTheyStand = { subjects, board: activeBoard }

  // The subjects and the board as the threads were last laid out afresh, taken afresh too as the reader's writes to
  // the selection settle
  const [laidOut] = useKeyedState(`${layoutKey}:${isWritingSelection}`, asTheyStand)

  // The subjects and the board the threads are let through against: as last laid out, so a change another reviewer
  // makes to the selection waits behind the news, as a new comment does; as they stand while the reader's own write is
  // out, so that shows at once
  const against = isWritingSelection ? asTheyStand : laidOut

  // The board the threads are let through against: the one laid out against while they follow it, else the board on
  // screen, which then moves only the counts beside the State answers
  const matchedBoard = followedBoard === null ? activeBoard : against.board

  // The discussions as the threads were last laid out afresh, whose comments a search reads as they said then
  const [laidOutDiscussions] = useKeyedState(layoutKey, shown?.discussions ?? [])

  // The threads as shown, run through the filters against the subjects, the board and the comments they are let
  // through against, with the counts; null until the first read has landed
  const matches =
    shown === null
      ? null
      : matchDiscussions(
          underSubjectsOf(shown.discussions, against.subjects),
          filter,
          matchedBoard,
          categories,
          laidOutDiscussions
        )

  // The threads let through, sorted against the board they were laid out with, so a new thread lands next to the
  // neighbours the list shows; none until the first read has landed
  const ordered =
    matches === null
      ? []
      : threadsInOrder(matches.shown, order, against.board, filter.categories, selection.boards)

  // The threads let through, held where they stood as they were last laid out afresh
  const held = useFirstSeenOrder({
    items: ordered,
    keyOf: threadKeyOf,
    resetKey: layoutKey,
    newcomerPlace: NEWCOMER_PLACES[order],
  })

  // The held threads, each under its subject as the selection now holds it; null until the first read has landed
  const threads = shown === null ? null : underSubjectsOf(held, subjects)

  // Whether the latest read would change the threads let through as last told, forgotten each time the threads are
  // laid out afresh
  const [hadNews, setHadNews] = useKeyedState(layoutKey, false)

  // The threads the latest read would let through against the selection as it now stands, a thread laid out before
  // found by what it said then, where what the read says can be told
  const latest =
    shown === null || shown.latest === null
      ? null
      : matchDiscussions(shown.latest, filter, activeBoard, categories, laidOutDiscussions).shown

  // Whether showing the latest read would change the threads let through: never before the first read has landed,
  // and as last told while the latest read can't be told
  const hasNews =
    threads === null ? false : latest === null ? hadNews : !showTheSame(threads, latest)

  // Whether there is news, kept for while the latest read can't be told
  if (hasNews !== hadNews) setHadNews(hasNews)

  // A function which shows what the latest read brings to the threads let through, into the discussions of those
  // threads as they stand and as the read would leave them, or into every discussion while the read can't be told,
  // telling the server what the threads then show, laid out afresh, was seen
  const showNews = () =>
    showLatest({
      targets:
        latest === null
          ? null
          : [...held, ...latest].map((thread) => discussionTargetOf(thread.subject)),
      seen: (discussions, readerId) =>
        poolDiscussionPartsOf(discussions, filter, activeBoard, categories, readerId),
    })

  // The threads kept out, none until the first read has landed
  const hidden = matches?.hidden ?? []

  // The filters and the order. Each change shows everything waiting and lays the threads out again
  const { filters, order: orderChoice } = usePoolThreadFilters({
    threads,
    hidden,
    filterKey,
    showLatest,
  })

  // The key the list is redrawn under: the filter without the search, and the order
  const listKey = `${poolFilterKey({ ...filter, query: '' }, followedBoard)}:${orderKey}`

  // The threads let through and those kept out, what waits to be shown, the counts, the filters, the order, the
  // list's key, and the state of the read
  return {
    threads,
    hidden,
    counts: matches,
    uiState,
    retry,
    hasNews,
    showNews,
    filters,
    order: orderChoice,
    listKey,
  }
}
