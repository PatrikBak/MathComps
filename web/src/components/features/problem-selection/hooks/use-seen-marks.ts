'use client'

import { useAuth } from '@clerk/nextjs'
import { type QueryKey, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { useCallback, useMemo, useState } from 'react'

import type { CommentNewness } from '@/components/features/comments/model/comment-newness'
import { useApiQuery } from '@/hooks/use-api-query'
import { useOptimisticMutation } from '@/hooks/use-optimistic-mutation'
import { cachePolicy, dropReadsInFlight } from '@/lib/query-config'

import {
  advanceMarks,
  hasNewsIn,
  holdMarks,
  type KeptMarks,
  markKeyOf,
  releaseMarks,
  seenUpToOf,
  seenWriteOf,
  serverMarksOf,
  type ShownDiscussion,
  withSeenUpTo,
} from '../model/seen-marks'
import type { DiscussionTarget } from '../model/selection-discussions'
import type { DiscussionsSeenUpTo, SelectionDiscussionsSeen } from '../model/selection-types'
import { getDiscussionsSeen, markDiscussionsSeen } from '../services/selection-service'
import { useSelectionOrganization } from './selection-organization'

/**
 * The ways a visit to a Comments tab keeps the marks of the discussions it shows and tells the server what it saw.
 */
type VisitMarks = {
  /**
   * Keeps the marks of the discussions a visit shows as they stand, every write still on its way counted in, under the
   * visit's id.
   */
  keep: (visitId: string, targets: readonly DiscussionTarget[]) => void
  /**
   * Tells the server some discussions were seen as the visit's tab shows them, leaving the kept marks where they are.
   */
  tellSeen: (shown: readonly ShownDiscussion[]) => void
  /** Lets go of the marks a visit kept as it ends. */
  leave: (visitId: string) => void
}

/**
 * What {@link useSeenMarks} hands back: how far the reader has seen each of the selection's discussions as the page
 * reads it, the ways a visit to a Comments tab keeps its marks, and the way to mark some seen at the reader's asking.
 */
export type UseSeenMarksResult = {
  /**
   * How far the reader has seen a discussion, as a visit keeps the mark while one does and as the server holds it
   * otherwise; untracked, so nothing in it new, until the marks are read.
   */
  newnessOf: (target: DiscussionTarget) => CommentNewness
  /**
   * Whether somebody else posted in a discussion after the reader's mark as the server holds it, whatever mark a visit
   * keeps; false until the marks are read.
   */
  hasNews: (target: DiscussionTarget) => boolean
  /** The ways a visit keeps its marks and tells what it saw; null until the server's marks are read. */
  visits: VisitMarks | null
  /**
   * Tells the server some discussions were seen as a view shows them, and moves their kept marks on once the server has
   * taken the write, so what the view shows stops being new.
   */
  markSeen: (shown: readonly ShownDiscussion[]) => void
}

/** The key every write telling the server what was seen is filed under. */
const SEEN_WRITE_KEY = ['mark-discussions-seen'] as const

/**
 * The key the reader's marks on an organization's discussions are cached under. It names the reader, and sits
 * outside the prefix a write to the selection refreshes, since no such write moves a mark.
 *
 * @param organization - The slug of the organization whose selection holds the discussions.
 * @param readerId - Who is reading; null until sign-in has settled, and while nobody is signed in.
 *
 * @returns The key.
 */
function seenQueryKey(organization: string, readerId: string | null): QueryKey {
  // The marks, per organization and reader
  return ['problem-selection-discussions-seen', organization, readerId] as const
}

/**
 * How far the reader has seen each of the selection's discussions, read every little while in view, and the ways to
 * mark some seen. A mark the server takes goes into the cached marks at once. A visit to a Comments tab keeps the marks
 * of the discussions it shows as they stood when it started, so what was new then stays new while it lasts, until the
 * reader marks it seen. Whether a discussion holds news reads the server's mark alone, so the news goes out once a
 * visit's write lands, while the comments the visit shows stay new.
 *
 * Each write marks what a view shows as {@link seenWriteOf} builds it, and one naming no discussion is never sent.
 *
 * @returns The marks and the ways to keep and move them.
 */
export function useSeenMarks(): UseSeenMarksResult {
  // The organization whose selection holds the discussions
  const organization = useSelectionOrganization()

  // Who is reading, once sign-in has settled
  const { userId, isLoaded: isSignInLoaded } = useAuth()

  // The reader, nobody until sign-in has settled or while nobody is signed in
  const readerId = isSignInLoaded ? (userId ?? null) : null

  // Where the reader's marks are cached
  const queryKey = seenQueryKey(organization, readerId)

  // How far the reader has seen each discussion, as the server holds it
  const { data } = useApiQuery<SelectionDiscussionsSeen>({
    queryKey,
    fetch: (apiCall) => getDiscussionsSeen(apiCall, organization),
    // The discussions are never public, so the read waits for an account
    requireAuth: true,
    // Other reviewers post too, so the marks keep up with them while they are on screen
    cachePolicy: cachePolicy.live,
  })

  // The server's marks by the discussion's key, rebuilt only when the cached marks change
  const server = useMemo(() => (data === undefined ? null : serverMarksOf(data)), [data])

  // Selection discussion copy
  const t = useTranslations('problemSelection.comments')

  // The cache the marks are held in
  const queryClient = useQueryClient()

  // The write telling the server some discussions were seen, which puts the moments the server marked into the cached
  // marks
  const { mutateAsync } = useOptimisticMutation<DiscussionsSeenUpTo, DiscussionsSeenUpTo, void>({
    apiFn: (apiCall, write) => markDiscussionsSeen(apiCall, organization, write),
    mutationKey: SEEN_WRITE_KEY,
    onSuccess: (marked) => {
      // Every read still out may predate the write, so it is dropped before the moments go in
      dropReadsInFlight(queryClient, queryKey)

      // Each discussion the server marked, seen up to the moment it marked
      queryClient.setQueryData<SelectionDiscussionsSeen>(queryKey, (current) =>
        current === undefined ? current : withSeenUpTo(current, marked)
      )
    },
    authReason: t('markSeenFailed'),
    errorMessage: t('markSeenFailed'),
  })

  // A function which tells the server some discussions were seen as a view shows them, each up to its own moment,
  // resolving to what the server marked, or to nothing where nothing was sent or the write failed, a failure the write
  // reports itself
  const send = useCallback(
    async (shown: readonly ShownDiscussion[]) => {
      // Each discussion the view shows, up to the newest comment in it that can be new
      const moments = seenWriteOf(shown, readerId)

      // Nothing to tell where the view shows no comment that can be new
      if (Object.keys(moments.proposals).length + Object.keys(moments.papers).length === 0) {
        return undefined
      }

      // Sent, resolving to what the server marked, or to nothing where the write failed
      return mutateAsync(moments).catch(() => undefined)
    },
    [mutateAsync, readerId]
  )

  // The marks the visits keep
  const [kept, setKept] = useState<KeptMarks>(() => new Map())

  // A function which keeps the marks of the discussions a visit shows as the cache holds them, every write still on its
  // way counted in
  const keep = useCallback(
    (visitId: string, targets: readonly DiscussionTarget[]) => {
      // The marks as the cache holds them now
      const cached = queryClient.getQueryData<SelectionDiscussionsSeen>(
        seenQueryKey(organization, readerId)
      )

      // Nothing to keep while the marks are not read
      if (cached === undefined) return

      // The moments every write still on its way tells, seen by the reader before the visit started
      const pending = queryClient
        .getMutationCache()
        .findAll({ mutationKey: SEEN_WRITE_KEY, status: 'pending' })
        .flatMap(({ state }) =>
          state.variables === undefined ? [] : [state.variables as DiscussionsSeenUpTo]
        )

      // Kept as they stand once those writes land
      setKept((previous) =>
        holdMarks(
          previous,
          visitId,
          targets.map((target) => markKeyOf(target)),
          serverMarksOf(pending.reduce((marks, moments) => withSeenUpTo(marks, moments), cached))
        )
      )
    },
    [queryClient, organization, readerId]
  )

  // A function which tells the server some discussions were seen as a visit's tab shows them
  const tellSeen = useCallback((shown: readonly ShownDiscussion[]) => void send(shown), [send])

  // A function which lets go of the marks a visit kept
  const leave = useCallback(
    (visitId: string) => setKept((previous) => releaseMarks(previous, visitId)),
    []
  )

  // A function which tells the server some discussions were seen, and moves their kept marks on once the server has
  // taken the write
  const markSeen = useCallback(
    (shown: readonly ShownDiscussion[]) =>
      void send(shown).then((marked) => {
        // The kept marks moved on to what the server marked, where it took the write
        if (marked !== undefined) setKept((previous) => advanceMarks(previous, marked))
      }),
    [send]
  )

  // A function which tells how far the reader has seen a discussion
  const newnessOf = useCallback(
    (target: DiscussionTarget): CommentNewness =>
      // Untracked until the marks are read, so nothing shows as new on a guess
      server === null
        ? { kind: 'untracked' }
        : // Seen up to the mark a visit keeps, else the server's, or nothing seen where that mark is empty
          { kind: 'seen', seenUpTo: seenUpToOf(kept, server, markKeyOf(target)) },
    [kept, server]
  )

  // A function which tells whether a discussion holds anything new to the reader, as the server holds their mark
  const hasNews = useCallback(
    (target: DiscussionTarget) => server !== null && hasNewsIn(server, markKeyOf(target)),
    [server]
  )

  // Whether the server's marks have been read
  const isLoaded = server !== null

  // The ways a visit keeps its marks and tells what it saw, once the marks are read
  const visits = useMemo(
    () => (isLoaded ? { keep, tellSeen, leave } : null),
    [isLoaded, keep, tellSeen, leave]
  )

  // The marks and the ways to keep and move them, held steady while none of it moves
  return useMemo(
    () => ({ newnessOf, hasNews, visits, markSeen }),
    [newnessOf, hasNews, visits, markSeen]
  )
}
