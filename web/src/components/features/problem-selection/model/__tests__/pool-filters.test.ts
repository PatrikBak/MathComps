import { describe, expect, it } from 'vitest'

import { matchPool, OPEN_POOL_FILTER } from '../pool-filters'
import type { Board, Proposal } from '../selection-types'

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
    isSetAside: false,
    isUsed: false,
    ...changes,
  }
}

describe('matchPool', () => {
  it('shows the live problems no round has taken, lowest number first', () => {
    // Problem 2 sits in a round; 3 and 1 sit in none
    const proposals = [proposal(3), proposal(2, { isUsed: true }), proposal(1)]

    // The pool, filtered by nothing
    const matches = matchPool(proposals, OPEN_POOL_FILTER, null)

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
    const matches = matchPool(proposals, { ...OPEN_POOL_FILTER, categories: ['advanced'] }, null)

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
    const geometry = matchPool(proposals, { ...OPEN_POOL_FILTER, areas: ['geometry'] }, null)

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
      null
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
      null
    )

    // Nothing shows
    expect(searched.shown).toEqual([])

    // Yet the set-aside problem still counts
    expect(searched.setAsideCount).toBe(1)

    // The set-aside view, searched for nothing
    const open = matchPool(proposals, { ...OPEN_POOL_FILTER, isShowingSetAside: true }, null)

    // Only the set-aside problem shows
    expect(open.shown.map((shown) => shown.number)).toEqual([1])

    // The live view, searched for nothing
    const live = matchPool(proposals, OPEN_POOL_FILTER, null)

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
    const selected = matchPool(proposals, { ...OPEN_POOL_FILTER, membership: 'selected' }, board)

    // Problems 1 and 3
    expect(selected.shown.map((shown) => shown.number)).toEqual([1, 3])

    // Both answers still counted over the whole pool, their own filter left out
    expect(selected.membershipCounts).toEqual({ selected: 2, notSelected: 1 })

    // The pool narrowed to what the board does not hold
    const notSelected = matchPool(
      proposals,
      { ...OPEN_POOL_FILTER, membership: 'notSelected' },
      board
    )

    // Problem 2 alone
    expect(notSelected.shown.map((shown) => shown.number)).toEqual([2])

    // The pool narrowed to geometry, on the board or off it
    const geometry = matchPool(proposals, { ...OPEN_POOL_FILTER, areas: ['geometry'] }, board)

    // Only the two geometry problems counted
    expect(geometry.membershipCounts).toEqual({ selected: 1, notSelected: 1 })
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
      null
    )

    // Searched by its name, in capitals
    const byName = matchPool(
      [trapezoid, proposal(1)],
      { ...OPEN_POOL_FILTER, query: 'TRAPEZ' },
      null
    )

    // Searched by a word of its Slovak statement
    const byStatement = matchPool(
      [trapezoid, proposal(1)],
      { ...OPEN_POOL_FILTER, query: 'kruh' },
      null
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
    const bare = matchPool([circle, proposal(1)], { ...OPEN_POOL_FILTER, query: 'kruznica' }, null)

    // Searched with the diacritics, in capitals
    const accented = matchPool(
      [circle, proposal(1)],
      { ...OPEN_POOL_FILTER, query: 'KRUŽNICA' },
      null
    )

    // Each search finds problem 4 alone
    expect(bare.shown.map((shown) => shown.number)).toEqual([4])
    expect(accented.shown.map((shown) => shown.number)).toEqual([4])
  })
})
