import { describe, expect, it } from 'vitest'

import { describeProblemRef } from '../problem-ref-label'
import type { ProblemSource } from '../types/problem-api-types'

/**
 * A problem out of a competition three levels deep, which is the depth at which the parts of its name carry
 * different weights.
 */
const SOURCE: ProblemSource = {
  season: { slug: '76', displayName: 'Edition 76 (2026/2027)', fullName: null },
  startYear: 2026,
  competition: [
    { slug: 'mc', displayName: 'MathComps', fullName: null },
    { slug: 'mc-advanced', displayName: 'Advanced', fullName: null },
    { slug: 'mc-advanced-1', displayName: 'September', fullName: null },
  ],
  number: 2,
}

describe('describeProblemRef', () => {
  it('leaves the competition itself out of what it sits under', () => {
    // The problem as it reads
    const label = describeProblemRef(SOURCE, 'Problem')

    // The context is everything above the competition, which the line gives up first when it runs out of room
    expect(label.context).toEqual(['MathComps', 'Advanced'])

    // While the competition itself leads the part that stays, since it is what names the run
    expect(label.edition).toBe('September 2026/2027')
  })

  it('says the season as the two calendar years it ran across, not as an edition number', () => {
    // The same problem, whose season labels itself by an edition number every competition in it borrows
    const label = describeProblemRef(SOURCE, 'Problem')

    // That number says nothing true about most of them, so the calendar years stand in its place
    expect(label.edition).not.toContain('76')
    expect(label.edition).toContain('2026/2027')
  })

  it('names the problem in the words the surface asking uses', () => {
    // The same problem, asked for in Slovak
    const label = describeProblemRef(SOURCE, 'Úloha')

    // The problem in the words that surface uses
    expect(label.problem).toBe('Úloha 2')
  })
})
