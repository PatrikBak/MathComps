import { describe, expect, it } from 'vitest'

import type { CommentDto } from '@/components/features/comments/services/comment-api-types'

import {
  type DiscussionThread,
  showTheSame,
  threadKeyOf,
  threadsByActivity,
} from '../selection-discussions'

/** A problem standing in for a discussion's subject. */
const PROBLEM = 'problem'

/** A paper standing in for a discussion's subject. */
const PAPER = 'paper'

/**
 * A comment posted on a given day of October 2026, with the replies given.
 *
 * @param id - The comment's id.
 * @param day - The day it was posted.
 * @param replies - Its replies.
 * @param isDeleted - Whether it was deleted since.
 *
 * @returns The comment, never edited.
 */
function comment(
  id: string,
  day: number,
  replies: CommentDto[] = [],
  isDeleted = false
): CommentDto {
  // The comment, as posted
  return {
    id,
    author: { id: 'author', name: 'Author', avatarUrl: null },
    content: isDeleted ? '' : id,
    createdAt: new Date(Date.UTC(2026, 9, day)).toISOString(),
    editedAt: null,
    isDeleted,
    reactions: [],
    replies,
  }
}

/**
 * The ids of the threads' top-level comments, in the order given.
 *
 * @param threads - The threads.
 *
 * @returns Each thread's top-level comment id.
 */
function idsOf(threads: DiscussionThread<string>[]): string[] {
  // Each thread's top-level comment
  return threads.map((thread) => thread.comment.id)
}

describe('threadsByActivity', () => {
  it('orders threads from both kinds of discussion by their newest post, a reply counting as much as a comment', () => {
    // The threads: a problem's old comment answered lately, its newer one nobody answered, and a paper's in between
    const threads = threadsByActivity([
      {
        subject: PROBLEM,
        comments: [comment('old', 1, [comment('late-reply', 9)]), comment('newer', 5)],
      },
      { subject: PAPER, comments: [comment('paper', 7)] },
    ])

    // The answered one first, by its reply, then the paper's, then the unanswered one
    expect(idsOf(threads)).toEqual(['old', 'paper', 'newer'])

    // Each with the subject of the discussion it was posted in
    expect(threads.map((thread) => thread.subject)).toEqual([PROBLEM, PAPER, PROBLEM])
  })

  it('counts a reply nested deep down, and never a deleted one', () => {
    // The threads: one whose newest standing post is a reply to a reply, beside one whose newest reply was deleted
    const threads = threadsByActivity([
      {
        subject: PROBLEM,
        comments: [
          comment('deep', 1, [comment('child', 2, [comment('grandchild', 8)])]),
          comment('deleted-reply', 4, [comment('gone', 9, [], true)]),
        ],
      },
    ])

    // The deep one first, since the deleted reply leaves the other at its own post
    expect(idsOf(threads)).toEqual(['deep', 'deleted-reply'])
  })

  it('keeps a deleted comment with a reply still standing, and drops one with nothing left', () => {
    // The threads: a deleted comment answered, and a deleted one nobody answered
    const threads = threadsByActivity([
      {
        subject: PROBLEM,
        comments: [
          comment('answered', 1, [comment('answer', 3)], true),
          comment('empty', 6, [], true),
        ],
      },
    ])

    // Only the answered one
    expect(idsOf(threads)).toEqual(['answered'])
  })

  it('never counts an edit as activity', () => {
    // The threads: an old comment edited after a newer one was posted, and the newer one
    const threads = threadsByActivity([
      {
        subject: PROBLEM,
        comments: [
          { ...comment('edited', 1), editedAt: new Date(Date.UTC(2026, 9, 20)).toISOString() },
          comment('newer', 5),
        ],
      },
    ])

    // The newer one first, the edit leaving the old one where its post put it
    expect(idsOf(threads)).toEqual(['newer', 'edited'])
  })
})

describe('threadKeyOf', () => {
  it("keeps a thread's key across an edit, and across its posting time read back rounded", () => {
    // A top-level comment as its poster's write gave it back
    const posted = { ...comment('first', 1), createdAt: '2026-10-16T10:00:00.1234567Z' }

    // The same comment edited, under a new id, its time read back to the microsecond
    const edited = { ...posted, id: 'second', createdAt: '2026-10-16T10:00:00.123456Z' }

    // One key for both
    expect(threadKeyOf({ subject: PROBLEM, comment: edited })).toBe(
      threadKeyOf({ subject: PROBLEM, comment: posted })
    )
  })
})

describe('showTheSame', () => {
  it('finds two lists the same when only their order, their times and who reacted how differ', () => {
    // Two threads as one copy holds them
    const asHeld = [
      { subject: PROBLEM, comment: comment('first', 1, [comment('reply', 2)]) },
      { subject: PAPER, comment: comment('second', 3) },
    ]

    // The same two read back the other way round, a time rounded and a thumbs up given
    const asRead = [
      {
        subject: PAPER,
        comment: {
          ...comment('second', 3),
          reactions: [{ userId: 'colleague', name: 'Colleague', kind: 'thumbsUp' as const }],
        },
      },
      {
        subject: PROBLEM,
        comment: comment('first', 1, [
          { ...comment('reply', 2), createdAt: '2026-10-02T00:00:00.0000001Z' },
        ]),
      },
    ]

    // The same
    expect(showTheSame(asHeld, asRead)).toBe(true)
  })

  it('finds two lists different when a reply is missing from one, or a thread is gone or new', () => {
    // A thread as one copy holds it
    const asHeld = [{ subject: PROBLEM, comment: comment('first', 1) }]

    // The thread with a reply
    const answered = [{ subject: PROBLEM, comment: comment('first', 1, [comment('reply', 2)]) }]

    // The thread beside one started since
    const started = [...asHeld, { subject: PAPER, comment: comment('second', 3) }]

    // A reply more is something new
    expect(showTheSame(asHeld, answered)).toBe(false)

    // The thread gone is something new
    expect(showTheSame(asHeld, [])).toBe(false)

    // A thread started since is something new
    expect(showTheSame(asHeld, started)).toBe(false)
  })
})
