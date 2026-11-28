import { describe, expect, it } from 'vitest'

import { paperTargetKeyOf, recommendationTargetsOf, targetKeyOf } from '../recommendation-targets'
import type { Board, BoardStage, Paper } from '../selection-types'

describe('recommendationTargetsOf', () => {
  it("lists the categories in the order they run, then each draft's papers with no category, board by board", () => {
    // A draft picking for no cycle with a categorized paper and one with no category, a finalized board with a paper
    // with no category, and a draft its cycle can't take yet with two papers with no category
    const boards: Board[] = [
      {
        id: 'october',
        name: 'October',
        papers: [
          { id: 'october-a', name: 'A', category: 'A', slots: [] },
          { id: 'october-extra', name: 'Extra', category: null, slots: [] },
        ],
        cycle: null,
      },
      {
        id: 'school',
        name: 'School',
        papers: [{ id: 'school-paper', name: 'School', category: null, slots: [] }],
        cycle: { name: 'School', opensAt: '2026-11-01T08:00:00.000Z', stage: 'finalized' },
      },
      {
        id: 'warm-up',
        name: 'Warm-up',
        papers: [
          { id: 'warm-up-first', name: 'First', category: null, slots: [] },
          { id: 'warm-up-second', name: 'Second', category: null, slots: [] },
        ],
        cycle: { name: 'Warm-up', opensAt: '2026-12-01T08:00:00.000Z', stage: 'unfinalizable' },
      },
    ]

    // The targets of a selection running B, then A
    const targets = recommendationTargetsOf(
      [
        { name: 'B', hostedCategory: null },
        { name: 'A', hostedCategory: null },
      ],
      boards
    )

    // The categories, then the drafts' papers with no category, the finalized board's left out
    expect(targets.map(targetKeyOf)).toEqual([
      'B',
      'A',
      'october-extra',
      'warm-up-first',
      'warm-up-second',
    ])
  })
})

describe('paperTargetKeyOf', () => {
  it("keys a paper by its category, else by itself while its board is a draft, and a finalized board's by nothing", () => {
    // A paper with a category, and one with none
    const categorized: Paper = { id: 'categorized', name: 'A', category: 'A', slots: [] }
    const uncategorized: Paper = { id: 'uncategorized', name: 'Extra', category: null, slots: [] }

    // A function which puts both papers on a board at a stage of its cycle
    const boardAt = (stage: BoardStage): Board => ({
      id: stage,
      name: stage,
      papers: [categorized, uncategorized],
      cycle: { name: 'Round', opensAt: '2026-12-01T08:00:00.000Z', stage },
    })

    // Each paper's key on a draft its cycle can't take yet, and on a finalized board
    const keys = (['unfinalizable', 'finalized'] as const).map((stage) =>
      [categorized, uncategorized].map((paper) => paperTargetKeyOf(paper, boardAt(stage)))
    )

    // The category on both, the paper itself on the draft alone
    expect(keys).toEqual([
      ['A', 'uncategorized'],
      ['A', null],
    ])
  })
})
