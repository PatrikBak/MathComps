import { describe, expect, it } from 'vitest'

import { hasNewsIn, type ServerMarks, withSeenUpTo } from '../seen-marks'

/** The key of the first problem's discussion. */
const FIRST = 'Proposal:first'

/** The key of the second problem's discussion. */
const SECOND = 'Proposal:second'

describe('withSeenUpTo', () => {
  it('moves a mark up to the answered moment, leaves one further along, and adds one never cached', () => {
    // A problem seen past the moment, one seen short of it, and a paper the cached marks don't hold yet
    const cached = {
      proposals: {
        ahead: { seenUpTo: '2026-10-12T08:00:00.000Z', lastPostedByOthersAt: null },
        behind: {
          seenUpTo: '2026-10-01T08:00:00.000Z',
          lastPostedByOthersAt: '2026-10-05T08:00:00.000Z',
        },
      },
      papers: {},
    }

    // All three marked, the server answering an earlier moment than the mark ahead
    const marked = withSeenUpTo(
      cached,
      {
        proposalIds: ['ahead', 'behind'],
        paperIds: ['fresh'],
        seenUpTo: '2026-10-10T08:00:00.000Z',
      },
      '2026-10-10T08:00:00.000Z'
    )

    // The mark ahead kept, the one behind moved up with its last post kept, the paper marked with none
    expect(marked).toEqual({
      proposals: {
        ahead: { seenUpTo: '2026-10-12T08:00:00.000Z', lastPostedByOthersAt: null },
        behind: {
          seenUpTo: '2026-10-10T08:00:00.000Z',
          lastPostedByOthersAt: '2026-10-05T08:00:00.000Z',
        },
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
