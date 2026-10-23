import { describe, expect, it } from 'vitest'

import { comment } from '@/components/features/comments/model/__tests__/support/comment-fixtures'

import { hasNewsIn, seenWriteOf, type ServerMarks, withSeenUpTo } from '../seen-marks'

/** The key of the first problem's discussion. */
const FIRST = 'Proposal:first'

/** The key of the second problem's discussion. */
const SECOND = 'Proposal:second'

/** The reader. */
const READER = 'user_rita'

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
    // A problem seen past its answer, one seen short of it, one the answer leaves out, and a paper the cached marks
    // don't hold yet
    const cached = {
      proposals: {
        ahead: { seenUpTo: '2026-10-12T08:00:00.000Z', lastPostedByOthersAt: null },
        behind: {
          seenUpTo: '2026-10-01T08:00:00.000Z',
          lastPostedByOthersAt: '2026-10-05T08:00:00.000Z',
        },
        unanswered: { seenUpTo: null, lastPostedByOthersAt: '2026-10-05T08:00:00.000Z' },
      },
      papers: {},
    }

    // Three marked, each at its own moment, the one ahead answered short of its mark
    const marked = withSeenUpTo(cached, {
      proposals: { ahead: '2026-10-10T08:00:00.000Z', behind: '2026-10-08T08:00:00.000Z' },
      papers: { fresh: '2026-10-10T08:00:00.000Z' },
    })

    // The mark ahead kept, the one behind moved up to its answer with its last post kept, the unanswered one as it
    // was, the paper marked with none
    expect(marked).toEqual({
      proposals: {
        ahead: { seenUpTo: '2026-10-12T08:00:00.000Z', lastPostedByOthersAt: null },
        behind: {
          seenUpTo: '2026-10-08T08:00:00.000Z',
          lastPostedByOthersAt: '2026-10-05T08:00:00.000Z',
        },
        unanswered: { seenUpTo: null, lastPostedByOthersAt: '2026-10-05T08:00:00.000Z' },
      },
      papers: { fresh: { seenUpTo: '2026-10-10T08:00:00.000Z', lastPostedByOthersAt: null } },
    })
  })
})

describe('hasNewsIn', () => {
  it('finds news posted after the mark, and anywhere the reader has seen nothing', () => {
    // One discussion seen up to 100 and one never seen, somebody else posting in each at 200
    const server: ServerMarks = new Map([
      [FIRST, { seenUpTo: 100, lastPostedByOthersAt: 200 }],
      [SECOND, { seenUpTo: null, lastPostedByOthersAt: 200 }],
    ])

    // News in both
    expect([hasNewsIn(server, FIRST), hasNewsIn(server, SECOND)]).toEqual([true, true])
  })

  it('finds nothing new where nobody else posted, nor where the last post is the mark itself', () => {
    // One discussion nobody else posted in, one seen exactly up to its last post
    const server: ServerMarks = new Map([
      [FIRST, { seenUpTo: null, lastPostedByOthersAt: null }],
      [SECOND, { seenUpTo: 200, lastPostedByOthersAt: 200 }],
    ])

    // Nothing new in either, nor in one the server knows nothing of
    expect([
      hasNewsIn(server, FIRST),
      hasNewsIn(server, SECOND),
      hasNewsIn(server, 'Proposal:unknown'),
    ]).toEqual([false, false, false])
  })
})
