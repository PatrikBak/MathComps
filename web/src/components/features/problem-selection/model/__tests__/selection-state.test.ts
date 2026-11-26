import { describe, expect, it } from 'vitest'

import type { Locale } from '@/i18n/i18n'

import {
  arguedText,
  averageScore,
  canPlaceOn,
  pickActiveBoard,
  resolveText,
  unreadyLanguages,
  unwrittenAcross,
} from '../selection-state'
import type { Board, BoardStage, Paper, Proposal } from '../selection-types'

/**
 * A paper of the given category and length.
 *
 * @param name - What it is called.
 * @param category - The category it fills.
 * @param length - How many slots it has.
 *
 * @returns The paper, every slot empty.
 */
function paper(name: string, category: Paper['category'], length = 4): Paper {
  // Its name doubling as its id, with nothing in any slot
  return { id: name, name, category, slots: Array.from({ length }, () => null) }
}

/**
 * A board holding no papers, picking for October's cycle or for none.
 *
 * @param id - The board's id, doubling as its name.
 * @param stage - Where the board stands against October's cycle; null for a board picking for no cycle.
 *
 * @returns The board.
 */
function board(id: string, stage: BoardStage | null = 'finalizable'): Board {
  // The board, standing against October's cycle as given, or picking for none
  return {
    id,
    name: id,
    papers: [],
    cycle: stage === null ? null : { name: 'October', opensAt: '2026-10-18T22:00:00Z', stage },
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
    gradingNote: null,
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

  it('places a problem on a paper with no category for a lead of any category, and for no one else', () => {
    // A draft whose one paper has no category
    const draft = { ...board('draft'), papers: [paper('School', null)] }

    // A problem from the pool
    const pooled = proposal({})

    // A lead of a category the board has no paper of places it, while a reader leading nothing does not
    expect(canPlaceOn(draft, pooled, ['C'])).toBe(true)
    expect(canPlaceOn(draft, pooled, [])).toBe(false)
  })

  it("places on a draft that can't be finalized and on one picking for no cycle, but on no finalized board", () => {
    // A function which builds a board with an elementary paper, standing as given against its cycle
    const standing = (stage: BoardStage | null) => ({
      ...board('board', stage),
      papers: [paper('E', 'elementary')],
    })

    // A problem from the pool
    const pooled = proposal({})

    // A draft that can't be finalized, and one picking for no cycle, take the problem
    expect(canPlaceOn(standing('unfinalizable'), pooled, ['elementary'])).toBe(true)
    expect(canPlaceOn(standing(null), pooled, ['elementary'])).toBe(true)

    // A finalized board does not
    expect(canPlaceOn(standing('finalized'), pooled, ['elementary'])).toBe(false)
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
    const boards = [board('round', 'finalized'), board('draft')]

    // The finalized board picked
    const active = pickActiveBoard(boards, 'round')

    // The finalized board stays on screen, though a draft waits
    expect(active?.id).toBe('round')
  })

  it("falls back to a draft that can't be finalized once the picked board is gone, over a finalized one", () => {
    // A finalized board ahead of a draft that can't be finalized
    const boards = [board('round', 'finalized'), board('draft', 'unfinalizable')]

    // Picked a board the selection no longer holds
    const active = pickActiveBoard(boards, 'gone')

    // The draft goes on screen, the finalized board being passed over
    expect(active?.id).toBe('draft')
  })

  it("passes over a draft that can't be finalized for a later one that can", () => {
    // A draft that can't be finalized, then one that can
    const boards = [board('missed', 'unfinalizable'), board('next', 'finalizable')]

    // Nothing picked
    const active = pickActiveBoard(boards, null)

    // The one that can still be finalized goes on screen
    expect(active?.id).toBe('next')
  })

  it('takes the first board still to open when every board is finalized', () => {
    // An opened board, then two still to open
    const boards = [
      board('opened', 'opened'),
      board('first', 'finalized'),
      board('second', 'finalized'),
    ]

    // Nothing picked
    const active = pickActiveBoard(boards, null)

    // The first one still to open goes on screen
    expect(active?.id).toBe('first')
  })

  it('takes the newest board when every board has opened', () => {
    // Every board opened, oldest first
    const boards = [board('older', 'opened'), board('newer', 'opened')]

    // Nothing picked
    const active = pickActiveBoard(boards, null)

    // The newest one goes on screen
    expect(active?.id).toBe('newer')
  })
})
