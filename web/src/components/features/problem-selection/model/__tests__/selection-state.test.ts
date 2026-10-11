import { describe, expect, it } from 'vitest'

import {
  cycleMisfit,
  pickActiveBoard,
  resolveText,
  unreadyLanguages,
  unwrittenAcross,
} from '../selection-state'
import type { Board, Cycle, Paper, Proposal } from '../selection-types'

/** The October cycle: one round per category, four problems each. */
const OCTOBER: Cycle = {
  id: 'october',
  name: 'October',
  opensAt: '2026-10-18T22:00:00Z',
  categories: ['elementary', 'intermediate', 'advanced'],
  problemCount: 4,
}

/**
 * A paper of the given category and length.
 *
 * @param name - What it is called.
 * @param category - The category it fills, or null for none.
 * @param length - How many slots it has.
 *
 * @returns The paper, every slot empty.
 */
function paper(name: string, category: Paper['category'], length = 4): Paper {
  // Its name doubling as its id, with nothing in any slot
  return { id: name, name, category, slots: Array.from({ length }, () => null) }
}

/**
 * A board holding no papers.
 *
 * @param id - The board's id, doubling as its name.
 * @param isFinalized - Whether it has been finalized into a cycle's rounds.
 *
 * @returns The board.
 */
function board(id: string, isFinalized = false): Board {
  // The board, finalized into October's rounds when asked
  return {
    id,
    name: id,
    papers: [],
    finalization: isFinalized ? { cycleName: 'October', opensAt: OCTOBER.opensAt } : null,
  }
}

/**
 * A proposal holding the given texts and nothing else of note.
 *
 * @param texts - The proposal's text in each language it is written in.
 *
 * @returns The proposal.
 */
function proposal(texts: Proposal['texts']): Proposal {
  // A geometry problem recommended for no category, neither set aside nor used
  return {
    id: 'p',
    number: 1,
    title: 'p',
    area: 'geometry',
    recommended: [],
    texts,
    isSetAside: false,
    isUsed: false,
  }
}

describe('cycleMisfit', () => {
  it('names a paper no round is left for, and the round no paper fills', () => {
    // A second elementary paper, and a paper outside the categories
    const second = paper('E2', 'elementary')
    const school = paper('School', null)

    // What keeps a board of E, E2 and School from pairing up with October's rounds
    const misfit = cycleMisfit(
      { ...board('board'), papers: [paper('E', 'elementary'), second, school] },
      OCTOBER
    )

    // The second elementary paper and the school paper have no round
    expect(misfit.unmatched).toEqual([second, school])

    // And no paper stands for the intermediate round or the advanced one
    expect(misfit.uncovered).toEqual(['intermediate', 'advanced'])
  })

  it('names a paper of a category the cycle runs no round in', () => {
    // An intermediate paper, and a cycle with no intermediate round
    const intermediate = paper('I', 'intermediate')
    const twoRounds: Cycle = { ...OCTOBER, categories: ['elementary', 'advanced'] }

    // What keeps a board of E, I and A from pairing up with the two rounds
    const misfit = cycleMisfit(
      {
        ...board('board'),
        papers: [paper('E', 'elementary'), intermediate, paper('A', 'advanced')],
      },
      twoRounds
    )

    // The intermediate paper has no round
    expect(misfit.unmatched).toEqual([intermediate])

    // And both rounds have their paper
    expect(misfit.uncovered).toEqual([])
  })

  it('names a paper whose length differs from what the rounds take', () => {
    // Advanced has five slots where every round takes four
    const long = paper('A', 'advanced', 5)

    // What keeps a board of E, I and the long A from pairing up with October's rounds
    const misfit = cycleMisfit(
      { ...board('board'), papers: [paper('E', 'elementary'), paper('I', 'intermediate'), long] },
      OCTOBER
    )

    // The advanced paper is named for its length
    expect(misfit.wrongSize).toEqual([long])

    // And nothing else stands in the way
    expect(misfit.unmatched).toEqual([])
    expect(misfit.uncovered).toEqual([])
  })
})

describe('unreadyLanguages', () => {
  it('counts a language with a statement but no solution as one a round refuses', () => {
    // English in full, Slovak without its solution, Czech not at all
    const partial = proposal({
      en: { statement: 'en', solution: 'R', hints: [] },
      sk: { statement: 'sk', solution: null, hints: [] },
    })

    // The languages a round would refuse the proposal in
    const unready = unreadyLanguages(partial)

    // Slovak and Czech both fall short
    expect(unready).toEqual(['sk', 'cs'])
  })

  it('counts a solution of nothing but whitespace as none, as a round does', () => {
    // Every language written in full, except that the English solution is blank
    const blank = proposal({
      en: { statement: 'en', solution: ' \n', hints: [] },
      sk: { statement: 'sk', solution: 'R', hints: [] },
      cs: { statement: 'cs', solution: 'R', hints: [] },
    })

    // The languages a round would refuse the proposal in
    const unready = unreadyLanguages(blank)

    // English falls short
    expect(unready).toEqual(['en'])
  })
})

describe('unwrittenAcross', () => {
  it('rules out only the languages none of the proposals is written in', () => {
    // One proposal in English and Slovak, another in English alone
    const proposals = [
      proposal({
        en: { statement: 'en', solution: null, hints: [] },
        sk: { statement: 'sk', solution: null, hints: [] },
      }),
      proposal({ en: { statement: 'en', solution: null, hints: [] } }),
    ]

    // The languages neither is written in
    const unwritten = unwrittenAcross(proposals)

    // Czech alone, since Slovak has one of them
    expect(unwritten).toEqual(['cs'])
  })

  it('rules out no language for an empty set, though no proposal is written in any', () => {
    // The languages an empty paper rules out
    const unwritten = unwrittenAcross([])

    // None
    expect(unwritten).toEqual([])
  })
})

describe('resolveText', () => {
  it('reads a problem in the language asked for whenever it is written in it', () => {
    // Written in Slovak and English
    const bilingual = proposal({
      sk: { statement: 'sk', solution: null, hints: [] },
      en: { statement: 'en', solution: null, hints: [] },
    })

    // The problem asked for in English, which the site lists after Slovak
    const resolved = resolveText(bilingual, 'en')

    // English it is
    expect(resolved?.language).toBe('en')
    expect(resolved?.text.statement).toBe('en')
  })

  it('falls back to the first language the problem has, in the order the site lists them', () => {
    // Written in Czech and English only
    const local = proposal({
      en: { statement: 'en', solution: null, hints: [] },
      cs: { statement: 'cs', solution: null, hints: [] },
    })

    // The problem asked for in Slovak, which it lacks
    const resolved = resolveText(local, 'sk')

    // Czech stands in, coming before English
    expect(resolved?.language).toBe('cs')
    expect(resolved?.text.statement).toBe('cs')
  })
})

describe('pickActiveBoard', () => {
  it('keeps the picked board on screen over a draft', () => {
    // A finalized board ahead of a draft
    const boards = [board('round', true), board('draft')]

    // The finalized board picked
    const active = pickActiveBoard(boards, 'round')

    // The finalized board stays on screen, though a draft waits
    expect(active?.id).toBe('round')
  })

  it('falls back to the first draft once the picked board is gone', () => {
    // A finalized board ahead of a draft
    const boards = [board('round', true), board('draft')]

    // Picked a board the selection no longer holds
    const active = pickActiveBoard(boards, 'gone')

    // The draft goes on screen, the finalized board being passed over
    expect(active?.id).toBe('draft')
  })

  it('takes the first board when every board is finalized', () => {
    // Every board finalized
    const boards = [board('first', true), board('second', true)]

    // Nothing picked
    const active = pickActiveBoard(boards, null)

    // The first one goes on screen
    expect(active?.id).toBe('first')
  })
})
