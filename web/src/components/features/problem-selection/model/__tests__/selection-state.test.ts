import { describe, expect, it } from 'vitest'

import { resolveText, unreadyLanguages } from '../selection-state'
import type { Proposal } from '../selection-types'

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
