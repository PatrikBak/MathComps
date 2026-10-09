import { describe, expect, it } from 'vitest'

import { afterClearing, afterMove, afterPlacement } from '../selection-edits'
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
    isSetAside: false,
    isUsed: false,
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
 * A selection holding the given boards and proposals, and nothing else.
 *
 * @param boards - The boards.
 * @param proposals - The proposals.
 *
 * @returns The selection.
 */
function selection(boards: Board[], proposals: Proposal[]): SelectionData {
  // The boards and the proposals, every other part of the selection empty
  return { proposals, boards, conversations: [] }
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

describe('every edit', () => {
  it('leaves the selection it is handed as it was, which a refused write puts back', () => {
    // A draft, and a problem waiting in the pool
    const before = selection(
      [board('draft', ['a', 'b', null])],
      [proposal('a'), proposal('b'), proposal('new')]
    )

    // A copy to hold it against
    const untouched = structuredClone(before)

    // Every edit run over it
    afterPlacement(before, {
      slot: { boardId: 'draft', paperId: 'draft-e', index: 2 },
      proposalId: 'a',
    })
    afterPlacement(before, {
      slot: { boardId: 'draft', paperId: 'draft-e', index: 1 },
      proposalId: 'new',
    })
    afterClearing(before, { boardId: 'draft', paperId: 'draft-e', index: 0 })
    afterMove(before, {
      slot: { boardId: 'draft', paperId: 'draft-e', index: 0 },
      direction: 'down',
    })

    // It is as it was
    expect(before).toEqual(untouched)
  })
})
