import { describe, expect, it } from 'vitest'

import { comment } from '@/components/features/comments/model/__tests__/support/comment-fixtures'

import {
  advanceMarks,
  holdMarks,
  type KeptMarks,
  newCountAcross,
  releaseMarks,
  seenUpToOf,
  seenWriteOf,
  type ServerMarks,
  serverMarksOf,
  withSeenUpTo,
} from '../seen-marks'

/** The key of the first problem's discussion. */
const FIRST = 'Proposal:first'

/** The key of the second problem's discussion. */
const SECOND = 'Proposal:second'

/** The key of the third problem's discussion. */
const THIRD = 'Proposal:third'

/** The key of a paper's discussion. */
const PAPER = 'SelectionPaper:paper'

/** The reader. */
const READER = 'user_rita'

/**
 * The server's marks: the first problem seen up to 100, the second never seen, a comment by somebody else new in each.
 */
const SERVER: ServerMarks = new Map([
  [FIRST, { seenUpTo: 100, newCount: 1 }],
  [SECOND, { seenUpTo: null, newCount: 1 }],
])

/** The server's marks once told both problems were seen, holding both at 300 with nothing new. */
const TOLD: ServerMarks = new Map([
  [FIRST, { seenUpTo: 300, newCount: 0 }],
  [SECOND, { seenUpTo: 300, newCount: 0 }],
])

/** Nothing kept yet. */
const NONE: KeptMarks = new Map()

describe('seenWriteOf', () => {
  it('marks each discussion up to its newest comment by someone else, across its threads', () => {
    // The first problem's discussion as three threads, the newest post a reply under the middle one, beside a
    // paper's discussion holding an older comment
    const write = seenWriteOf(
      [
        {
          target: { targetType: 'Proposal', targetId: 'first' },
          comments: [comment('opening', 'user_zuzana', '2026-10-01T08:00:00.000Z')],
        },
        {
          target: { targetType: 'SelectionPaper', targetId: 'paper' },
          comments: [comment('remark', 'user_martin', '2026-09-25T08:00:00.000Z')],
        },
        {
          target: { targetType: 'Proposal', targetId: 'first' },
          comments: [
            comment('second', 'user_zuzana', '2026-10-02T08:00:00.000Z', [
              comment('reply', 'user_martin', '2026-10-03T08:00:00.000Z'),
            ]),
          ],
        },
        {
          target: { targetType: 'Proposal', targetId: 'first' },
          comments: [comment('third', 'user_zuzana', '2026-10-02T12:00:00.000Z')],
        },
      ],
      READER
    )

    // The problem up to the reply, the paper up to its own comment
    expect(write).toEqual({
      proposals: { first: '2026-10-03T08:00:00.000Z' },
      papers: { paper: '2026-09-25T08:00:00.000Z' },
    })
  })

  it("leaves out a discussion showing only the reader's own comments and deleted ones", () => {
    // A problem's discussion holding the reader's comment and a deleted one of Zuzana's, beside one of hers standing
    const write = seenWriteOf(
      [
        {
          target: { targetType: 'Proposal', targetId: 'own' },
          comments: [
            comment('mine', READER, '2026-10-05T08:00:00.000Z'),
            { ...comment('gone', 'user_zuzana', '2026-10-04T08:00:00.000Z'), isDeleted: true },
          ],
        },
        {
          target: { targetType: 'Proposal', targetId: 'first' },
          comments: [comment('opening', 'user_zuzana', '2026-10-01T08:00:00.000Z')],
        },
      ],
      READER
    )

    // Only the discussion with Zuzana's standing comment
    expect(write).toEqual({ proposals: { first: '2026-10-01T08:00:00.000Z' }, papers: {} })
  })
})

describe('withSeenUpTo', () => {
  it('moves a mark to its answer, keeps one further along or unanswered, adds one never cached', () => {
    // A problem seen past its answer, one seen short of it with three posts since, one the answer leaves out, and a
    // paper the cached marks don't hold yet
    const cached = {
      proposals: {
        ahead: { seenUpTo: '2026-10-12T08:00:00.000Z', newPostedAt: [] },
        behind: {
          seenUpTo: '2026-10-01T08:00:00.000Z',
          newPostedAt: [
            '2026-10-05T08:00:00.000Z',
            '2026-10-08T08:00:00.000Z',
            '2026-10-09T08:00:00.000Z',
          ],
        },
        unanswered: { seenUpTo: null, newPostedAt: ['2026-10-05T08:00:00.000Z'] },
      },
      papers: {},
    }

    // Three marked, each at its own moment, the one ahead answered short of its mark
    const marked = withSeenUpTo(cached, {
      proposals: { ahead: '2026-10-10T08:00:00.000Z', behind: '2026-10-08T08:00:00.000Z' },
      papers: { fresh: '2026-10-10T08:00:00.000Z' },
    })

    // The mark ahead kept, the one behind moved up to its answer with only the post after it still new, the
    // unanswered one as it was, the paper marked with nothing new
    expect(marked).toEqual({
      proposals: {
        ahead: { seenUpTo: '2026-10-12T08:00:00.000Z', newPostedAt: [] },
        behind: { seenUpTo: '2026-10-08T08:00:00.000Z', newPostedAt: ['2026-10-09T08:00:00.000Z'] },
        unanswered: { seenUpTo: null, newPostedAt: ['2026-10-05T08:00:00.000Z'] },
      },
      papers: { fresh: { seenUpTo: '2026-10-10T08:00:00.000Z', newPostedAt: [] } },
    })
  })
})

describe('kept marks', () => {
  it("keeps the server's mark while a visit holds it, however the server's moves on", () => {
    // A visit to the pool's tab showing both discussions
    const kept = holdMarks(NONE, 'pool', [FIRST, SECOND], SERVER)

    // Both still read as they were when the visit kept them, though the server holds both at 300
    expect([seenUpToOf(kept, TOLD, FIRST), seenUpToOf(kept, TOLD, SECOND)]).toEqual([100, null])
  })

  it('shares a mark a second visit keeps, and drops it only once the last visit lets go', () => {
    // A visit to the pool's tab keeping both problems' marks
    const pool = holdMarks(NONE, 'pool', [FIRST, SECOND], SERVER)

    // A visit to the first problem's own tab keeping its mark too, once the server was told both were seen
    const both = holdMarks(pool, 'problem', [FIRST], TOLD)

    // The second problem still as the pool kept it
    expect(seenUpToOf(both, TOLD, SECOND)).toBeNull()

    // The problem's visit ending
    const poolAlone = releaseMarks(both, 'problem')

    // The pool's visit ending too
    const neither = releaseMarks(poolAlone, 'pool')

    // The first problem read as the pool kept it until the last visit ends, then as the server holds it
    expect([
      seenUpToOf(both, TOLD, FIRST),
      seenUpToOf(poolAlone, TOLD, FIRST),
      seenUpToOf(neither, TOLD, FIRST),
    ]).toEqual([100, 100, 300])
  })

  it('moves each kept mark seen on to its own moment, keeping one further along and leaving the rest', () => {
    // The two problems as the server holds them, beside a third seen up to 50 and a paper seen up to 400
    const server: ServerMarks = new Map([
      ...SERVER,
      [THIRD, { seenUpTo: 50, newCount: 1 }],
      [PAPER, { seenUpTo: 400, newCount: 0 }],
    ])

    // All four kept by a visit to the pool's tab
    const kept = holdMarks(NONE, 'pool', [FIRST, SECOND, THIRD, PAPER], server)

    // The first problem seen up to 250, the never seen second up to 150 and the paper up to 300
    const advanced = advanceMarks(kept, {
      proposals: { first: '1970-01-01T00:00:00.250Z', second: '1970-01-01T00:00:00.150Z' },
      papers: { paper: '1970-01-01T00:00:00.300Z' },
    })

    // Both problems seen moved on, the third left as kept, the paper left further along
    expect([FIRST, SECOND, THIRD, PAPER].map((key) => seenUpToOf(advanced, server, key))).toEqual([
      250, 150, 50, 400,
    ])
  })
})

describe('newCountAcross', () => {
  it('counts what is still new in every discussion once a write moved one mark part way', () => {
    // A problem never seen with three posts by others, a paper never seen with one, and a problem with nothing new
    const cached = {
      proposals: {
        first: {
          seenUpTo: null,
          newPostedAt: [
            '2026-10-05T08:00:00.000Z',
            '2026-10-07T08:00:00.000Z',
            '2026-10-09T08:00:00.000Z',
          ],
        },
        second: { seenUpTo: '2026-10-01T08:00:00.000Z', newPostedAt: [] },
      },
      papers: { paper: { seenUpTo: null, newPostedAt: ['2026-10-06T08:00:00.000Z'] } },
    }

    // The first problem seen up to its oldest post, as a visit leaving the newer ones waiting would mark it
    const marked = withSeenUpTo(cached, {
      proposals: { first: '2026-10-05T08:00:00.000Z' },
      papers: {},
    })

    // The newer posts of the first problem and the paper's post
    expect(newCountAcross(serverMarksOf(marked))).toBe(3)
  })
})
