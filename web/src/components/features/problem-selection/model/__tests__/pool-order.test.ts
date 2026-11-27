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
    recommendedPapers: [],
    texts: { en: { statement: `Statement ${number}`, solution: null, hints: [] } },
    originalLanguage: 'en',
    gradingNote: null,
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

/** The categories the olympiad runs, in the order they run. */
const CATEGORIES = ['A', 'B', 'C']

/**
 * The newest draft, January, finalizable: problems 1 and 2 in its C paper, problem 3 in its B paper.
 */
const JANUARY: Board = {
  id: 'january',
  name: 'January',
  papers: [
    { id: 'january-c', name: 'C', category: 'C', slots: ['p1', 'p2'] },
    { id: 'january-b', name: 'B', category: 'B', slots: ['p3'] },
  ],
  cycle: { name: 'January', opensAt: '2027-01-25T08:00:00.000Z', stage: 'finalizable' },
}

/**
 * An older draft, December, no longer finalizable: problem 4 in its C paper, problem 1, which January holds too,
 * and 5 in its B paper.
 */
const DECEMBER: Board = {
  id: 'december',
  name: 'December',
  papers: [
    { id: 'december-c', name: 'C', category: 'C', slots: ['p4'] },
    { id: 'december-b', name: 'B', category: 'B', slots: ['p1', 'p5'] },
  ],
  cycle: { name: 'December', opensAt: '2026-12-01T08:00:00.000Z', stage: 'unfinalizable' },
}

/** A board finalized into October's rounds, still to open, problem 6 in its C paper. */
const OCTOBER: Board = {
  id: 'october',
  name: 'October',
  papers: [{ id: 'october-c', name: 'C', category: 'C', slots: ['p6'] }],
  cycle: { name: 'October', opensAt: '2026-10-25T08:00:00.000Z', stage: 'finalized' },
}

/** The oldest board, finalized into September's rounds, which have opened, problem 7 in its A paper. */
const SEPTEMBER: Board = {
  id: 'september',
  name: 'September',
  papers: [{ id: 'september-a', name: 'A', category: 'A', slots: ['p7'] }],
  cycle: { name: 'September', opensAt: '2026-09-25T08:00:00.000Z', stage: 'opened' },
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
  it("runs the threads by problem: the drafts newest first, the pool by category and number, then the finalized boards newest first, each paper's own threads ahead of its slots, each subject's oldest first", () => {
    // The boards' problems, then the pool's: one for B and C, one for C, one for A, one for nothing and another for C
    const [p1, p2, p3, p4, p5, p6, p7, forBAndC, forC, forA, forNothing, laterForC] = [
      ...[1, 2, 3, 4, 5, 6, 7].map((number) => proposal(number)),
      proposal(8, { recommended: ['B', 'C'] }),
      proposal(9, { recommended: ['C'] }),
      proposal(10, { recommended: ['A'] }),
      proposal(11),
      proposal(12, { recommended: ['C'] }),
    ].map((problem): DiscussedSubject => ({ kind: 'proposal', proposal: problem }))

    // A function which says the subject of a paper's discussion
    const paper = (board: Board, index: number): DiscussedSubject => ({
      kind: 'paper',
      paper: board.papers[index],
      board,
    })

    // The threads newest activity first, as the filters let them through, problem 1 and January's C paper with two,
    // the later one's id sorting first
    const threads = [
      thread('september a', 30, paper(SEPTEMBER, 0)),
      thread('p1 again', 29, p1),
      thread('for nothing', 28, forNothing),
      thread('p7', 27, p7),
      thread('january c again', 26, paper(JANUARY, 0)),
      thread('later for c', 25, laterForC),
      thread('p5', 24, p5),
      thread('october c', 23, paper(OCTOBER, 0)),
      thread('for a', 22, forA),
      thread('p3', 21, p3),
      thread('december c', 20, paper(DECEMBER, 0)),
      thread('for c', 19, forC),
      thread('p6', 18, p6),
      thread('january b', 17, paper(JANUARY, 1)),
      thread('for b and c', 16, forBAndC),
      thread('p4', 15, p4),
      thread('p2', 14, p2),
      thread('january c first', 13, paper(JANUARY, 0)),
      thread('p1 first', 12, p1),
    ]

    // The threads by problem, against the boards oldest first
    const ordered = threadsInOrder(
      threads,
      'problem',
      [SEPTEMBER, OCTOBER, DECEMBER, JANUARY],
      CATEGORIES
    )

    // January paper by paper, problem 1 there rather than in December, then December, the pool by its first category
    // in the order they run and then by number, the problem recommended for nothing last, then October and September
    expect(threadIds(ordered)).toEqual([
      'january c first',
      'january c again',
      'p1 first',
      'p1 again',
      'p2',
      'january b',
      'p3',
      'december c',
      'p4',
      'p5',
      'for a',
      'for b and c',
      'for c',
      'later for c',
      'for nothing',
      'october c',
      'p6',
      'september a',
      'p7',
    ])
  })

  it("runs a pool problem recommended for a draft's paper with no category after the categories' problems, and one recommended for a finalized board's with the problems recommended for nothing", () => {
    // A finalized board and a draft, each with one paper with no category and no problem in it
    const school: Board = {
      id: 'school',
      name: 'School',
      papers: [{ id: 'school-paper', name: 'School', category: null, slots: [] }],
      cycle: { name: 'School', opensAt: '2026-11-01T08:00:00.000Z', stage: 'finalized' },
    }
    const warmUp: Board = {
      id: 'warm-up',
      name: 'Warm-up',
      papers: [{ id: 'warm-up-paper', name: 'Warm-up', category: null, slots: [] }],
      cycle: null,
    }

    // The pool's problems: one for nothing, one for the finalized board's paper, one for the draft's, one for C
    const [forNothing, forSchool, forWarmUp, forC] = [
      proposal(1),
      proposal(2, { recommendedPapers: ['school-paper'] }),
      proposal(3, { recommendedPapers: ['warm-up-paper'] }),
      proposal(4, { recommended: ['C'] }),
    ].map((problem): DiscussedSubject => ({ kind: 'proposal', proposal: problem }))

    // A thread on each, newest activity first
    const threads = [
      thread('for c', 4, forC),
      thread('for warm-up', 3, forWarmUp),
      thread('for school', 2, forSchool),
      thread('for nothing', 1, forNothing),
    ]

    // The threads by problem
    const ordered = threadsInOrder(threads, 'problem', [school, warmUp], CATEGORIES)

    // C's problem, the draft paper's, then the rest by number, the finalized paper's among them
    expect(threadIds(ordered)).toEqual(['for c', 'for warm-up', 'for nothing', 'for school'])
  })
})
