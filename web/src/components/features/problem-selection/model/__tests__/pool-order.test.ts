import { describe, expect, it } from 'vitest'

import { commentDto } from '@/components/features/comments/model/__tests__/support/comment-fixtures'

import { threadsInOrder } from '../pool-order'
import type { DiscussedSubject, DiscussionThread } from '../selection-discussions'
import type { Board, Proposal } from '../selection-types'

/**
 * A live algebra proposal in the pool, numbered and named after its number unless told otherwise.
 *
 * @param number - The number it goes by, which its id is built from.
 * @param changes - What sets it apart from a live algebra problem recommended for nothing.
 *
 * @returns The proposal.
 */
function proposal(number: number, changes: Partial<Proposal> = {}): Proposal {
  // An algebra problem recommended for nothing, with an English statement, and whatever the changes lay on top
  return {
    id: `p${number}`,
    number,
    title: `Problem ${number}`,
    area: 'algebra',
    recommended: [],
    texts: { en: { statement: `Statement ${number}`, solution: null, hints: [] } },
    originalLanguage: 'en',
    isSetAside: false,
    isUsed: false,
    ratings: [],
    ...changes,
  }
}

/**
 * The ids of the threads' top-level comments, in the order given.
 *
 * @param threads - The threads.
 *
 * @returns Each thread's top-level comment id.
 */
function threadIds(threads: DiscussionThread<DiscussedSubject>[]): string[] {
  // Each thread's top-level comment id
  return threads.map((thread) => thread.comment.id)
}

/** An olympiad board named November, problems 1 and 2 in its C paper, problem 3 in its B paper. */
const NOVEMBER: Board = {
  id: 'november',
  name: 'November',
  papers: [
    { id: 'november-c', name: 'C', category: 'C', slots: ['p1', 'p2'] },
    { id: 'november-b', name: 'B', category: 'B', slots: ['p3'] },
  ],
  finalization: null,
}

/** An older olympiad board named October, with a C paper and an A paper, which November has none of. */
const OCTOBER: Board = {
  id: 'october',
  name: 'October',
  papers: [
    { id: 'october-c', name: 'C', category: 'C', slots: [null] },
    { id: 'october-a', name: 'A', category: 'A', slots: [null] },
  ],
  finalization: null,
}

/**
 * One thread of a subject's discussion.
 *
 * @param id - The top-level comment's id.
 * @param day - The day of October it was posted on.
 * @param subject - What the thread hangs off.
 *
 * @returns The thread.
 */
function thread(
  id: string,
  day: number,
  subject: DiscussedSubject
): DiscussionThread<DiscussedSubject> {
  // The top-level comment under its subject
  return { subject, comment: commentDto(id, day) }
}

describe('threadsInOrder', () => {
  it("runs the threads problem by problem as the board on screen runs the pool, each category's papers first, the newest board's first, each subject's oldest first", () => {
    // November's C problems, its B problem, the rest of C (a geometry problem, an algebra one and a taken one), and a
    // problem no paper takes
    const [first, second, third, geometry, algebra, taken, nowhere] = [
      proposal(1, { recommended: ['C'] }),
      proposal(2, { recommended: ['C'] }),
      proposal(3, { recommended: ['B'] }),
      proposal(4, { area: 'geometry', recommended: ['C'] }),
      proposal(5, { recommended: ['C'] }),
      proposal(6, { area: 'geometry', recommended: ['C'], isUsed: true }),
      proposal(7),
    ].map((problem): DiscussedSubject => ({ kind: 'proposal', proposal: problem }))

    // The threads newest activity first, as the filters let them through, problem 1 and November's C paper with two
    const threads = [
      thread('nowhere', 20, nowhere),
      thread('october a', 19, { kind: 'paper', paper: OCTOBER.papers[1], board: OCTOBER }),
      thread('first later', 18, first),
      thread('taken', 17, taken),
      thread('november c later', 16, { kind: 'paper', paper: NOVEMBER.papers[0], board: NOVEMBER }),
      thread('october c', 15, { kind: 'paper', paper: OCTOBER.papers[0], board: OCTOBER }),
      thread('third', 14, third),
      thread('geometry', 13, geometry),
      thread('algebra', 12, algebra),
      thread('second', 11, second),
      thread('november c', 10, { kind: 'paper', paper: NOVEMBER.papers[0], board: NOVEMBER }),
      thread('first', 9, first),
    ]

    // The threads problem by problem, November on screen, no category picked
    const ordered = threadsInOrder(threads, 'problem', NOVEMBER, [], [OCTOBER, NOVEMBER])

    // C's papers, November's first, then C1 and C2, the rest of C by area and number, the taken problem among them,
    // then B, the problem no paper takes, and last the A paper, which no paper of November runs
    expect(threadIds(ordered)).toEqual([
      'november c',
      'november c later',
      'october c',
      'first',
      'first later',
      'second',
      'algebra',
      'geometry',
      'taken',
      'third',
      'nowhere',
      'october a',
    ])
  })
})
