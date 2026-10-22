import { describe, expect, it } from 'vitest'

import type { CommentData } from '../../components/CommentItem'
import {
  type CommentNewness,
  countNewComments,
  isNewComment,
  lastPostedByOthersAt,
} from '../comment-newness'

/** The reader. */
const READER = 'user_rita'

/** The moment the reader has seen the thread up to. */
const SEEN_UP_TO = Date.parse('2026-10-10T12:00:00.000Z')

/** A thread the reader has seen up to {@link SEEN_UP_TO}. */
const SEEN: CommentNewness = { kind: 'seen', seenUpTo: SEEN_UP_TO }

/**
 * A comment as the comment components draw it.
 *
 * @param id - The comment's id.
 * @param authorId - Who posted the comment.
 * @param postedAt - When the comment was posted.
 * @param replies - The comment's replies.
 *
 * @returns The comment, standing and unedited.
 */
function comment(
  id: string,
  authorId: string,
  postedAt: string,
  replies: CommentData[] = []
): CommentData {
  // A standing comment with no reactions
  return {
    id,
    authorId,
    author: authorId,
    avatarUrl: null,
    content: id,
    timestamp: new Date(postedAt),
    editedAt: null,
    reactions: [],
    viewerReaction: null,
    isDeleted: false,
    replies,
  }
}

describe('isNewComment', () => {
  it("takes somebody else's comment posted after the mark as new, and one posted at it as seen", () => {
    // Zuzana's comment a millisecond past the mark, and one right at it
    const after = comment('after', 'user_zuzana', '2026-10-10T12:00:00.001Z')
    const at = comment('at', 'user_zuzana', '2026-10-10T12:00:00.000Z')

    // Only the later one is new
    expect([isNewComment(after, SEEN, READER), isNewComment(at, SEEN, READER)]).toEqual([
      true,
      false,
    ])
  })

  it("never takes the reader's own comment, a deleted one, or anything in an untracked thread as new", () => {
    // The reader's own comment and a deleted one in a thread the reader has seen nothing of, and Zuzana's in a thread
    // keeping no account
    const own = comment('own', READER, '2026-10-11T08:00:00.000Z')
    const deleted = {
      ...comment('deleted', 'user_zuzana', '2026-10-11T08:00:00.000Z'),
      isDeleted: true,
    }
    const untracked = comment('untracked', 'user_zuzana', '2026-10-11T08:00:00.000Z')

    // None is new
    expect([
      isNewComment(own, { kind: 'seen', seenUpTo: null }, READER),
      isNewComment(deleted, { kind: 'seen', seenUpTo: null }, READER),
      isNewComment(untracked, { kind: 'untracked' }, READER),
    ]).toEqual([false, false, false])
  })

  it('takes a comment posted however long ago as new where the reader has seen nothing', () => {
    // Zuzana's comment from long before any mark
    const old = comment('old', 'user_zuzana', '2020-01-01T00:00:00.000Z')

    // New all the same
    expect(isNewComment(old, { kind: 'seen', seenUpTo: null }, READER)).toBe(true)
  })
})

describe('countNewComments', () => {
  it("counts the new comments at any depth, the reader's own left out", () => {
    // A thread: an old comment whose new reply has a new reply of its own, beside the reader's own reply, and a new
    // comment after it
    const thread = [
      comment('old', 'user_zuzana', '2026-10-01T08:00:00.000Z', [
        comment('reply', 'user_martin', '2026-10-11T08:00:00.000Z', [
          comment('nested', 'user_zuzana', '2026-10-11T09:00:00.000Z'),
        ]),
        comment('own', READER, '2026-10-11T10:00:00.000Z'),
      ]),
      comment('later', 'user_martin', '2026-10-11T07:00:00.000Z'),
    ]

    // How many are new
    const fresh = countNewComments(thread, SEEN, READER)

    // The reply, the reply to it and the later comment, the old comment and the reader's own left out
    expect(fresh).toBe(3)
  })
})

describe('lastPostedByOthersAt', () => {
  it("finds the newest comment at any depth, the reader's own and deleted ones passed over", () => {
    // Zuzana's reply nested two deep is the newest that can be new, beside a later reply of the reader's own and a
    // later deleted one
    const thread = [
      comment('old', 'user_zuzana', '2026-10-01T08:00:00.000Z', [
        comment('reply', 'user_martin', '2026-10-11T08:00:00.000Z', [
          comment('nested', 'user_zuzana', '2026-10-11T09:00:00.000Z'),
        ]),
        comment('own', READER, '2026-10-11T10:00:00.000Z'),
        {
          ...comment('deleted', 'user_martin', '2026-10-11T11:00:00.000Z'),
          isDeleted: true,
        },
      ]),
      comment('earlier', 'user_martin', '2026-10-11T07:00:00.000Z'),
    ]

    // When the newest was posted
    const newest = lastPostedByOthersAt(thread, READER)

    // The nested reply's moment
    expect(newest).toBe(Date.parse('2026-10-11T09:00:00.000Z'))
  })

  it("finds somebody else's reply under the reader's own comment and under a deleted one", () => {
    // The reader's own comment answered by Martin, and a deleted one answered by Zuzana later still
    const thread = [
      comment('own', READER, '2026-10-11T08:00:00.000Z', [
        comment('reply', 'user_martin', '2026-10-11T09:00:00.000Z'),
      ]),
      {
        ...comment('deleted', 'user_martin', '2026-10-11T10:00:00.000Z', [
          comment('late-reply', 'user_zuzana', '2026-10-11T11:00:00.000Z'),
        ]),
        isDeleted: true,
      },
    ]

    // When the newest was posted
    const newest = lastPostedByOthersAt(thread, READER)

    // Zuzana's reply's moment
    expect(newest).toBe(Date.parse('2026-10-11T11:00:00.000Z'))
  })

  it("has no moment for a thread holding only the reader's own comments", () => {
    // The reader's own comment, with their own reply
    const thread = [
      comment('own', READER, '2026-10-11T08:00:00.000Z', [
        comment('own-reply', READER, '2026-10-11T09:00:00.000Z'),
      ]),
    ]

    // When the newest was posted
    const newest = lastPostedByOthersAt(thread, READER)

    // No moment
    expect(newest).toBeNull()
  })
})
