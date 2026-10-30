import { hashKey, type QueryClient, type QueryKey } from '@tanstack/react-query'

import {
  commentMutationKeys,
  commentQueryKeys,
} from '@/components/features/comments/hooks/comment-query-keys'
import type {
  CommentDto,
  CommentTarget,
  CommentTargetType,
} from '@/components/features/comments/services/comment-api-types'
import {
  convertToCommentData,
  postsNothingNew,
} from '@/components/features/comments/utils/comment-utils'
import type { ApiResult } from '@/types/api'

import type { ShownDiscussion } from '../model/seen-marks'
import type { DiscussionTarget } from '../model/selection-discussions'
import type { SelectionDiscussions } from '../model/selection-types'

/**
 * The prefix every cached copy of a selection's discussions sits under, whichever organization's it is and whoever
 * it was read as.
 */
const DISCUSSIONS_QUERY_KEY = ['problem-selection-discussions'] as const

/**
 * One answer of the read of the selection's discussions, with what stood as the read set off, which decides which
 * comment threads may take it.
 */
export type DiscussionsRead = {
  /** The discussions. */
  discussions: SelectionDiscussions
  /** When the read set off, in milliseconds. */
  startedAt: number
  /** Whether no write to a comment was out as the read set off. */
  wasQuiet: boolean
}

/**
 * One comment thread an answer can be parked in.
 */
type ParkableThread = {
  /** Where the reader's copy of the thread is cached. */
  queryKey: QueryKey
  /** The thread as the answer found it. */
  comments: CommentDto[]
}

/**
 * The key a reader's copy of an organization's discussions is cached under. It names the reader, so another account
 * signing in on the same page is never handed the first one's answer. It sits outside the prefix a write to the
 * selection refreshes, since no such write says anything in a discussion.
 *
 * @param organization - The slug of the organization whose selection holds the discussions.
 * @param readerId - Who is reading; null until sign-in has settled, and while nobody is signed in.
 *
 * @returns The key.
 */
export function discussionsQueryKey(organization: string, readerId: string | null): QueryKey {
  // The discussions, per organization and reader
  return [...DISCUSSIONS_QUERY_KEY, organization, readerId] as const
}

/**
 * Reads the selection's discussions, noting what stood as the read set off.
 *
 * @param queryClient - The cache the writes to comments are counted in.
 * @param read - Reads the discussions.
 *
 * @returns The answer with what stood as it set off, or what the read failed with.
 */
export async function readDiscussions(
  queryClient: QueryClient,
  read: () => Promise<ApiResult<SelectionDiscussions>>
): Promise<ApiResult<DiscussionsRead>> {
  // Whether no write to a comment was out as the read set off
  const wasQuiet = queryClient.isMutating({ mutationKey: commentMutationKeys.all }) === 0

  // When the read set off
  const startedAt = Date.now()

  // The discussions
  const result = await read()

  // The answer with what stood as it set off, or the failure as it came
  return result.success
    ? { success: true, data: { discussions: result.data, startedAt, wasQuiet } }
    : result
}

/**
 * Parks an answer of the read in the comment threads it may go into.
 *
 * @param queryClient - The cache the threads are held in.
 * @param readerId - Who is reading, whose threads they are.
 * @param read - The answer, with what stood as it set off.
 */
export function parkDiscussions(
  queryClient: QueryClient,
  readerId: string | null,
  read: DiscussionsRead
): void {
  // Each thread the answer may go into, as the answer found it
  parkableThreads(queryClient, readerId, read).forEach(({ queryKey, comments }) =>
    queryClient.setQueryData<CommentDto[]>(queryKey, comments)
  )
}

/**
 * Parks an answer of the read in the threads it may go into that it changes only in what was edited, who reacted how
 * and what was deleted, so an edit, a reaction or a deletion shows as it comes. A thread the answer posts anything new
 * in is left as it is, and so is one nothing holds yet.
 *
 * @param queryClient - The cache the threads are held in.
 * @param readerId - Who is reading, whose threads they are.
 * @param read - The answer, with what stood as it set off.
 */
export function parkReactionsEditsAndDeletions(
  queryClient: QueryClient,
  readerId: string | null,
  read: DiscussionsRead
): void {
  // Each thread the answer may go into that posts nothing new over the held copy, as the answer found it
  parkableThreads(queryClient, readerId, read)
    .filter(({ queryKey, comments }) => {
      // The reader's copy, absent while nothing holds it
      const held = queryClient.getQueryData<CommentDto[]>(queryKey)

      // Held, and the answer posting nothing new over it
      return held !== undefined && postsNothingNew(held, comments)
    })
    .forEach(({ queryKey, comments }) => queryClient.setQueryData<CommentDto[]>(queryKey, comments))
}

/**
 * Each thread as it would read once an answer is parked: the answer's copy where parking would write it, the
 * reader's own copy everywhere else, and no comments where nothing holds the thread and nobody has said
 * anything in it.
 *
 * @param queryClient - The cache the threads are held in.
 * @param readerId - Who is reading, whose threads they are.
 * @param read - The answer, with what stood as it set off.
 * @param targets - The threads asked about.
 *
 * @returns Each thread's comments, in the targets' order.
 */
export function threadsAfterParking(
  queryClient: QueryClient,
  readerId: string | null,
  read: DiscussionsRead,
  targets: readonly CommentTarget[]
): CommentDto[][] {
  // What parking would write, by where the thread is cached
  const parked = new Map(
    parkableThreads(queryClient, readerId, read).map(({ queryKey, comments }) => [
      hashKey(queryKey),
      comments,
    ])
  )

  // Each thread as parking would leave it
  return targets.map((target) => {
    // Where the reader's copy of the thread is cached
    const queryKey = commentQueryKeys.target(target, readerId)

    // What parking would write there, or else the reader's copy, or else nothing
    return parked.get(hashKey(queryKey)) ?? queryClient.getQueryData<CommentDto[]>(queryKey) ?? []
  })
}

/**
 * Each discussion as the reader's copy of its thread holds it, and no comments where nothing holds the thread.
 *
 * @param queryClient - The cache the threads are held in.
 * @param readerId - Who is reading, whose threads they are.
 * @param targets - The discussions asked about.
 *
 * @returns Each discussion with its comments read for the reader, in the targets' order.
 */
export function shownDiscussionsOf(
  queryClient: QueryClient,
  readerId: string | null,
  targets: readonly DiscussionTarget[]
): ShownDiscussion[] {
  // Each discussion with the reader's copy of its thread
  return targets.map((target) => ({
    target,
    comments: (
      queryClient.getQueryData<CommentDto[]>(commentQueryKeys.target(target, readerId)) ?? []
    ).map((comment) => convertToCommentData(comment, readerId)),
  }))
}

/**
 * The threads an answer may go into. A thread nothing holds yet always takes it. A thread already held takes
 * nothing a write may have overtaken: while a write was out as the read set off, or is out now, the answer may
 * predate it, and a thread written since the read set off already holds something newer. A discussion with nothing
 * said in it is not in the answer and is left as it is.
 *
 * @param queryClient - The cache the threads are held in.
 * @param readerId - Who is reading, whose threads they are.
 * @param read - The answer, with what stood as it set off.
 *
 * @returns The threads, each as the answer found it.
 */
function parkableThreads(
  queryClient: QueryClient,
  readerId: string | null,
  { discussions, startedAt, wasQuiet }: DiscussionsRead
): ParkableThread[] {
  // Whether a write to a comment may have overtaken the answer
  const mayBeOvertaken =
    !wasQuiet || queryClient.isMutating({ mutationKey: commentMutationKeys.all }) > 0

  // Every thread of the answer, the problems' and then the papers'
  const threads: ParkableThread[] = [
    ...threadsOf('Proposal', discussions.proposals, readerId),
    ...threadsOf('SelectionPaper', discussions.papers, readerId),
  ]

  // The threads the answer may go into
  return threads.filter(({ queryKey }) => {
    // How the reader's copy stands, absent while the cache knows no such thread
    const held = queryClient.getQueryState(queryKey)

    // A thread nothing holds, or one held from before the read that no write may have overtaken
    return held?.data === undefined || (!mayBeOvertaken && held.dataUpdatedAt < startedAt)
  })
}

/**
 * One kind of thread's discussions, each with where the reader's copy of it is cached.
 *
 * @param targetType - The kind of thread.
 * @param discussions - The discussions, by the id of what each hangs off.
 * @param readerId - Who is reading, whose threads they are.
 *
 * @returns The threads.
 */
function threadsOf(
  targetType: CommentTargetType,
  discussions: Record<string, CommentDto[]>,
  readerId: string | null
): ParkableThread[] {
  // Each discussion as the thread it is
  return Object.entries(discussions).map(([targetId, comments]) => ({
    queryKey: commentQueryKeys.target({ targetType, targetId }, readerId),
    comments,
  }))
}
