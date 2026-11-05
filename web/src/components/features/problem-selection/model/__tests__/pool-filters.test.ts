import { describe, expect, it } from 'vitest'

import { commentDto } from '@/components/features/comments/model/__tests__/support/comment-fixtures'

import {
  matchDiscussions,
  matchPool,
  OPEN_POOL_FILTER,
  type PoolFilter,
  withListedCategories,
} from '../pool-filters'
import type { DiscussedSubject, Discussion, DiscussionThread } from '../selection-discussions'
import type { Board, Proposal, SelectionCategory } from '../selection-types'

/** MathComps' categories, each a hosted level. */
const MATHCOMPS: SelectionCategory[] = [
  { name: 'elementary', hostedCategory: 'elementary' },
  { name: 'intermediate', hostedCategory: 'intermediate' },
  { name: 'advanced', hostedCategory: 'advanced' },
]

/** The olympiad's categories, easiest first, none of them a hosted level. */
const OLYMPIAD: SelectionCategory[] = [
  { name: 'C', hostedCategory: null },
  { name: 'B', hostedCategory: null },
  { name: 'A', hostedCategory: null },
]

/**
 * A live proposal in the pool, numbered and named after its number unless told otherwise.
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

describe('matchPool', () => {
  it('shows the live problems no round has taken', () => {
    // Problem 2 sits in a round; 3 and 1 sit in none
    const proposals = [proposal(3), proposal(2, { isUsed: true }), proposal(1)]

    // The pool, filtered by nothing
    const matches = matchPool(proposals, OPEN_POOL_FILTER, null, MATHCOMPS)

    // 1 and 3, in order
    expect(matches.shown.map((shown) => shown.number)).toEqual([1, 3])
  })

  it("counts each facet's options under the other filters but not its own", () => {
    // Geometry for advanced, algebra for elementary, geometry for elementary
    const proposals = [
      proposal(1, { area: 'geometry', recommended: ['advanced'] }),
      proposal(2, { area: 'algebra', recommended: ['elementary'] }),
      proposal(3, { area: 'geometry', recommended: ['elementary'] }),
    ]

    // The pool narrowed to the advanced category
    const matches = matchPool(
      proposals,
      { ...OPEN_POOL_FILTER, categories: ['advanced'] },
      null,
      MATHCOMPS
    )

    // Only problem 1 shows
    expect(matches.shown.map((shown) => shown.number)).toEqual([1])

    // The categories still count the whole pool, their own filter left out
    expect(matches.categoryCounts).toEqual({ elementary: 2, intermediate: 0, advanced: 1 })

    // The areas count only what the category filter lets through
    expect(matches.areaCounts).toEqual({
      algebra: 0,
      combinatorics: 0,
      geometry: 1,
      numberTheory: 0,
    })

    // The pool narrowed to geometry instead
    const geometry = matchPool(
      proposals,
      { ...OPEN_POOL_FILTER, areas: ['geometry'] },
      null,
      MATHCOMPS
    )

    // The areas still count the whole pool, their own filter left out
    expect(geometry.areaCounts).toEqual({
      algebra: 1,
      combinatorics: 0,
      geometry: 2,
      numberTheory: 0,
    })
  })

  it('shows a problem recommended for any of the categories picked', () => {
    // One problem for advanced, one for elementary, one for nothing
    const proposals = [
      proposal(1, { recommended: ['advanced'] }),
      proposal(2, { recommended: ['elementary'] }),
      proposal(3),
    ]

    // The pool narrowed to elementary and advanced
    const matches = matchPool(
      proposals,
      { ...OPEN_POOL_FILTER, categories: ['elementary', 'advanced'] },
      null,
      MATHCOMPS
    )

    // Any category picked lets a problem through
    expect(matches.shown.map((shown) => shown.number)).toEqual([1, 2])
  })

  it('shows the set-aside problems in a view of their own, counted whatever the filters say', () => {
    // Problem 1 set aside, problem 2 live
    const proposals = [proposal(1, { isSetAside: true }), proposal(2)]

    // The set-aside view, searched for something nothing holds
    const searched = matchPool(
      proposals,
      { ...OPEN_POOL_FILTER, query: 'nowhere', isShowingSetAside: true },
      null,
      MATHCOMPS
    )

    // Nothing shows
    expect(searched.shown).toEqual([])

    // Yet the set-aside problem still counts
    expect(searched.setAsideCount).toBe(1)

    // The set-aside view, searched for nothing
    const open = matchPool(
      proposals,
      { ...OPEN_POOL_FILTER, isShowingSetAside: true },
      null,
      MATHCOMPS
    )

    // Only the set-aside problem shows
    expect(open.shown.map((shown) => shown.number)).toEqual([1])

    // The live view, searched for nothing
    const live = matchPool(proposals, OPEN_POOL_FILTER, null, MATHCOMPS)

    // Only the live problem shows
    expect(live.shown.map((shown) => shown.number)).toEqual([2])
  })

  it('shows the problems the board on screen holds, or those it does not, counting both under the other filters', () => {
    // Problems 1 and 2 in geometry, 3 in algebra
    const proposals = [
      proposal(1, { area: 'geometry' }),
      proposal(2, { area: 'geometry' }),
      proposal(3),
    ]

    // A board whose one paper holds problems 1 and 3 and an empty slot
    const board: Board = {
      id: 'october',
      name: 'October',
      papers: [{ id: 'e', name: 'E', category: 'elementary', slots: ['p1', null, 'p3'] }],
      finalization: null,
    }

    // The pool narrowed to what the board holds
    const selected = matchPool(
      proposals,
      { ...OPEN_POOL_FILTER, standing: 'selected' },
      board,
      MATHCOMPS
    )

    // Problems 1 and 3
    expect(selected.shown.map((shown) => shown.number)).toEqual([1, 3])

    // Every answer still counted over the whole pool, its own filter left out, and no problem as a whole paper
    expect(selected.standingCounts).toEqual({ selected: 2, notSelected: 1, wholePaper: 0 })

    // The pool narrowed to what the board does not hold
    const notSelected = matchPool(
      proposals,
      { ...OPEN_POOL_FILTER, standing: 'notSelected' },
      board,
      MATHCOMPS
    )

    // Problem 2 alone
    expect(notSelected.shown.map((shown) => shown.number)).toEqual([2])

    // The pool narrowed to geometry, on the board or off it
    const geometry = matchPool(
      proposals,
      { ...OPEN_POOL_FILTER, areas: ['geometry'] },
      board,
      MATHCOMPS
    )

    // Only the two geometry problems counted
    expect(geometry.standingCounts).toEqual({ selected: 1, notSelected: 1, wholePaper: 0 })
  })

  it("runs paper by paper: each paper's slots in order, then the rest recommended for its category by area", () => {
    // Problems recommended for elementary, for intermediate, for both, for advanced, or for nothing, in algebra unless
    // told otherwise
    const proposals = [
      proposal(1, { recommended: ['elementary'], area: 'geometry' }),
      proposal(2),
      proposal(3, { recommended: ['intermediate'] }),
      proposal(4, { area: 'numberTheory' }),
      proposal(5, { recommended: ['elementary'] }),
      proposal(6, { recommended: ['elementary', 'intermediate'] }),
      proposal(7, { recommended: ['intermediate'] }),
      proposal(8, { recommended: ['advanced'], area: 'combinatorics' }),
    ]

    // A board with no advanced paper, whose elementary paper holds 5 and 2 and whose intermediate paper holds 7
    const board: Board = {
      id: 'october',
      name: 'October',
      papers: [
        { id: 'e', name: 'E', category: 'elementary', slots: ['p5', null, 'p2'] },
        { id: 'i', name: 'I', category: 'intermediate', slots: ['p7'] },
      ],
      finalization: null,
    }

    // The pool, filtered by nothing
    const matches = matchPool(proposals, OPEN_POOL_FILTER, board, MATHCOMPS)

    // The elementary slots, the rest for elementary, the intermediate slot, the rest for intermediate, then what no
    // paper takes, each rest algebra first
    expect(matches.shown.map((shown) => shown.number)).toEqual([5, 2, 6, 1, 7, 3, 8, 4])
  })

  it('runs a problem under the first of its categories the filter picked', () => {
    // Problems 3 and 7 recommended for intermediate alone, problem 6 for elementary as well
    const proposals = [
      proposal(3, { recommended: ['intermediate'] }),
      proposal(6, { recommended: ['elementary', 'intermediate'] }),
      proposal(7, { recommended: ['intermediate'] }),
    ]

    // A board whose intermediate paper, after the elementary one, holds 7
    const board: Board = {
      id: 'october',
      name: 'October',
      papers: [
        { id: 'e', name: 'E', category: 'elementary', slots: [null] },
        { id: 'i', name: 'I', category: 'intermediate', slots: ['p7'] },
      ],
      finalization: null,
    }

    // The pool narrowed to intermediate
    const matches = matchPool(
      proposals,
      { ...OPEN_POOL_FILTER, categories: ['intermediate'] },
      board,
      MATHCOMPS
    )

    // Problem 6 runs among intermediate's, after the slot and problem 3
    expect(matches.shown.map((shown) => shown.number)).toEqual([7, 3, 6])
  })

  it("runs the picked category's slots first, then what the other papers hold in the board's order, then the rest", () => {
    // Problems recommended for intermediate, problem 9 for elementary as well
    const proposals = [
      proposal(2, { recommended: ['intermediate'] }),
      proposal(4, { recommended: ['intermediate'] }),
      proposal(7, { recommended: ['intermediate'] }),
      proposal(9, { recommended: ['elementary', 'intermediate'] }),
    ]

    // A board whose elementary paper holds 9 and 4, and whose intermediate paper, after it, holds 7
    const board: Board = {
      id: 'october',
      name: 'October',
      papers: [
        { id: 'e', name: 'E', category: 'elementary', slots: ['p9', null, 'p4'] },
        { id: 'i', name: 'I', category: 'intermediate', slots: ['p7'] },
      ],
      finalization: null,
    }

    // The pool narrowed to intermediate
    const matches = matchPool(
      proposals,
      { ...OPEN_POOL_FILTER, categories: ['intermediate'] },
      board,
      MATHCOMPS
    )

    // The intermediate slot, then what the elementary paper holds slot by slot, then the problem no paper holds
    expect(matches.shown.map((shown) => shown.number)).toEqual([7, 9, 4, 2])
  })

  it("runs an organization's own categories paper by paper, in the board's order", () => {
    // Problems recommended for C, for B, for both, or for A
    const proposals = [
      proposal(1, { recommended: ['C'] }),
      proposal(2, { recommended: ['B'] }),
      proposal(3, { recommended: ['C', 'B'] }),
      proposal(4, { recommended: ['A'] }),
      proposal(5, { recommended: ['B'] }),
    ]

    // A board setting B out before C, whose B paper holds 5, with no A paper
    const board: Board = {
      id: 'home',
      name: 'MO 77 home round',
      papers: [
        { id: 'b', name: 'B', category: 'B', slots: ['p5'] },
        { id: 'c', name: 'C', category: 'C', slots: [null] },
      ],
      finalization: null,
    }

    // The pool, filtered by nothing
    const matches = matchPool(proposals, OPEN_POOL_FILTER, board, OLYMPIAD)

    // B's slot, the rest for B, then the rest for C, then what no paper takes
    expect(matches.shown.map((shown) => shown.number)).toEqual([5, 2, 3, 1, 4])
  })

  it('finds a problem by its number, its name or a statement in any language, whatever the case', () => {
    // Problem 7 is named Trapezoid and has a Slovak statement about a circle
    const trapezoid = proposal(7, {
      title: 'Trapezoid',
      texts: { sk: { statement: 'Kruh a tetiva', solution: null, hints: [] } },
    })

    // Searched by its number, beside a problem whose number starts with it
    const byNumber = matchPool(
      [trapezoid, proposal(70), proposal(1)],
      { ...OPEN_POOL_FILTER, query: '#7' },
      null,
      MATHCOMPS
    )

    // Searched by its name, in capitals
    const byName = matchPool(
      [trapezoid, proposal(1)],
      { ...OPEN_POOL_FILTER, query: 'TRAPEZ' },
      null,
      MATHCOMPS
    )

    // Searched by a word of its Slovak statement
    const byStatement = matchPool(
      [trapezoid, proposal(1)],
      { ...OPEN_POOL_FILTER, query: 'kruh' },
      null,
      MATHCOMPS
    )

    // Each search finds problem 7 alone
    expect(byNumber.shown.map((shown) => shown.number)).toEqual([7])
    expect(byName.shown.map((shown) => shown.number)).toEqual([7])
    expect(byStatement.shown.map((shown) => shown.number)).toEqual([7])
  })

  it('finds a problem whether the search carries diacritics or not', () => {
    // Problem 4 has a Slovak statement about a circle, spelled with its diacritics
    const circle = proposal(4, {
      texts: { sk: { statement: 'Daná je kružnica k', solution: null, hints: [] } },
    })

    // Searched without the diacritics, the way a hurried reviewer types it
    const bare = matchPool(
      [circle, proposal(1)],
      { ...OPEN_POOL_FILTER, query: 'kruznica' },
      null,
      MATHCOMPS
    )

    // Searched with the diacritics, in capitals
    const accented = matchPool(
      [circle, proposal(1)],
      { ...OPEN_POOL_FILTER, query: 'KRUŽNICA' },
      null,
      MATHCOMPS
    )

    // Each search finds problem 4 alone
    expect(bare.shown.map((shown) => shown.number)).toEqual([4])
    expect(accented.shown.map((shown) => shown.number)).toEqual([4])
  })
})

/** A draft board named December: problem 1 in its elementary paper, Starters, problem 2 in its intermediate one. */
const DRAFT: Board = {
  id: 'draft',
  name: 'December',
  papers: [
    { id: 'elementary-paper', name: 'Starters', category: 'elementary', slots: ['p1', null] },
    { id: 'intermediate-paper', name: 'I', category: 'intermediate', slots: ['p2'] },
  ],
  finalization: null,
}

/** A board finalized into October's rounds, its advanced paper holding problem 7, which the round took. */
const FINALIZED: Board = {
  id: 'finalized',
  name: 'October',
  papers: [{ id: 'advanced-paper', name: 'A', category: 'advanced', slots: ['p7'] }],
  finalization: { cycleName: 'October', opensAt: '2026-10-20T08:00:00.000Z' },
}

/**
 * The selection's discussions: problem 1's thread of three comments, one a reply to a reply, problem 2's two threads,
 * one holding a deleted reply, the set-aside problem 3's thread of two, the taken problem 7's, the elementary paper's
 * thread of two and the finalized board's paper's, whose comment names problem 2.
 */
const DISCUSSIONS: Discussion<DiscussedSubject>[] = [
  {
    subject: { kind: 'proposal', proposal: proposal(1, { recommended: ['elementary'] }) },
    comments: [commentDto('easy', 1, [commentDto('agreed', 2, [commentDto('too easy', 3)])])],
  },
  {
    subject: {
      kind: 'proposal',
      proposal: proposal(2, { area: 'geometry', recommended: ['intermediate'] }),
    },
    comments: [
      commentDto('lovely', 4, [{ ...commentDto('withdrawn', 6, [], ''), isDeleted: true }]),
      commentDto('known', 5, [commentDto('opener', 6, [], 'Fine as the Opener of day two.')]),
    ],
  },
  {
    subject: {
      kind: 'proposal',
      proposal: proposal(3, { recommended: ['elementary'], isSetAside: true }),
    },
    comments: [commentDto('broken', 7, [commentDto('fixable', 7)])],
  },
  {
    subject: {
      kind: 'proposal',
      proposal: proposal(7, { area: 'geometry', recommended: ['advanced'], isUsed: true }),
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

    // The comments still standing under each category, a paper's thread counting toward its paper's
    expect(matches.categoryCounts).toEqual({ elementary: 5, intermediate: 3, advanced: 2 })

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
    expect(shownUnder({ categories: ['elementary'] })).toEqual(['paper', 'easy'])

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

describe('withListedCategories', () => {
  it("keeps the categories the selection lists, in the selection's order", () => {
    // An address naming advanced, a category nobody lists, and elementary, in that order
    const picked = { ...OPEN_POOL_FILTER, categories: ['advanced', 'nowhere', 'elementary'] }

    // The categories the selection lists, in the order they run
    expect(withListedCategories(picked, MATHCOMPS).categories).toEqual(['elementary', 'advanced'])
  })
})
