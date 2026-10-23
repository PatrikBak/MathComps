'use client'

import { useAuth } from '@clerk/nextjs'
import { type QueryKey, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { useCallback, useMemo } from 'react'

import type { CommentNewness } from '@/components/features/comments/model/comment-newness'
import { useApiQuery } from '@/hooks/use-api-query'
import { useOptimisticMutation } from '@/hooks/use-optimistic-mutation'
import { cachePolicy, dropReadsInFlight } from '@/lib/query-config'

import {
  hasNewsIn,
  markKeyOf,
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
 * What {@link useSeenMarks} hands back: how far the reader has seen each of the selection's discussions, and the way
 * to mark some seen.
 */
export type UseSeenMarksResult = {
  /** How far the reader has seen a discussion; untracked, so nothing in it new, until the marks are read. */
  newnessOf: (target: DiscussionTarget) => CommentNewness
  /** Whether somebody else posted in a discussion after what the reader has seen; false until the marks are read. */
  hasNews: (target: DiscussionTarget) => boolean
  /**
   * Tells the server some discussions were seen as a view shows them, each up to the newest comment it shows that can
   * be new, so a comment still waiting to be shown stays new. A discussion showing none is left as it is.
   */
  markSeen: (shown: readonly ShownDiscussion[]) => void
}

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
 * How far the reader has seen each of the selection's discussions, read every little while in view, and the way to
 * mark some seen. A mark the server takes goes into the cached marks at once, so what it covers stops showing as new
 * without waiting for the next read.
 *
 * @returns The marks and the way to move them.
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

  // A function which tells the server some discussions were seen as a view shows them, each up to its own moment, the
  // write's failure told by the write itself
  const markSeen = useCallback(
    (shown: readonly ShownDiscussion[]) =>
      void mutateAsync(seenWriteOf(shown, readerId)).catch(() => undefined),
    [mutateAsync, readerId]
  )

  // A function which tells how far the reader has seen a discussion
  const newnessOf = useCallback(
    (target: DiscussionTarget): CommentNewness =>
      // Untracked until the marks are read, so nothing shows as new on a guess
      server === null
        ? { kind: 'untracked' }
        : // Seen up to the reader's mark, or nothing seen where the server holds none
          { kind: 'seen', seenUpTo: server.get(markKeyOf(target))?.seenUpTo ?? null },
    [server]
  )

  // A function which tells whether a discussion holds anything new to the reader
  const hasNews = useCallback(
    (target: DiscussionTarget) => server !== null && hasNewsIn(server, markKeyOf(target)),
    [server]
  )

  // The marks and the way to move them, held steady while none of it moves
  return useMemo(() => ({ newnessOf, hasNews, markSeen }), [newnessOf, hasNews, markSeen])
}
