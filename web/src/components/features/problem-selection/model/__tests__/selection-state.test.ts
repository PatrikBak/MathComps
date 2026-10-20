import { describe, expect, it } from 'vitest'

import type { Locale } from '@/i18n/i18n'

import {
  arguedText,
  averageScore,
  canPlaceOn,
  cycleMisfit,
  mapsToRounds,
  pickActiveBoard,
  resolveText,
  unreadyLanguages,
  unwrittenAcross,
} from '../selection-state'
import type { Board, Cycle, Paper, Proposal, SelectionCategory } from '../selection-types'

/** MathComps' categories, each a hosted level, and the olympiad's C, which no hosted round runs. */
const CATEGORIES: SelectionCategory[] = [
  { name: 'elementary', hostedCategory: 'elementary' },
  { name: 'intermediate', hostedCategory: 'intermediate' },
  { name: 'advanced', hostedCategory: 'advanced' },
  { name: 'C', hostedCategory: null },
]

/** The categories of an organization calling the elementary level Junior. */
const JUNIOR_CATEGORIES: SelectionCategory[] = [
  { name: 'Junior', hostedCategory: 'elementary' },
  { name: 'intermediate', hostedCategory: 'intermediate' },
  { name: 'advanced', hostedCategory: 'advanced' },
]

/** The October cycle: one round per hosted level, four problems each. */
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
 * @param originalLanguage - The language it was first written in, or null where none of its texts is the original.
 *
 * @returns The proposal.
 */
function proposal(texts: Proposal['texts'], originalLanguage: Locale | null = null): Proposal {
  // A geometry problem recommended for no category, neither set aside nor used
  return {
    id: 'p',
    number: 1,
    title: 'p',
    area: 'geometry',
    recommended: [],
    texts,
    originalLanguage,
    isSetAside: false,
    isUsed: false,
    ratings: [],
  }
}

describe('averageScore', () => {
  it('averages over the reviewers who scored the aspect, and is none while nobody has', () => {
    // Two reviewers scoring beauty, the second leaving difficulty out
    const ratings = [
      { rater: { id: 'a', username: 'A', email: null }, isOwn: true, beauty: 4, difficulty: 2 },
      { rater: { id: 'b', username: 'B', email: null }, isOwn: false, beauty: 5, difficulty: null },
    ] as const

    // The averages of beauty, of difficulty, and of beauty over no ratings
    const averages = [
      averageScore(ratings, 'beauty'),
      averageScore(ratings, 'difficulty'),
      averageScore([], 'beauty'),
    ]

    // Beauty over both, difficulty over the one who gave it, and nothing over nobody
    expect(averages).toEqual([4.5, 2, null])
  })
})

describe('cycleMisfit', () => {
  it('names a paper no round is left for, and the round no paper fills', () => {
    // A second elementary paper, a paper outside the categories, and one of a category no round runs
    const second = paper('E2', 'elementary')
    const school = paper('School', null)
    const olympiad = paper('C', 'C')

    // What keeps a board of E, E2, School and C from pairing up with October's rounds
    const misfit = cycleMisfit(
      { ...board('board'), papers: [paper('E', 'elementary'), second, school, olympiad] },
      OCTOBER,
      CATEGORIES
    )

    // The second elementary paper, the school paper and the C paper have no round
    expect(misfit.unmatched).toEqual([second, school, olympiad])

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
      twoRounds,
      CATEGORIES
    )

    // The intermediate paper has no round
    expect(misfit.unmatched).toEqual([intermediate])

    // And both rounds have their paper
    expect(misfit.uncovered).toEqual([])
  })

  it("pairs a paper with the round of its category's level, whatever the category is called", () => {
    // A board of a Junior paper, then the intermediate and advanced ones
    const misfit = cycleMisfit(
      {
        ...board('board'),
        papers: [paper('J', 'Junior'), paper('I', 'intermediate'), paper('A', 'advanced')],
      },
      OCTOBER,
      JUNIOR_CATEGORIES
    )

    // Junior fills the elementary round, so everything pairs up
    expect(misfit).toEqual({ unmatched: [], wrongSize: [], uncovered: [] })
  })

  it('names a paper whose length differs from what the rounds take', () => {
    // Advanced has five slots where every round takes four
    const long = paper('A', 'advanced', 5)

    // What keeps a board of E, I and the long A from pairing up with October's rounds
    const misfit = cycleMisfit(
      { ...board('board'), papers: [paper('E', 'elementary'), paper('I', 'intermediate'), long] },
      OCTOBER,
      CATEGORIES
    )

    // The advanced paper is named for its length
    expect(misfit.wrongSize).toEqual([long])

    // And nothing else stands in the way
    expect(misfit.unmatched).toEqual([])
    expect(misfit.uncovered).toEqual([])
  })
})

describe('canPlaceOn', () => {
  it('places a problem from the pool for a reader leading any paper on the board, and for no one else', () => {
    // A draft with an elementary and an intermediate paper
    const draft = {
      ...board('draft'),
      papers: [paper('E', 'elementary'), paper('I', 'intermediate')],
    }

    // A problem from the pool
    const pooled = proposal({})

    // An elementary lead places it, while a reader leading nothing, or a category the board lacks, does not
    expect(canPlaceOn(draft, pooled, ['elementary'])).toBe(true)
    expect(canPlaceOn(draft, pooled, [])).toBe(false)
    expect(canPlaceOn(draft, pooled, ['C'])).toBe(false)
  })

  it('moves a problem out of a paper only for a reader leading that paper too', () => {
    // A draft whose intermediate paper holds the problem
    const draft = {
      ...board('draft'),
      papers: [paper('E', 'elementary'), { ...paper('I', 'intermediate'), slots: ['p', null] }],
    }

    // The problem the intermediate paper holds
    const held = proposal({})

    // An elementary lead cannot move it out of the intermediate paper, a lead of both can
    expect(canPlaceOn(draft, held, ['elementary'])).toBe(false)
    expect(canPlaceOn(draft, held, ['elementary', 'intermediate'])).toBe(true)
  })
})

describe('mapsToRounds', () => {
  it('holds once every paper fills a category that is a hosted level', () => {
    // MathComps' three papers
    const mathcomps = {
      ...board('mathcomps'),
      papers: [paper('E', 'elementary'), paper('I', 'intermediate'), paper('A', 'advanced')],
    }

    // The same with the olympiad's C paper beside them
    const mixed = { ...mathcomps, papers: [...mathcomps.papers, paper('C', 'C')] }

    // A board of one Junior paper, a hosted level under another name
    const junior = { ...board('junior'), papers: [paper('J', 'Junior')] }

    // Every paper but the C one goes into a round
    expect(mapsToRounds(mathcomps, CATEGORIES)).toBe(true)
    expect(mapsToRounds(junior, JUNIOR_CATEGORIES)).toBe(true)
    expect(mapsToRounds(mixed, CATEGORIES)).toBe(false)
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

describe('arguedText', () => {
  it("argues a problem in the reader's language wherever it is solved there, though the original is another", () => {
    // First written in English, and translated into Slovak in full
    const translated = proposal(
      {
        en: { statement: 'en', solution: 'R', hints: [] },
        sk: { statement: 'sk', solution: 'R', hints: [] },
      },
      'en'
    )

    // The text argued for a reader in Slovak
    const argued = arguedText(translated, 'sk')

    // The Slovak one
    expect(argued?.statement).toBe('sk')
  })

  it("falls back to the language the problem was first written in where the reader's is unsolved", () => {
    // First written in English, with a Czech statement nobody has solved
    const original = proposal(
      {
        en: { statement: 'en', solution: 'R', hints: [] },
        cs: { statement: 'cs', solution: null, hints: [] },
      },
      'en'
    )

    // The text argued for a reader in Czech
    const argued = arguedText(original, 'cs')

    // The English one
    expect(argued?.statement).toBe('en')
  })

  it('argues nothing where the original is unsolved too, whatever a third language holds', () => {
    // First written in Slovak with no solution, and solved in English alone
    const unsolved = proposal(
      {
        sk: { statement: 'sk', solution: null, hints: [] },
        en: { statement: 'en', solution: 'R', hints: [] },
      },
      'sk'
    )

    // The text argued for a reader in Czech
    const argued = arguedText(unsolved, 'cs')

    // None
    expect(argued).toBeNull()
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
