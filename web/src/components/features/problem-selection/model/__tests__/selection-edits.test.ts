import { describe, expect, it } from 'vitest'

import {
  afterClearing,
  afterDeletion,
  afterMove,
  afterPlacement,
  afterRating,
  afterRecommendation,
  afterSetAside,
} from '../selection-edits'
import type { Board, Proposal, SelectionData } from '../selection-types'

/**
 * A proposal in the pool with nothing set on it beyond its id.
 *
 * @param id - The proposal's id.
 *
 * @returns The proposal.
 */
function proposal(id: string): Proposal {
  // The proposal, its id doubling as its title
  return {
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
  }
}

/**
 * A draft of one elementary paper holding the given slots.
 *
 * @param id - The board's id.
 * @param slots - What each slot holds.
 *
 * @returns The board.
 */
function board(id: string, slots: (string | null)[]): Board {
  // The draft named after its id, with one paper whose id is the board's plus -e
  return {
    id,
    name: id,
    papers: [{ id: `${id}-e`, name: 'Elementary', category: 'elementary', slots }],
    finalization: null,
  }
}

/**
 * A selection holding MathComps' categories and the given boards and proposals, and nothing else.
 *
 * @param boards - The boards.
 * @param proposals - The proposals.
 *
 * @returns The selection.
 */
function selection(boards: Board[], proposals: Proposal[]): SelectionData {
  // MathComps' categories, the boards and the proposals, every other part of the selection empty, and every
  // language needed
  return {
    categories: [
      { name: 'elementary', hostedCategory: 'elementary' },
      { name: 'intermediate', hostedCategory: 'intermediate' },
      { name: 'advanced', hostedCategory: 'advanced' },
    ],
    proposals,
    boards,
    cycles: [],
    conversations: [],
    needsEveryLanguage: true,
  }
}

/**
 * The slots of a board's only paper.
 *
 * @param data - The selection.
 * @param boardId - The board.
 *
 * @returns What each slot holds.
 */
function slotsOf(data: SelectionData, boardId: string): (string | null)[] {
  // The slots of the board's first paper, or none where there is no such board
  return data.boards.find((candidate) => candidate.id === boardId)?.papers[0]?.slots ?? []
}

describe('afterPlacement', () => {
  it('puts a pool problem into a draft slot, leaving both problems where they stand on other boards', () => {
    // b sits in the draft's first slot, and a second draft holds both b and a
    const before = selection(
      [board('draft', ['b', null]), board('other', ['b', 'a'])],
      [proposal('a'), proposal('b')]
    )

    // a goes where b was
    const after = afterPlacement(before, {
      slot: { boardId: 'draft', paperId: 'draft-e', index: 0 },
      proposalId: 'a',
    })

    // b is off this board only
    expect(slotsOf(after, 'draft')).toEqual(['a', null])

    // And the second draft untouched, a keeping its place there
    expect(slotsOf(after, 'other')).toEqual(['b', 'a'])
  })

  it('trades two slots when the problem already sits elsewhere on the board', () => {
    // a in the first slot, b in the third
    const before = selection([board('draft', ['a', null, 'b'])], [proposal('a'), proposal('b')])

    // b goes into the first slot
    const after = afterPlacement(before, {
      slot: { boardId: 'draft', paperId: 'draft-e', index: 0 },
      proposalId: 'b',
    })

    // The two have swapped, the empty slot untouched
    expect(slotsOf(after, 'draft')).toEqual(['b', null, 'a'])
  })

  it('trades across papers when the problem already sits on another paper of the board', () => {
    // a in the elementary paper, b in the intermediate one
    const draft: Board = {
      ...board('draft', []),
      papers: [
        { id: 'draft-e', name: 'Elementary', category: 'elementary', slots: ['a', null] },
        { id: 'draft-i', name: 'Intermediate', category: 'intermediate', slots: ['b'] },
      ],
    }

    // a goes where b was
    const after = afterPlacement(selection([draft], [proposal('a'), proposal('b')]), {
      slot: { boardId: 'draft', paperId: 'draft-i', index: 0 },
      proposalId: 'a',
    })

    // The two have traded papers
    expect(after.boards[0]?.papers.map((paper) => paper.slots)).toEqual([['b', null], ['a']])
  })
})

describe('afterClearing', () => {
  it('empties only the slot named, leaving the same position on another paper', () => {
    // a first in the elementary paper, b first in the intermediate one
    const draft: Board = {
      ...board('draft', []),
      papers: [
        { id: 'draft-e', name: 'Elementary', category: 'elementary', slots: ['a', null] },
        { id: 'draft-i', name: 'Intermediate', category: 'intermediate', slots: ['b'] },
      ],
    }

    // The elementary paper's first slot emptied
    const after = afterClearing(selection([draft], [proposal('a'), proposal('b')]), {
      boardId: 'draft',
      paperId: 'draft-e',
      index: 0,
    })

    // Only that slot stands empty
    expect(after.boards[0]?.papers.map((paper) => paper.slots)).toEqual([[null, null], ['b']])
  })
})

describe('afterMove', () => {
  it('trades a slot with the one above it', () => {
    // Three slots
    const before = selection([board('draft', ['a', 'b', 'c'])], [])

    // The middle slot moves up
    const after = afterMove(before, {
      slot: { boardId: 'draft', paperId: 'draft-e', index: 1 },
      direction: 'up',
    })

    // The middle slot traded with the first
    expect(slotsOf(after, 'draft')).toEqual(['b', 'a', 'c'])
  })

  it('trades a slot with the one below it', () => {
    // Three slots
    const before = selection([board('draft', ['a', 'b', 'c'])], [])

    // The middle slot moves down
    const after = afterMove(before, {
      slot: { boardId: 'draft', paperId: 'draft-e', index: 1 },
      direction: 'down',
    })

    // The middle slot traded with the last
    expect(slotsOf(after, 'draft')).toEqual(['a', 'c', 'b'])
  })

  it('leaves the same positions on another paper of the board alone', () => {
    // Two papers of two slots each
    const draft: Board = {
      ...board('draft', []),
      papers: [
        { id: 'draft-e', name: 'Elementary', category: 'elementary', slots: ['a', 'b'] },
        { id: 'draft-i', name: 'Intermediate', category: 'intermediate', slots: ['c', 'd'] },
      ],
    }

    // The elementary paper's first slot moves down
    const after = afterMove(selection([draft], []), {
      slot: { boardId: 'draft', paperId: 'draft-e', index: 0 },
      direction: 'down',
    })

    // Only the elementary paper traded
    expect(after.boards[0]?.papers.map((paper) => paper.slots)).toEqual([
      ['b', 'a'],
      ['c', 'd'],
    ])
  })
})

describe('afterDeletion', () => {
  it('takes the problem out of the selection and off every draft', () => {
    // a sits on two drafts
    const before = selection(
      [board('draft', ['a', 'b']), board('other', ['a'])],
      [proposal('a'), proposal('b')]
    )

    // a is deleted
    const after = afterDeletion(before, 'a')

    // Both of a's slots stand empty
    expect(slotsOf(after, 'draft')).toEqual([null, 'b'])
    expect(slotsOf(after, 'other')).toEqual([null])

    // And only b is left in the selection
    expect(after.proposals.map((item) => item.id)).toEqual(['b'])
  })
})

describe('afterRecommendation', () => {
  it('keeps the categories in the order the organization runs them whichever one is switched on', () => {
    // a, recommended for A alone, in a selection whose categories run C, B, A
    const before: SelectionData = {
      ...selection([], [{ ...proposal('a'), recommended: ['A'] }]),
      categories: [
        { name: 'C', hostedCategory: null },
        { name: 'B', hostedCategory: null },
        { name: 'A', hostedCategory: null },
      ],
    }

    // C goes on
    const after = afterRecommendation(before, {
      proposalId: 'a',
      category: 'C',
      isRecommended: true,
    })

    // C comes first, as the categories run
    expect(after.proposals[0]?.recommended).toEqual(['C', 'A'])
  })

  it('takes one category back and keeps the rest', () => {
    // a, recommended for elementary and advanced
    const before = selection([], [{ ...proposal('a'), recommended: ['elementary', 'advanced'] }])

    // Elementary goes off
    const after = afterRecommendation(before, {
      proposalId: 'a',
      category: 'elementary',
      isRecommended: false,
    })

    // Only advanced is left
    expect(after.proposals[0]?.recommended).toEqual(['advanced'])
  })
})

describe('afterRating', () => {
  // The reader, Rita, as the page knows them under their sign-in's id
  const reader = { id: 'signed-in-rita', username: 'Rita', email: 'rita@example.com' }

  // The reader's rating as the server reads it back, under the server's id for the reader
  const ownRating = {
    rater: { id: 'rita', username: 'Rita', email: 'rita@example.com' },
    isOwn: true,
  } as const

  // Another reviewer's rating, which no write of the reader's touches
  const otherRating = {
    rater: { id: 'viera', username: 'Viera', email: null },
    isOwn: false,
    beauty: 2,
    difficulty: 3,
  } as const

  it("rescores the reader's own rating where it stands and leaves every other reviewer's", () => {
    // a, rated by the reader and then by another reviewer, as the reviewers' names order them
    const before = selection(
      [],
      [{ ...proposal('a'), ratings: [{ ...ownRating, beauty: 4, difficulty: 1 }, otherRating] }]
    )

    // a rescored, the reader's difficulty left out
    const after = afterRating(
      before,
      { proposalId: 'a', scores: { beauty: 5, difficulty: null } },
      reader
    )

    // The reader's rating first still, under the server's id and rescored, the other reviewer's untouched
    expect(after.proposals[0]?.ratings).toEqual([
      { ...ownRating, beauty: 5, difficulty: null },
      otherRating,
    ])
  })

  it('takes the rating back once it scores no aspect, and gives a first one', () => {
    // a, rated by the reader, and b, rated by nobody
    const before = selection(
      [],
      [
        { ...proposal('a'), ratings: [{ ...ownRating, beauty: 4, difficulty: null }] },
        proposal('b'),
      ]
    )

    // a's rating taken back
    const takenBack = afterRating(
      before,
      { proposalId: 'a', scores: { beauty: null, difficulty: null } },
      reader
    )

    // b rated for the first time
    const after = afterRating(
      takenBack,
      { proposalId: 'b', scores: { beauty: null, difficulty: 2 } },
      reader
    )

    // a left with no rating, and b with the reader's, named as the page knows the reader
    expect(after.proposals.map((rated) => rated.ratings)).toEqual([
      [],
      [{ rater: reader, isOwn: true, beauty: null, difficulty: 2 }],
    ])
  })
})

describe('every edit', () => {
  it('leaves the selection it is handed as it was, which a refused write puts back', () => {
    // The reader, who rated a
    const reader = { id: 'rita', username: 'Rita', email: 'rita@example.com' }

    // A draft, and a problem waiting in the pool
    const before = selection(
      [board('draft', ['a', 'b', null])],
      [
        {
          ...proposal('a'),
          ratings: [{ rater: reader, isOwn: true, beauty: 4, difficulty: null }],
        },
        proposal('b'),
        proposal('new'),
      ]
    )

    // A copy to hold it against
    const untouched = structuredClone(before)

    // a moved into the empty slot
    afterPlacement(before, {
      slot: { boardId: 'draft', paperId: 'draft-e', index: 2 },
      proposalId: 'a',
    })

    // The pool problem put where b stands
    afterPlacement(before, {
      slot: { boardId: 'draft', paperId: 'draft-e', index: 1 },
      proposalId: 'new',
    })

    // The first slot emptied
    afterClearing(before, { boardId: 'draft', paperId: 'draft-e', index: 0 })

    // The first slot moved down
    afterMove(before, {
      slot: { boardId: 'draft', paperId: 'draft-e', index: 0 },
      direction: 'down',
    })

    // a set aside
    afterSetAside(before, { proposalId: 'a', isSetAside: true })

    // a recommended for elementary
    afterRecommendation(before, { proposalId: 'a', category: 'elementary', isRecommended: true })

    // a rated again
    afterRating(before, { proposalId: 'a', scores: { beauty: 5, difficulty: 2 } }, reader)

    // b rated for the first time
    afterRating(before, { proposalId: 'b', scores: { beauty: 1, difficulty: null } }, reader)

    // b deleted
    afterDeletion(before, 'b')

    // It is as it was
    expect(before).toEqual(untouched)
  })
})
