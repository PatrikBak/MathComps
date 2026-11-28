import { describe, expect, it } from 'vitest'

import { commentDto } from '@/components/features/comments/model/__tests__/support/comment-fixtures'

import { OPEN_POOL_FILTER, type PoolFilter } from '../pool-filter'
import { matchDiscussions } from '../pool-matches'
import { recommendationTargetsOf } from '../recommendation-targets'
import type { DiscussedSubject, Discussion } from '../selection-discussions'
import type { Board } from '../selection-types'
import { MATHCOMPS, MATHCOMPS_CATEGORIES, proposal, threadIds } from './support/pool-fixtures'

/** A draft board named December: problem 1 in its elementary paper, Starters, problem 2 in its intermediate one. */
const DRAFT: Board = {
  id: 'draft',
  name: 'December',
  papers: [
    { id: 'elementary-paper', name: 'Starters', category: 'elementary', slots: ['p1', null] },
    { id: 'intermediate-paper', name: 'I', category: 'intermediate', slots: ['p2'] },
  ],
  cycle: null,
}

/** A board finalized into October's rounds, its advanced paper holding problem 7, which the round took. */
const FINALIZED: Board = {
  id: 'finalized',
  name: 'October',
  papers: [{ id: 'advanced-paper', name: 'A', category: 'advanced', slots: ['p7'] }],
  cycle: { name: 'October', opensAt: '2026-10-20T08:00:00.000Z', stage: 'finalized' },
}

/**
 * The selection's discussions: problem 1's thread of three comments, one a reply to a reply, problem 2's two threads,
 * one holding a deleted reply, the set-aside problem 3's thread of two, the taken problem 7's, the elementary paper's
 * thread of two and the finalized board's paper's, whose comment names problem 2.
 */
const DISCUSSIONS: Discussion<DiscussedSubject>[] = [
  {
    subject: { kind: 'proposal', proposal: proposal(1, { recommendedCategories: ['elementary'] }) },
    comments: [commentDto('easy', 1, [commentDto('agreed', 2, [commentDto('too easy', 3)])])],
  },
  {
    subject: {
      kind: 'proposal',
      proposal: proposal(2, { area: 'geometry', recommendedCategories: ['intermediate'] }),
    },
    comments: [
      commentDto('lovely', 4, [{ ...commentDto('withdrawn', 6, [], ''), isDeleted: true }]),
      commentDto('known', 5, [commentDto('opener', 6, [], 'Fine as the Opener of day two.')]),
    ],
  },
  {
    subject: {
      kind: 'proposal',
      proposal: proposal(3, { recommendedCategories: ['elementary'], isSetAside: true }),
    },
    comments: [commentDto('broken', 7, [commentDto('fixable', 7)])],
  },
  {
    subject: {
      kind: 'proposal',
      proposal: proposal(7, {
        area: 'geometry',
        recommendedCategories: ['advanced'],
        isUsed: true,
      }),
    },
    comments: [commentDto('taken', 8)],
  },
  {
    subject: { kind: 'paper', paper: DRAFT.papers[0], board: DRAFT },
    comments: [commentDto('paper', 9, [commentDto('needs an easier opener', 10)])],
  },
  {
    subject: { kind: 'paper', paper: FINALIZED.papers[0], board: FINALIZED },
    comments: [commentDto('finalized paper', 11, [], 'Swap #2 for something harder.')],
  },
]

describe('matchDiscussions', () => {
  it("shows every live thread, a taken problem's and a finalized board's paper's among them, weighing each by its comments", () => {
    // Every thread, filtered by nothing, the draft board on screen
    const matches = matchDiscussions(DISCUSSIONS, OPEN_POOL_FILTER, DRAFT, MATHCOMPS, [])

    // Every thread but the set-aside problem's, newest activity first
    expect(threadIds(matches.shown)).toEqual([
      'finalized paper',
      'paper',
      'taken',
      'known',
      'lovely',
      'easy',
    ])

    // The set-aside problem's kept out
    expect(threadIds(matches.hidden)).toEqual(['broken'])

    // The comments still standing under each category, a paper's thread counting toward its paper's category
    expect(matches.targetCounts).toEqual({ elementary: 5, intermediate: 3, advanced: 2 })

    // The comments still standing under each area, a paper's thread under none
    expect(matches.areaCounts).toEqual({
      algebra: 3,
      combinatorics: 0,
      geometry: 4,
      numberTheory: 0,
    })

    // The comments still standing each way, the papers' threads as whole papers
    expect(matches.standingCounts).toEqual({ selected: 6, notSelected: 1, wholePaper: 3 })

    // The set-aside problem's comments counted on their own
    expect(matches.setAsideCount).toBe(2)
  })

  it("narrows a paper's thread by its paper's category, drops it under any area and from the set-aside view, and shows it only under a whole paper or no State pick", () => {
    // A function which names the threads a filter shows, a board on screen
    const shownUnder = (filter: Partial<PoolFilter>, board: Board = DRAFT) =>
      threadIds(
        matchDiscussions(DISCUSSIONS, { ...OPEN_POOL_FILTER, ...filter }, board, MATHCOMPS, [])
          .shown
      )

    // The elementary category keeps its paper's thread beside its problem's
    expect(shownUnder({ targets: ['elementary'] })).toEqual(['paper', 'easy'])

    // Algebra drops every paper's thread
    expect(shownUnder({ areas: ['algebra'] })).toEqual(['easy'])

    // A whole paper shows only the papers' threads, the finalized board's among them
    expect(shownUnder({ standing: 'wholePaper' })).toEqual(['finalized paper', 'paper'])

    // On the draft board, the problems it holds
    expect(shownUnder({ standing: 'selected' })).toEqual(['known', 'lovely', 'easy'])

    // Off the draft board, the problem a round took
    expect(shownUnder({ standing: 'notSelected' })).toEqual(['taken'])

    // On the finalized board, the problem its round took
    expect(shownUnder({ standing: 'selected' }, FINALIZED)).toEqual(['taken'])

    // The set-aside problems' threads alone, no paper's among them
    expect(shownUnder({ isShowingSetAside: true })).toEqual(['broken'])

    // The threads under algebra
    const algebra = matchDiscussions(
      DISCUSSIONS,
      { ...OPEN_POOL_FILTER, areas: ['algebra'] },
      DRAFT,
      MATHCOMPS,
      []
    )

    // The algebra threads' comments counted on the board, none off it or for a whole paper
    expect(algebra.standingCounts).toEqual({ selected: 3, notSelected: 0, wholePaper: 0 })
  })

  it("finds a problem's threads as it finds the problem, a paper's by its names but never by #number, any by its comments", () => {
    // Searched by problem 2's number
    const byNumber = matchDiscussions(
      DISCUSSIONS,
      { ...OPEN_POOL_FILTER, query: '#2' },
      DRAFT,
      MATHCOMPS,
      []
    )

    // Both of problem 2's threads, and not the paper's thread naming it
    expect(threadIds(byNumber.shown)).toEqual(['known', 'lovely'])

    // Searched by problem 7's bare number, which no comment says
    const byBareNumber = matchDiscussions(
      DISCUSSIONS,
      { ...OPEN_POOL_FILTER, query: '7' },
      DRAFT,
      MATHCOMPS,
      []
    )

    // The taken problem's thread, found by its number as the problem is
    expect(threadIds(byBareNumber.shown)).toEqual(['taken'])

    // Searched by problem 1's name, which no comment says
    const byName = matchDiscussions(
      DISCUSSIONS,
      { ...OPEN_POOL_FILTER, query: 'problem 1' },
      DRAFT,
      MATHCOMPS,
      []
    )

    // Problem 1's thread
    expect(threadIds(byName.shown)).toEqual(['easy'])

    // Searched by the draft board's name
    const byBoard = matchDiscussions(
      DISCUSSIONS,
      { ...OPEN_POOL_FILTER, query: 'december' },
      DRAFT,
      MATHCOMPS,
      []
    )

    // The draft board's paper's thread
    expect(threadIds(byBoard.shown)).toEqual(['paper'])

    // Searched by the elementary paper's name
    const byPaper = matchDiscussions(
      DISCUSSIONS,
      { ...OPEN_POOL_FILTER, query: 'starters' },
      DRAFT,
      MATHCOMPS,
      []
    )

    // The elementary paper's thread
    expect(threadIds(byPaper.shown)).toEqual(['paper'])

    // Searched by what a reply to a reply says
    const byDeepReply = matchDiscussions(
      DISCUSSIONS,
      { ...OPEN_POOL_FILTER, query: 'too easy' },
      DRAFT,
      MATHCOMPS,
      []
    )

    // Problem 1's thread, which holds the reply to a reply
    expect(threadIds(byDeepReply.shown)).toEqual(['easy'])

    // Searched by a word a reply in each of two threads says, in another case
    const byText = matchDiscussions(
      DISCUSSIONS,
      { ...OPEN_POOL_FILTER, query: 'OPENER' },
      DRAFT,
      MATHCOMPS,
      []
    )

    // The elementary paper's thread and problem 2's second thread, each by its reply
    expect(threadIds(byText.shown)).toEqual(['paper', 'known'])

    // Problem 2's other thread kept out with the rest
    expect(threadIds(byText.hidden)).toContain('lovely')
  })

  it("counts a thread about a draft's paper with no category toward that paper", () => {
    // A draft whose one paper, the warm-up, has no category
    const warmUp: Board = {
      id: 'warm-up',
      name: 'Warm-up',
      papers: [{ id: 'warm-up-paper', name: 'Warm-up', category: null, slots: [] }],
      cycle: null,
    }

    // A thread about the warm-up paper, and problem 1's, recommended for elementary
    const discussions: Discussion<DiscussedSubject>[] = [
      {
        subject: { kind: 'paper', paper: warmUp.papers[0], board: warmUp },
        comments: [commentDto('warm-up', 1)],
      },
      {
        subject: {
          kind: 'proposal',
          proposal: proposal(1, { recommendedCategories: ['elementary'] }),
        },
        comments: [commentDto('easy', 2)],
      },
    ]

    // The threads narrowed to the warm-up paper
    const matches = matchDiscussions(
      discussions,
      { ...OPEN_POOL_FILTER, targets: ['warm-up-paper'] },
      warmUp,
      recommendationTargetsOf(MATHCOMPS_CATEGORIES, [warmUp]),
      []
    )

    // The paper's thread alone
    expect(threadIds(matches.shown)).toEqual(['warm-up'])

    // The paper's comment counted toward the paper, problem 1's toward elementary
    expect(matches.targetCounts).toEqual({
      elementary: 1,
      intermediate: 0,
      advanced: 0,
      'warm-up-paper': 1,
    })
  })

  it('finds a thread laid out before by what it said then and by what was posted in it since, whatever an edit says, and one laid out afresh by what it says now', () => {
    // The threads revised since: problem 2's first comment edited away from "lovely", the taken problem's comment
    // edited into it, and a reply saying it posted on the elementary paper's thread
    const revised = new Map([
      ['lovely', commentDto('lovely edited', 4, [], 'Meh.')],
      ['taken', commentDto('taken edited', 8, [], 'Lovely too.')],
      [
        'paper',
        commentDto('paper', 9, [
          commentDto('needs an easier opener', 10),
          commentDto('Lovely set.', 12),
        ]),
      ],
    ])

    // The discussions as they stand since
    const since = DISCUSSIONS.map((discussion) => ({
      ...discussion,
      comments: discussion.comments.map((comment) => revised.get(comment.id) ?? comment),
    }))

    // A search for "lovely"
    const filter = { ...OPEN_POOL_FILTER, query: 'lovely' }

    // Searched against the discussions as they were laid out
    const asLaidOut = matchDiscussions(since, filter, DRAFT, MATHCOMPS, DISCUSSIONS)

    // The elementary paper's thread by its new reply and problem 2's by what it said, never the taken problem's by
    // its edit
    expect(threadIds(asLaidOut.shown)).toEqual(['paper', 'lovely edited'])

    // Searched as laid out afresh
    const afresh = matchDiscussions(since, filter, DRAFT, MATHCOMPS, [])

    // Each thread by what it says now
    expect(threadIds(afresh.shown)).toEqual(['paper', 'taken edited'])
  })
})
