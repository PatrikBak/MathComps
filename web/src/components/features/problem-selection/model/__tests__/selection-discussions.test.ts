import { describe, expect, it } from 'vitest'

import { commentDto } from '@/components/features/comments/model/__tests__/support/comment-fixtures'

import {
  type DiscussedSubject,
  type DiscussionThread,
  postingNewIn,
  revealedIn,
  showTheSame,
  threadKeyOf,
  threadsByActivity,
  underSubjectsOf,
} from '../selection-discussions'
import type { Proposal } from '../selection-types'

/** A problem standing in for a discussion's subject. */
const PROBLEM = 'problem'

/** A paper standing in for a discussion's subject. */
const PAPER = 'paper'

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
        comments: [commentDto('old', 1, [commentDto('late-reply', 9)]), commentDto('newer', 5)],
      },
      { subject: PAPER, comments: [commentDto('paper', 7)] },
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
          commentDto('deep', 1, [commentDto('child', 2, [commentDto('grandchild', 8)])]),
          commentDto('deleted-reply', 4, [{ ...commentDto('gone', 9, [], ''), isDeleted: true }]),
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
          { ...commentDto('answered', 1, [commentDto('answer', 3)], ''), isDeleted: true },
          { ...commentDto('empty', 6, [], ''), isDeleted: true },
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
          { ...commentDto('edited', 1), editedAt: new Date(Date.UTC(2026, 9, 20)).toISOString() },
          commentDto('newer', 5),
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
    const posted = { ...commentDto('first', 1), createdAt: '2026-10-16T10:00:00.1234567Z' }

    // The same comment edited, under a new id, its time read back to the microsecond
    const edited = { ...posted, id: 'second', createdAt: '2026-10-16T10:00:00.123456Z' }

    // One key for both
    expect(threadKeyOf({ subject: PROBLEM, comment: edited })).toBe(
      threadKeyOf({ subject: PROBLEM, comment: posted })
    )
  })
})

describe('showTheSame', () => {
  it('finds two lists the same when only their order, their times, what was edited and who reacted how differ', () => {
    // Two threads as one copy holds them
    const asHeld = [
      { subject: PROBLEM, comment: commentDto('first', 1, [commentDto('reply', 2)]) },
      { subject: PAPER, comment: commentDto('second', 3) },
    ]

    // The same two read back the other way round, a time rounded, a thumbs up given, and the paper's comment edited
    // under a new id
    const asRead = [
      {
        subject: PAPER,
        comment: {
          ...commentDto('second', 3),
          id: 'second-edited',
          content: 'second, reworded',
          editedAt: new Date(Date.UTC(2026, 9, 4)).toISOString(),
          reactions: [{ userId: 'colleague', name: 'Colleague', kind: 'thumbsUp' as const }],
        },
      },
      {
        subject: PROBLEM,
        comment: commentDto('first', 1, [
          { ...commentDto('reply', 2), createdAt: '2026-10-02T00:00:00.0000001Z' },
        ]),
      },
    ]

    // The same
    expect(showTheSame(asHeld, asRead)).toBe(true)
  })

  it('finds two lists different when a reply is missing from one, or a thread is gone or new', () => {
    // A thread as one copy holds it
    const asHeld = [{ subject: PROBLEM, comment: commentDto('first', 1) }]

    // The thread with a reply
    const answered = [
      { subject: PROBLEM, comment: commentDto('first', 1, [commentDto('reply', 2)]) },
    ]

    // The thread beside one started since
    const started = [...asHeld, { subject: PAPER, comment: commentDto('second', 3) }]

    // A reply more is something new
    expect(showTheSame(asHeld, answered)).toBe(false)

    // The thread gone is something new
    expect(showTheSame(asHeld, [])).toBe(false)

    // A thread started since is something new
    expect(showTheSame(asHeld, started)).toBe(false)
  })
})

describe('postingNewIn', () => {
  it('picks out the threads the earlier list lacks and those answered since, never one only edited or left behind', () => {
    // Three threads as the list showed them: one to be answered, one to be edited, one to leave
    const earlier = [
      { subject: PROBLEM, comment: commentDto('answered', 1) },
      { subject: PROBLEM, comment: commentDto('edited', 2) },
      { subject: PAPER, comment: commentDto('left', 3) },
    ]

    // The list as it is now: a thread new to it, the first answered, the second edited under a new id, the third gone
    const later = [
      { subject: PAPER, comment: commentDto('new', 4) },
      { subject: PROBLEM, comment: commentDto('answered', 1, [commentDto('answer', 5)]) },
      {
        subject: PROBLEM,
        comment: {
          ...commentDto('edited', 2),
          id: 'edited-again',
          editedAt: new Date(Date.UTC(2026, 9, 6)).toISOString(),
        },
      },
    ]

    // The threads that show something the earlier list didn't
    const posting = postingNewIn(earlier, later)

    // The new thread and the answered one, in the later list's order
    expect(idsOf(posting)).toEqual(['new', 'answered'])
  })
})

/**
 * A problem, as a thread's discussion hangs off it.
 *
 * @param id - The problem's id.
 * @param changes - What sets it apart from a live algebra problem recommended for nothing.
 *
 * @returns The problem as a discussed subject.
 */
function discussedProblem(id: string, changes: Partial<Proposal> = {}): DiscussedSubject {
  // An algebra problem recommended for nothing, live, and whatever the changes lay on top
  return {
    kind: 'proposal',
    proposal: {
      id,
      number: 1,
      title: id,
      area: 'algebra',
      recommended: [],
      texts: {},
      originalLanguage: null,
      isSetAside: false,
      isUsed: false,
      ratings: [],
      ...changes,
    },
  }
}

describe('revealedIn', () => {
  it('tells every thread shown of a discussion one of whose threads shows something new, and none of one showing nothing new', () => {
    // The threads the list showed before: the first problem's second thread, its first thread hidden and holding the
    // mark back, and the second problem's thread
    const earlier = [
      { subject: discussedProblem('first'), comment: commentDto('second thread', 3) },
      { subject: discussedProblem('second'), comment: commentDto('other', 1) },
    ]

    // Every thread showing now, the first problem's first thread among them
    const later = [
      { subject: discussedProblem('first'), comment: commentDto('second thread', 3) },
      { subject: discussedProblem('first'), comment: commentDto('first thread', 2) },
      { subject: discussedProblem('second'), comment: commentDto('other', 1) },
    ]

    // What the view shows afresh
    const revealed = revealedIn(earlier, later)

    // Both of the first problem's threads, the second problem's left out
    expect(revealed.map((thread) => thread.comment.id)).toEqual(['second thread', 'first thread'])

    // Every thread showing now, the second problem's thread answered since
    const answered = [
      ...later.slice(0, 2),
      {
        subject: discussedProblem('second'),
        comment: commentDto('other', 1, [commentDto('answer', 4)]),
      },
    ]

    // What the view shows afresh once the second problem's thread is answered
    const revealedOnceAnswered = revealedIn(earlier, answered)

    // Both of the first problem's threads, and the second problem's answered one
    expect(revealedOnceAnswered.map((thread) => thread.comment.id)).toEqual([
      'second thread',
      'first thread',
      'other',
    ])
  })
})

describe('underSubjectsOf', () => {
  it("puts each thread under the list's subject of the same discussion, and one the list lacks under its own", () => {
    // The first problem as the selection now holds it, set aside since its thread was read
    const setAside = discussedProblem('first', { isSetAside: true })

    // A thread on each of two problems, put under a list holding the first problem alone
    const placed = underSubjectsOf(
      [
        { subject: discussedProblem('first'), comment: commentDto('first', 1) },
        { subject: discussedProblem('second'), comment: commentDto('second', 2) },
      ],
      [setAside]
    )

    // The first problem's thread under the set-aside problem, the second's under its own problem
    expect(placed.map(({ subject }) => subject)).toEqual([setAside, discussedProblem('second')])
  })
})
