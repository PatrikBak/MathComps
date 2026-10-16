'use client'

import { useFirstSeenOrder } from '@/hooks/use-first-seen-order'
import { useKeyedState } from '@/hooks/use-keyed-state'

import { useLoadedSelection } from '../components/SelectionWorkspaceProvider'
import {
  type DiscussedSubject,
  type DiscussionThread,
  showTheSame,
  threadKeyOf,
  threadsByActivity,
} from '../model/selection-discussions'
import {
  useSelectionDiscussions,
  type UseSelectionDiscussionsResult,
} from './use-selection-discussions'

/**
 * What {@link usePoolThreads} hands back.
 */
type UsePoolThreadsResult = Pick<
  UseSelectionDiscussionsResult,
  'uiState' | 'retry' | 'showNews'
> & {
  /** Every thread, in the order they are held in; null until the first read has landed. */
  threads: DiscussionThread<DiscussedSubject>[] | null
  /**
   * Whether showing the latest read would change the threads, holding its last answer while that can't be told.
   */
  hasNews: boolean
}

/**
 * Every thread of the discussions of what the selection holds: each problem's, set aside or taken by a round alike,
 * and each paper's. The pool's filters narrow its problems and leave the discussions whole.
 *
 * The threads come newest activity first each time the discussions are shown afresh, and hold their places between,
 * a thread started since going on top, so nothing moves under the reader. What a later read brings counts as news
 * where it would change them, and stays news through the reader's own writes, which leave it untold for a moment.
 *
 * @returns The threads, what waits to be shown, and the state of the read.
 */
export function usePoolThreads(): UsePoolThreadsResult {
  // Every problem, and every paper with the board it is on
  const { proposalsById, papersById } = useLoadedSelection()

  // Every problem and every paper
  const subjects: DiscussedSubject[] = [
    ...[...proposalsById.values()].map((proposal) => ({ kind: 'proposal' as const, proposal })),
    ...[...papersById.values()].map((place) => ({ kind: 'paper' as const, ...place })),
  ]

  // The subjects' discussions, as shown and as the latest read would leave them, and how far the read has got
  const { shown, uiState, retry, showNews } = useSelectionDiscussions({ subjects })

  // Every thread, held where it stood as the discussions were last shown afresh
  const held = useFirstSeenOrder({
    items: shown === null ? [] : threadsByActivity(shown.discussions),
    keyOf: threadKeyOf,
    resetKey: shown?.showings ?? 0,
  })

  // The held threads, null until the first read has landed
  const threads = shown === null ? null : held

  // Whether the latest read would change the threads as last told, forgotten each time the discussions
  // are shown afresh
  const [hadNews, setHadNews] = useKeyedState(shown?.showings ?? 0, false)

  // The latest read, where what it says can be told
  const latest = shown?.latest ?? null

  // Whether showing the latest read would change the threads: never before the first read has landed, and as last
  // told while the latest read can't be told
  const hasNews =
    threads === null
      ? false
      : latest === null
        ? hadNews
        : !showTheSame(threads, threadsByActivity(latest))

  // Whether there is news, kept for while the latest read can't be told
  if (hasNews !== hadNews) setHadNews(hasNews)

  // The threads, what waits to be shown, and the state of the read
  return { threads, uiState, retry, hasNews, showNews }
}
