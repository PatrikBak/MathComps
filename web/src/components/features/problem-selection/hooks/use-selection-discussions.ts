'use client'

import { useAuth } from '@clerk/nextjs'
import { usePrevious } from '@mantine/hooks'
import { queryOptions, useIsMutating, useQueries, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useState } from 'react'

import {
  commentMutationKeys,
  commentQueryKeys,
} from '@/components/features/comments/hooks/comment-query-keys'
import type { CommentDto } from '@/components/features/comments/services/comment-api-types'
import { getComments } from '@/components/features/comments/services/comment-service'
import { useApi } from '@/hooks/use-api'
import { apiQueryOptions, useApiQuery } from '@/hooks/use-api-query'
import { cachePolicy } from '@/lib/query-config'
import type { QueryUiState } from '@/lib/query-ui-state'

import {
  type DiscussedSubject,
  type Discussion,
  discussionTargetOf,
} from '../model/selection-discussions'
import { getDiscussions } from '../services/selection-service'
import {
  discussionsQueryKey,
  parkDiscussions,
  parkReactionsAndDeletions,
  readDiscussions,
  threadsAfterParking,
} from './discussion-cache'
import { useSelectionOrganization } from './selection-organization'

/**
 * Options for {@link useSelectionDiscussions}.
 */
type UseSelectionDiscussionsOptions = {
  /** The subjects whose discussions are read. */
  subjects: readonly DiscussedSubject[]
}

/**
 * The discussions as a stay shows them.
 */
type ShownDiscussions = {
  /** Each subject's discussion, in the subjects' order. */
  discussions: Discussion<DiscussedSubject>[]
  /**
   * How many times the stay has shown the discussions as a read found them: once as its first read lands, then on
   * asking. None while it shows what an earlier stay left.
   */
  showings: number
  /**
   * Each subject's discussion as showing the latest read would leave it, in the subjects' order. Null until the stay
   * has shown a read of its own, and while what the latest read says can't be told from what the reader wrote: while
   * a write to a comment is out, and until a read set off once the reader's writes all settled lands.
   */
  latest: Discussion<DiscussedSubject>[] | null
}

/**
 * What {@link useSelectionDiscussions} hands back.
 */
export type UseSelectionDiscussionsResult = {
  /** The discussions as shown; null until a read has landed, in this stay or an earlier one. */
  shown: ShownDiscussions | null
  /** How far the read has got. */
  uiState: QueryUiState
  /** Reads the discussions again after the read gave up. */
  retry: () => void
  /** Shows the discussions as the latest read found them. */
  showNews: () => void
}

/**
 * The discussions of the subjects asked for, read for everything the selection holds in one go and again every
 * little while in view. Each discussion is read back from its own comment thread's cache, so a write to a comment
 * shows the moment it does on the subject's own page, and that page opens on it at once.
 *
 * A stay runs from the discussions being asked for until they are let go, time spent hidden included. It opens on
 * what an earlier stay left in the threads, and its first read goes into them as it lands, so the discussions show
 * at once and are shown afresh a moment later. Every later read waits until the reader asks for
 * it, so nothing new anybody else says moves what is on screen. The reader's own writes show at once, and so do
 * others' reactions and deletions, which say nothing new. Once the reader's writes have all settled, the discussions
 * are read again at once: a read out while one was made can't tell what others said in its thread from what the
 * reader did, so what is new waits to be told until that read lands.
 *
 * @param options - {@link UseSelectionDiscussionsOptions}.
 *
 * @returns The discussions, what waits to be shown, and the state of the read.
 */
export function useSelectionDiscussions({
  subjects,
}: UseSelectionDiscussionsOptions): UseSelectionDiscussionsResult {
  // The cache the comment threads are held in
  const queryClient = useQueryClient()

  // The organization whose selection holds the discussions
  const organization = useSelectionOrganization()

  // Who is reading, once sign-in has settled
  const { userId, isLoaded } = useAuth()

  // The reader, nobody until sign-in has settled or while nobody is signed in
  const readerId = isLoaded ? (userId ?? null) : null

  // How many times the stay has shown the discussions as a read found them, none until its first read lands
  const [showings, setShowings] = useState(0)

  // Every discussion the selection holds, as the latest read found it
  const { data, uiState, retry } = useApiQuery({
    queryKey: discussionsQueryKey(organization, readerId),
    fetch: async (apiCall) => {
      // The discussions, with what stood as the read set off
      const result = await readDiscussions(queryClient, () => getDiscussions(apiCall, organization))

      // The stay's first read shown as it lands
      if (result.success && showings === 0) {
        // The read in the threads
        parkDiscussions(queryClient, readerId, result.data)

        // The showing counted
        setShowings((count) => count + 1)
      } else if (result.success) {
        // A later read's reactions and deletions shown as it lands, anything new said in it waiting to be asked for
        parkReactionsAndDeletions(queryClient, readerId, result.data)
      }

      // The read
      return result
    },
    // The discussions are never public, so the read waits for an account
    requireAuth: true,
    // Other reviewers write too, so the discussions keep up with them while they are on screen
    cachePolicy: cachePolicy.live,
    // Kept between stays, as the threads are, so a stay opens on them at once however long since the last
    gcTime: Infinity,
    // Read afresh as every stay starts, however recent an earlier stay's answer, so its first read sets off at once
    refetchOnMount: 'always',
  })

  // Each subject's comment thread
  const targets = subjects.map(discussionTargetOf)

  // The API client
  const api = useApi({ requireAuth: true })

  // Each subject's thread as its cache holds it, which the discussions read fills
  const threads = useQueries({
    queries: targets.map((target) =>
      queryOptions({
        // The thread's own read, which its page runs
        ...apiQueryOptions<CommentDto[]>(api, {
          queryKey: commentQueryKeys.target(target, readerId),
          fetch: (apiCall) => getComments(apiCall, target),
          // The tier that reads only when asked
          cachePolicy: cachePolicy.onDemand,
        }),
        // Never read from here, not even when told its copy is out of date, as after a failed write to it, so nothing
        // anybody else said comes in before the reader asks: the discussions read again once the reader's writes
        // settle sets the thread right
        enabled: false,
        // Kept while a stay sits hidden behind something else, since nothing reads a dropped thread back in mid-stay
        gcTime: Infinity,
      })
    ),
  })

  // How many writes to comments are out, whose answers the threads may not show yet
  const writesOut = useIsMutating({ mutationKey: commentMutationKeys.all })

  // How many writes to comments were out as the discussions last showed
  const previousWritesOut = usePrevious(writesOut) ?? 0

  // When the reader's writes last all settled, in milliseconds
  const [settledAt, setSettledAt] = useState(Number.NEGATIVE_INFINITY)

  // The discussions read again once the reader's writes have all settled
  useEffect(() => {
    // Writes still out, or none just settled
    if (writesOut > 0 || previousWritesOut === 0) return

    // The moment a read has to set off after to tell what others said from what the reader wrote
    setSettledAt(Date.now())

    // Read again
    retry()
  }, [writesOut, previousWritesOut, retry])

  // Each thread as showing the latest read would leave it, once the stay has shown a read of its own and the latest
  // set off after every write of the reader's settled
  const after =
    showings === 0 ||
    writesOut > 0 ||
    previousWritesOut > 0 ||
    data === undefined ||
    data.startedAt < settledAt
      ? null
      : threadsAfterParking(queryClient, readerId, data, targets)

  // The discussions as shown, once a read has landed in this stay or an earlier one, nothing said where a thread
  // holds nothing, with what the latest read would make of them
  const shown =
    showings === 0 && data === undefined
      ? null
      : {
          discussions: subjects.map((subject, index) => ({
            subject,
            comments: threads[index]?.data ?? [],
          })),
          showings,
          latest:
            after === null
              ? null
              : subjects.map((subject, index) => ({ subject, comments: after[index] ?? [] })),
        }

  // A function which shows the discussions as the latest read found them
  const showNews = useCallback(() => {
    // Nothing read, nothing to show
    if (data === undefined) return

    // The latest read in the threads
    parkDiscussions(queryClient, readerId, data)

    // The showing counted
    setShowings((count) => count + 1)
  }, [data, queryClient, readerId])

  // The discussions, what waits to be shown, and the state of the read
  return { shown, uiState, retry, showNews }
}
