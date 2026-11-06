'use client'

import { useFirstSeenOrder } from '@/hooks/use-first-seen-order'
import { useKeyedState } from '@/hooks/use-keyed-state'

import { useLoadedSelection, useSelectionWorkspace } from '../components/SelectionWorkspaceProvider'
import {
  followsBoard,
  matchDiscussions,
  type PoolCounts,
  poolFilterKey,
} from '../model/pool-filters'
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
  /**
   * The key the list of threads is drawn afresh under: each change to the filters but the search and, while the
   * threads follow it, to the board on screen. A search keeps the list, so typing never redraws it from nothing.
   */
  listKey: string
}

/**
 * The threads of the discussions of what the selection holds that the pool's filters let through: each problem's,
 * taken by a round or not, and each paper's, as {@link matchDiscussions} reads them.
 *
 * The threads come newest activity first each time they are laid out afresh, and hold their places between, a thread
 * started since going on top, so nothing moves under the reader. They are laid out afresh as the discussions are shown
 * afresh, as the filters change, and as another board goes on screen while a State answer on or off the board is
 * picked. They are let through against the selection and the discussions as they stood then, so between layouts an
 * edit or a deletion never moves a thread in or out under a search. What a later read brings counts as news where it
 * would change the threads the filters let through, and so does a change another reviewer makes to the selection, a
 * problem set aside or placed on the board among them. The reader's own writes to the selection show at once. News
 * stays news through the reader's own writes to comments, which leave it untold for a moment. Asking for it takes it
 * into the discussions of the threads let through and of those the read would let through, or into every discussion
 * while the read can't be told, lays the threads out against the selection as it now stands, and tells the server what
 * they then show was seen. The filters handed back work as {@link usePoolThreadFilters} tells.
 *
 * @returns The threads let through and those kept out, what waits to be shown, the counts, the filters, the list's
 * key, and the state of the read.
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

  // What the threads are narrowed to
  const { filter } = useSelectionWorkspace().poolFilters

  // The board on screen while the State answer picked follows it; none while what the filters let through doesn't
  // hang on the board
  const followedBoard = followsBoard(filter.standing) ? activeBoard : null

  // The key of what the threads are narrowed to: the filter, with the board while they follow it
  const filterKey = poolFilterKey(filter, followedBoard)

  // The key the threads are laid out afresh under: each showing, and each change to what they are narrowed to
  const layoutKey = `${shown?.showings ?? 0}:${filterKey}`

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

  // The threads let through, held where they stood as they were last laid out afresh
  const held = useFirstSeenOrder({
    items: matches?.shown ?? [],
    keyOf: threadKeyOf,
    resetKey: layoutKey,
    newcomerPlace: 'top',
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

  // The filters, each change laying the threads out afresh with everything waiting
  const filters = usePoolThreadFilters({ threads, hidden, filterKey, showLatest })

  // The key the list is drawn afresh under: what the threads are narrowed to, short of the search
  const listKey = poolFilterKey({ ...filter, query: '' }, followedBoard)

  // The threads let through and those kept out, what waits to be shown, the counts, the filters, the list's key,
  // and the state of the read
  return { threads, hidden, counts: matches, uiState, retry, hasNews, showNews, filters, listKey }
}
