import { describe, expect, it } from 'vitest'

import {
  comment,
  commentDto,
} from '@/components/features/comments/model/__tests__/support/comment-fixtures'
import type { CommentNewness } from '@/components/features/comments/model/comment-newness'

import { OPEN_POOL_FILTER } from '../pool-filters'
import {
  advanceMarks,
  holdMarks,
  type KeptMarks,
  marksAnyShownNew,
  newCountAcross,
  poolDiscussionPartsOf,
  releaseMarks,
  seenUpToOf,
  seenWriteOf,
  type ServerMarks,
  serverMarksOf,
  withSeenUpTo,
} from '../seen-marks'
import type { Board } from '../selection-types'

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

/** No discussion marked on the server. */
const UNMARKED: ServerMarks = new Map()

describe('seenWriteOf', () => {
  it('marks each discussion up to its newest comment by someone else, across its threads', () => {
    // The write for the first problem's discussion as three threads, the newest post a reply under the middle one,
    // beside a paper's discussion holding an older comment
    const write = seenWriteOf({
      view: {
        shown: [
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
        hidden: [],
      },
      server: UNMARKED,
      readerId: READER,
    })

    // The problem up to the reply, the paper up to its own comment
    expect(write).toEqual({
      proposals: { first: '2026-10-03T08:00:00.000Z' },
      papers: { paper: '2026-09-25T08:00:00.000Z' },
    })
  })

  it("leaves out a discussion showing only the reader's own comments and deleted ones", () => {
    // The write for a problem's discussion holding the reader's comment and a deleted one of Zuzana's, beside one of
    // hers standing
    const write = seenWriteOf({
      view: {
        shown: [
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
        hidden: [],
      },
      server: UNMARKED,
      readerId: READER,
    })

    // Only the discussion with Zuzana's standing comment
    expect(write).toEqual({ proposals: { first: '2026-10-01T08:00:00.000Z' }, papers: {} })
  })

  it('sees a discussion only up to just before the oldest comment new to the reader in a thread the view hides', () => {
    // The first problem seen up to the start of October
    const server: ServerMarks = new Map([
      [FIRST, { seenUpTo: Date.parse('2026-10-01T00:00:00.000Z'), newCount: 2 }],
    ])

    // One of the first problem's threads shown, holding Zuzana's comment of the fifth; another hidden, holding
    // Martin's comment seen in September and Zuzana's reply under it of the third, new
    const view = {
      shown: [
        {
          target: { targetType: 'Proposal' as const, targetId: 'first' },
          comments: [comment('shown', 'user_zuzana', '2026-10-05T08:00:00.000Z')],
        },
      ],
      hidden: [
        {
          target: { targetType: 'Proposal' as const, targetId: 'first' },
          comments: [
            comment('hidden', 'user_martin', '2026-09-20T08:00:00.000Z', [
              comment('reply', 'user_zuzana', '2026-10-03T08:00:00.000Z'),
            ]),
          ],
        },
      ],
    }

    // The write against the server's marks
    const write = seenWriteOf({ view, server, readerId: READER })

    // Seen up to a moment before the hidden reply, so it stays new
    expect(write.proposals).toEqual({ first: '2026-10-03T07:59:59.999Z' })

    // The write for the same view with a second hidden thread, holding Martin's comment of the second
    const writeHidingTwo = seenWriteOf({
      view: {
        ...view,
        hidden: [
          ...view.hidden,
          {
            target: { targetType: 'Proposal', targetId: 'first' },
            comments: [comment('older', 'user_martin', '2026-10-02T08:00:00.000Z')],
          },
        ],
      },
      server,
      readerId: READER,
    })

    // Seen up to a moment before the oldest of the hidden new comments, whichever thread holds it
    expect(writeHidingTwo.proposals).toEqual({ first: '2026-10-02T07:59:59.999Z' })
  })

  it('sees a discussion up to its newest comment shown where its hidden threads hold nothing new before it, and leaves out one it only hides', () => {
    // The first problem seen up to the start of October, the second never seen
    const server: ServerMarks = new Map([
      [FIRST, { seenUpTo: Date.parse('2026-10-01T00:00:00.000Z'), newCount: 1 }],
      [SECOND, { seenUpTo: null, newCount: 2 }],
    ])

    // The write for the two problems shown, each with Zuzana's comment of the fifth; the first hiding the reader's own
    // of the third, the second Martin's of the seventh, and a third problem shown nowhere hiding Martin's of the second
    const write = seenWriteOf({
      view: {
        shown: [
          {
            target: { targetType: 'Proposal', targetId: 'first' },
            comments: [comment('first shown', 'user_zuzana', '2026-10-05T08:00:00.000Z')],
          },
          {
            target: { targetType: 'Proposal', targetId: 'second' },
            comments: [comment('second shown', 'user_zuzana', '2026-10-05T08:00:00.000Z')],
          },
        ],
        hidden: [
          {
            target: { targetType: 'Proposal', targetId: 'first' },
            comments: [comment('own', READER, '2026-10-03T08:00:00.000Z')],
          },
          {
            target: { targetType: 'Proposal', targetId: 'second' },
            comments: [comment('later', 'user_martin', '2026-10-07T08:00:00.000Z')],
          },
          {
            target: { targetType: 'Proposal', targetId: 'third' },
            comments: [comment('elsewhere', 'user_martin', '2026-10-02T08:00:00.000Z')],
          },
        ],
      },
      server,
      readerId: READER,
    })

    // Both shown problems up to the comment they show, the third left out
    expect(write).toEqual({
      proposals: { first: '2026-10-05T08:00:00.000Z', second: '2026-10-05T08:00:00.000Z' },
      papers: {},
    })
  })
})

describe('marksAnyShownNew', () => {
  it('reads a view as marking a comment it shows as new only where no new comment in a thread it hides came before it', () => {
    // The start of October, up to which the first problem is seen, as the server and the view hold it
    const october = Date.parse('2026-10-01T00:00:00.000Z')

    // The server's mark on the first problem
    const server: ServerMarks = new Map([[FIRST, { seenUpTo: october, newCount: 2 }]])

    // A function which tells how far the reader has seen the first problem, as the view holds it
    const newnessOf = (): CommentNewness => ({ kind: 'seen', seenUpTo: october })

    // A function which builds a view showing Zuzana's comment of the fifth and hiding Martin's, posted at a given moment
    const hiding = (postedAt: string) => ({
      shown: [
        {
          target: { targetType: 'Proposal' as const, targetId: 'first' },
          comments: [comment('shown', 'user_zuzana', '2026-10-05T08:00:00.000Z')],
        },
      ],
      hidden: [
        {
          target: { targetType: 'Proposal' as const, targetId: 'first' },
          comments: [comment('hidden', 'user_martin', postedAt)],
        },
      ],
    })

    // Hiding a new comment of the third, older than the one shown, so marking stops short of the one shown
    expect(
      marksAnyShownNew(
        { view: hiding('2026-10-03T08:00:00.000Z'), server, readerId: READER },
        newnessOf
      )
    ).toBe(false)

    // Hiding one of the seventh, newer, so marking reaches the one shown
    expect(
      marksAnyShownNew(
        { view: hiding('2026-10-07T08:00:00.000Z'), server, readerId: READER },
        newnessOf
      )
    ).toBe(true)
  })
})

describe('poolDiscussionPartsOf', () => {
  it("shows the threads the filter lets through and hides the rest, each read under its discussion's target", () => {
    // A draft board with an elementary paper and an advanced one
    const board: Board = {
      id: 'board',
      name: 'December',
      papers: [
        { id: 'easy', name: 'Starters', category: 'elementary', slots: [] },
        { id: 'hard', name: 'Finals', category: 'advanced', slots: [] },
      ],
      finalization: null,
    }

    // Each paper's discussion, holding one comment of Zuzana's
    const discussions = board.papers.map((paper, index) => ({
      subject: { kind: 'paper' as const, paper, board },
      comments: [commentDto(paper.id, index + 1)],
    }))

    // What the pool shows of the papers' discussions, narrowed to the elementary category
    const view = poolDiscussionPartsOf(
      discussions,
      { ...OPEN_POOL_FILTER, categories: ['elementary'] },
      board,
      [
        { name: 'elementary', hostedCategory: 'elementary' },
        { name: 'advanced', hostedCategory: 'advanced' },
      ],
      READER
    )

    // The elementary paper's thread shown, the advanced paper's hidden, each with its comment
    expect(
      [view.shown, view.hidden].map((parts) =>
        parts.map(({ target, comments }) => [target, comments.map(({ id }) => id)])
      )
    ).toEqual([
      [[{ targetType: 'SelectionPaper', targetId: 'easy' }, ['easy']]],
      [[{ targetType: 'SelectionPaper', targetId: 'hard' }, ['hard']]],
    ])
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
