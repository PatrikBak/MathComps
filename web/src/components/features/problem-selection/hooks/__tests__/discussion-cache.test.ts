// The discussions' read: which comment threads an answer is parked in, which it leaves to the writes that moved them
// while it was out, which take only its edits, reactions and deletions, and what each thread would read once it is
// parked.

import { type MutationKey, QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'

import {
  commentMutationKeys,
  commentQueryKeys,
} from '@/components/features/comments/hooks/comment-query-keys'
import type {
  CommentDto,
  CommentTarget,
} from '@/components/features/comments/services/comment-api-types'

import type { SelectionDiscussions } from '../../model/selection-types'
import {
  type DiscussionsRead,
  parkDiscussions,
  parkReactionsEditsAndDeletions,
  readDiscussions,
  threadsAfterParking,
} from '../discussion-cache'

/** The reader every case reads as. */
const READER = 'reader'

/** A problem's discussion. */
const PROBLEM: CommentTarget = { targetType: 'Proposal', targetId: 'problem' }

/** A paper's discussion. */
const PAPER: CommentTarget = { targetType: 'SelectionPaper', targetId: 'paper' }

/**
 * A top-level comment with no replies.
 *
 * @param content - What it says, doubling as its id.
 * @param createdAt - When it was posted.
 *
 * @returns The comment.
 */
function comment(content: string, createdAt = '2026-10-16T10:00:00Z'): CommentDto {
  // The comment, posted once and never touched since
  return {
    id: content,
    author: { id: 'author', name: 'Author', avatarUrl: null },
    content,
    createdAt,
    editedAt: null,
    isDeleted: false,
    reactions: [],
    replies: [],
  }
}

/**
 * The discussions of the problem and the paper, as a read answers with them.
 *
 * @param problem - The problem's thread.
 * @param paper - The paper's thread; none where nothing is said about the paper.
 *
 * @returns The discussions.
 */
function discussionsOf(problem: CommentDto[], paper?: CommentDto[]): SelectionDiscussions {
  // The problem's discussion, and the paper's where one is given
  return {
    proposals: { [PROBLEM.targetId]: problem },
    papers: paper === undefined ? {} : { [PAPER.targetId]: paper },
  }
}

/**
 * A comment given a colleague's thumbs up.
 *
 * @param reactedTo - The comment.
 *
 * @returns The comment with the reaction.
 */
function thumbedUp(reactedTo: CommentDto): CommentDto {
  // The comment, a colleague's thumbs up on it
  return { ...reactedTo, reactions: [{ userId: 'colleague', name: 'Colleague', kind: 'thumbsUp' }] }
}

/**
 * Reads the discussions given, once the step given has run while the read is out, the answer coming a moment after
 * it.
 *
 * @param queryClient - The cache the writes are counted in.
 * @param discussions - What the read answers with.
 * @param whileOut - What happens while the read is out.
 *
 * @returns The answer, with what stood as it set off.
 */
async function readOf(
  queryClient: QueryClient,
  discussions: SelectionDiscussions,
  whileOut: () => void | Promise<void> = () => undefined
): Promise<DiscussionsRead> {
  // The read, the step happening while it is out
  const result = await readDiscussions(queryClient, async () => {
    // Whatever happens while the read is out
    await whileOut()

    // A moment on before the answer comes
    await aMomentLater()

    // The answer
    return { success: true, data: discussions }
  })

  // A read that cannot fail, failed all the same
  if (!result.success) throw new Error('The read failed')

  // The answer
  return result.data
}

/**
 * The reader's copy of a thread.
 *
 * @param queryClient - The cache.
 * @param target - The thread.
 *
 * @returns What the cache holds for it.
 */
function threadIn(queryClient: QueryClient, target: CommentTarget): CommentDto[] | undefined {
  // The reader's copy
  return queryClient.getQueryData<CommentDto[]>(commentQueryKeys.target(target, READER))
}

/**
 * Writes the reader's copy of a thread.
 *
 * @param queryClient - The cache.
 * @param target - The thread.
 * @param comments - What the copy holds.
 */
function hold(queryClient: QueryClient, target: CommentTarget, comments: CommentDto[]): void {
  // The reader's copy, written now
  queryClient.setQueryData(commentQueryKeys.target(target, READER), comments)
}

/**
 * Waits long enough that a read setting off next does so after everything written so far.
 *
 * @returns A promise settling a moment later.
 */
function aMomentLater(): Promise<void> {
  // A few milliseconds on the clock
  return new Promise((resolve) => setTimeout(resolve, 5))
}

/**
 * Starts a write that stays out until it is settled, or else until the test ends.
 *
 * @param queryClient - The cache the write is counted in.
 * @param mutationKey - What the write is to, by its key.
 *
 * @returns A function settling the write, whose promise resolves once the write no longer counts as out.
 */
function startWrite(queryClient: QueryClient, mutationKey: MutationKey): () => Promise<void> {
  // The answer the write waits on, and a function giving it
  let answer: () => void = () => undefined
  const answered = new Promise<void>((resolve) => {
    answer = resolve
  })

  // A write waiting on the answer
  const write = queryClient.getMutationCache().build(queryClient, {
    mutationKey,
    mutationFn: () => answered,
  })

  // The write sent off, which counts it as out
  const settled = write.execute(undefined)

  // A function which answers the write and waits for it to settle
  return async () => {
    // Answered
    answer()

    // Settled
    await settled
  }
}

describe('parkDiscussions', () => {
  it("parks each discussion in the reader's copy of its thread, over what that copy held", async () => {
    // A cache holding an old copy of the problem's thread, and a read of both discussions a while later
    const queryClient = new QueryClient()
    hold(queryClient, PROBLEM, [comment('old')])
    await aMomentLater()
    const read = await readOf(queryClient, discussionsOf([comment('problem')], [comment('paper')]))

    // Parked
    parkDiscussions(queryClient, READER, read)

    // Each thread as the read found it
    expect(threadIn(queryClient, PROBLEM)).toEqual([comment('problem')])
    expect(threadIn(queryClient, PAPER)).toEqual([comment('paper')])
  })

  it('leaves a thread written while the read was out, parking the rest', async () => {
    // A new comment landing in the problem's thread while the read is out
    const queryClient = new QueryClient()
    const read = await readOf(
      queryClient,
      discussionsOf([comment('stale')], [comment('paper')]),
      () => hold(queryClient, PROBLEM, [comment('fresh')])
    )

    // Parked
    parkDiscussions(queryClient, READER, read)

    // The new comment kept, the paper's thread parked
    expect(threadIn(queryClient, PROBLEM)).toEqual([comment('fresh')])
    expect(threadIn(queryClient, PAPER)).toEqual([comment('paper')])
  })

  it('parks over no held thread where a write to a comment was out as the read set off, though it settled before the answer came, filling the threads nothing holds', async () => {
    // A cache holding an old copy of the problem's thread, with a write to a comment out as the read sets off that
    // settles while it is out
    const queryClient = new QueryClient()
    hold(queryClient, PROBLEM, [comment('old')])
    const settle = startWrite(queryClient, commentMutationKeys.all)
    await aMomentLater()
    const read = await readOf(
      queryClient,
      discussionsOf([comment('problem')], [comment('paper')]),
      settle
    )

    // Parked
    parkDiscussions(queryClient, READER, read)

    // The held thread kept, the paper's filled
    expect(threadIn(queryClient, PROBLEM)).toEqual([comment('old')])
    expect(threadIn(queryClient, PAPER)).toEqual([comment('paper')])
  })

  it('parks over no held thread while a write to a comment is out as the answer is parked', async () => {
    // A cache holding an old copy of the problem's thread, and a read of it a while later
    const queryClient = new QueryClient()
    hold(queryClient, PROBLEM, [comment('old')])
    await aMomentLater()
    const read = await readOf(queryClient, discussionsOf([comment('problem')]))

    // A reaction gone out since the answer came
    startWrite(queryClient, commentMutationKeys.reactions(PROBLEM))

    // Parked
    parkDiscussions(queryClient, READER, read)

    // The held thread kept
    expect(threadIn(queryClient, PROBLEM)).toEqual([comment('old')])
  })

  it('parks over a held thread while only a write to something else is out', async () => {
    // A cache holding an old copy of the problem's thread, with a write to something else out the whole time
    const queryClient = new QueryClient()
    hold(queryClient, PROBLEM, [comment('old')])
    startWrite(queryClient, ['selection'])
    await aMomentLater()
    const read = await readOf(queryClient, discussionsOf([comment('problem')]))

    // Parked
    parkDiscussions(queryClient, READER, read)

    // The thread as the read found it
    expect(threadIn(queryClient, PROBLEM)).toEqual([comment('problem')])
  })
})

describe('parkReactionsEditsAndDeletions', () => {
  it('parks a thread the answer changes only in what was edited, who reacted how and what was deleted', async () => {
    // The reader's copy of the problem's thread, and a read finding a colleague's thumbs up on one comment, another
    // deleted, and the last edited under a new id
    const queryClient = new QueryClient()
    hold(queryClient, PROBLEM, [comment('question'), comment('aside'), comment('remark')])
    await aMomentLater()
    const changed = [
      thumbedUp(comment('question')),
      { ...comment('aside'), isDeleted: true, content: '' },
      {
        ...comment('remark'),
        id: 'remark-edited',
        content: 'remark, reworded',
        editedAt: '2026-10-17T10:00:00Z',
      },
    ]
    const read = await readOf(queryClient, discussionsOf(changed))

    // Parked
    parkReactionsEditsAndDeletions(queryClient, READER, read)

    // The thumbs up in, the second comment deleted, the last one as it reads now
    expect(threadIn(queryClient, PROBLEM)).toEqual(changed)
  })

  it("leaves a thread written while the read was out, though the answer differs from the reader's copy only in who reacted how", async () => {
    // A thumbs up landing on the problem's comment while the read is out, which the answer predates
    const queryClient = new QueryClient()
    hold(queryClient, PROBLEM, [comment('question')])
    await aMomentLater()
    const read = await readOf(queryClient, discussionsOf([comment('question')]), () =>
      hold(queryClient, PROBLEM, [thumbedUp(comment('question'))])
    )

    // Parked
    parkReactionsEditsAndDeletions(queryClient, READER, read)

    // The thumbs up kept
    expect(threadIn(queryClient, PROBLEM)).toEqual([thumbedUp(comment('question'))])
  })

  it('leaves a thread the answer says something new in, and one nothing holds', async () => {
    // The reader's copy of the problem's thread, and a read finding a reaction and a reply in it and the paper discussed
    const queryClient = new QueryClient()
    hold(queryClient, PROBLEM, [comment('question')])
    await aMomentLater()
    const read = await readOf(
      queryClient,
      discussionsOf(
        [{ ...thumbedUp(comment('question')), replies: [comment('answer')] }],
        [comment('paper')]
      )
    )

    // Parked
    parkReactionsEditsAndDeletions(queryClient, READER, read)

    // The problem's thread as the reader had it, the paper's still not held
    expect(threadIn(queryClient, PROBLEM)).toEqual([comment('question')])
    expect(threadIn(queryClient, PAPER)).toBeUndefined()
  })
})

describe('threadsAfterParking', () => {
  it("gives the answer's copy of a thread parking would write, and of one nothing holds yet", async () => {
    // The reader's copy of the problem's thread, and a read finding a reply in it and the paper discussed
    const queryClient = new QueryClient()
    hold(queryClient, PROBLEM, [comment('question')])
    await aMomentLater()
    const answered = { ...comment('question'), replies: [comment('answer')] }
    const read = await readOf(queryClient, discussionsOf([answered], [comment('paper')]))

    // What parking would leave
    const after = threadsAfterParking(queryClient, READER, read, [PROBLEM, PAPER])

    // Both as the read found them
    expect(after).toEqual([[answered], [comment('paper')]])
  })

  it("gives the reader's own copy of a thread written since the read set off", async () => {
    // The reader's reply landing in the problem's thread while the read is out
    const queryClient = new QueryClient()
    const mine = { ...comment('question'), replies: [comment('mine')] }
    const read = await readOf(queryClient, discussionsOf([comment('question')]), () =>
      hold(queryClient, PROBLEM, [mine])
    )

    // What parking would leave
    const after = threadsAfterParking(queryClient, READER, read, [PROBLEM])

    // The reader's copy, newer than the answer
    expect(after).toEqual([[mine]])
  })
})
