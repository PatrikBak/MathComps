'use client'

import { useAuth } from '@clerk/nextjs'
import { type QueryKey, useQueryClient } from '@tanstack/react-query'
import { useEffect, useEffectEvent, useId } from 'react'

import {
  commentMutationKeys,
  commentQueryKeys,
} from '@/components/features/comments/hooks/comment-query-keys'
import { assertNever } from '@/components/shared/utils/assert-never'
import { useKeyedState } from '@/hooks/use-keyed-state'
import { onceAnswerLands, oncePageShows } from '@/lib/query-config'

import { useSelectionWorkspace } from '../components/SelectionWorkspaceProvider'
import {
  discussedSubjectsOf,
  type DiscussionTarget,
  discussionTargetOf,
} from '../model/selection-discussions'
import { discussionsQueryKey, shownDiscussionsOf } from './discussion-cache'
import { useSelectionOrganization } from './selection-organization'
import type { LoadedSelection } from './use-selection-workspace-state'

/**
 * The pool's Comments tab, showing every discussion the selection holds.
 */
type PoolCommentsTab = {
  /** That it is the pool's. */
  kind: 'pool'
}

/**
 * A problem's or a paper's own Comments tab, showing its discussion.
 */
type SubjectCommentsTab = {
  /** That it is a problem's or a paper's. */
  kind: 'subject'
  /** The comment target the discussion is held under. */
  target: DiscussionTarget
}

/** A Comments tab the reader can visit. */
type CommentsTab = PoolCommentsTab | SubjectCommentsTab

/** Where a Comments tab stands: closed, open behind a page opened over it, or showing. */
type TabPresence = 'closed' | 'behind' | 'shown'

/** Whether a tab is open, by where it stands; a visit to it lasts while it is. */
const IS_OPEN: Record<TabPresence, boolean> = { closed: false, behind: true, shown: true }

/** Whether a tab shows, by where it stands; a visit to it starts as it does. */
const IS_SHOWN: Record<TabPresence, boolean> = { closed: false, behind: false, shown: true }

/** The writes to comments, which a read of what a tab shows could land over. */
const COMMENT_WRITES = { mutationKey: commentMutationKeys.all }

/**
 * What a Comments tab shows, and the read bringing it.
 */
type TabRead = {
  /** The discussions the tab shows. */
  targets: DiscussionTarget[]
  /** Where the read bringing the tab what it shows is cached. */
  queryKey: QueryKey
}

/**
 * Options for {@link useDiscussionVisit}.
 */
type UseDiscussionVisitOptions = {
  /** The tab visited. */
  tab: CommentsTab
  /** Where the tab stands. */
  presence: TabPresence
}

/**
 * A visit to a Comments tab: from the open tab first showing, once the reader's marks are read, until it closes. Time
 * spent hidden behind a page opened from the tab counts as part of the visit, and a tab opened hidden starts none until
 * it shows.
 *
 * As the visit starts it keeps the marks of the discussions the tab shows as they stand. It then waits for an answer of
 * the tab's own read to land: the one out as it starts, or one it sets off, however many reads that takes. Once that
 * answer has landed and the page is on screen, it tells the server the discussions were seen as the tab then shows
 * them, so that is not new on the next visit. A tab opening on what an earlier read left waits for its own, so a
 * comment that read brings counts as seen only once it shows. What arrives after stays new for the next visit too.
 *
 * @param options - The tab visited, and where it stands.
 */
export function useDiscussionVisit({ tab, presence }: UseDiscussionVisitOptions): void {
  // The selection once it has arrived, and the ways a visit keeps the reader's marks and tells the server what it saw,
  // once the marks are read
  const {
    selection,
    seenMarks: { visits },
  } = useSelectionWorkspace()

  // The id the visit keeps its marks under
  const visitId = useId()

  // Whether the visit has started, which it does once the open tab shows, for as long as the tab stays open
  const [hasStarted, setHasStarted] = useKeyedState(IS_OPEN[presence], false)

  // Started as the open tab shows
  if (IS_SHOWN[presence] && !hasStarted) setHasStarted(true)

  // The organization whose selection holds the discussions
  const organization = useSelectionOrganization()

  // Who is reading, once sign-in has settled
  const { userId, isLoaded: isSignInLoaded } = useAuth()

  // The reader, nobody until sign-in has settled or while nobody is signed in
  const readerId = isSignInLoaded ? (userId ?? null) : null

  // A function which reads what the tab shows, and where the read bringing it is cached
  const tabRead = useEffectEvent(() => tabReadOf(tab, selection, organization, readerId))

  // The cache the tab's discussions are held in
  const queryClient = useQueryClient()

  // A function which tells the server the discussions the tab shows were seen as it shows them, which is as the
  // reader's copies of their threads hold them
  const see = useEffectEvent(() =>
    visits?.tellSeen(shownDiscussionsOf(queryClient, readerId, tabRead().targets))
  )

  // The visit, from its start with the marks read until the tab closes
  useEffect(() => {
    // Not started, or the marks not read yet
    if (!hasStarted || visits === null) return undefined

    // The marks kept as they stand
    visits.keep(visitId, tabRead().targets)

    // A function which stops the wait for the page to show what the tab's read brought, doing nothing until that wait
    // starts
    let stopWaitingForPage = () => {}

    // What the tab shows seen once an answer of its read has landed and the page is on screen
    const stopWaitingForAnswer = onceAnswerLands(
      queryClient,
      tabRead().queryKey,
      COMMENT_WRITES,
      () => {
        stopWaitingForPage = oncePageShows(() => see())
      }
    )

    // The visit ended
    return () => {
      // Nothing seen after it
      stopWaitingForAnswer()
      stopWaitingForPage()

      // Its kept marks let go of
      visits.leave(visitId)
    }
  }, [hasStarted, visits, visitId, queryClient])
}

/**
 * What a Comments tab shows, and the read bringing it: every discussion the selection holds and the read of them all
 * for the pool's tab, one discussion and its thread's read for a problem's or a paper's.
 *
 * @param tab - The tab.
 * @param selection - The selection, null until it has arrived.
 * @param organization - The slug of the organization whose selection holds the discussions.
 * @param readerId - Who is reading; null until sign-in has settled, and while nobody is signed in.
 *
 * @returns The discussions and where their read is cached.
 */
function tabReadOf(
  tab: CommentsTab,
  selection: LoadedSelection | null,
  organization: string,
  readerId: string | null
): TabRead {
  // By whose tab it is
  switch (tab.kind) {
    case 'pool':
      return {
        targets: selection === null ? [] : discussedSubjectsOf(selection).map(discussionTargetOf),
        queryKey: discussionsQueryKey(organization, readerId),
      }
    case 'subject':
      return { targets: [tab.target], queryKey: commentQueryKeys.target(tab.target, readerId) }

    // Every kind is handled above
    default:
      return assertNever(tab)
  }
}
