import { describe, expect, it } from 'vitest'

import type { LabeledSlug } from '../types/problem-api-types'
import { clearFilters, toggleFilterValue } from '../utils/filter-update-utils'
import { createDefaultFilters } from '../utils/url-initialization'

/** A tag filtered on. */
const ALGEBRA: LabeledSlug = { slug: 'algebra', displayName: 'Algebra', fullName: null }

/** Another tag filtered on. */
const GEOMETRY: LabeledSlug = { slug: 'geometry', displayName: 'Geometry', fullName: null }

/** A tag nothing filters on yet. */
const COMBINATORICS: LabeledSlug = {
  slug: 'combinatorics',
  displayName: 'Combinatorics',
  fullName: null,
}

describe('toggleFilterValue', () => {
  it('keeps a value filtered on alone after a modified click, rather than taking it out', () => {
    // A modified click on one of two tags filtered on
    const values = toggleFilterValue([ALGEBRA, GEOMETRY], GEOMETRY, true)

    // Geometry is all that is left
    expect(values).toEqual([GEOMETRY])
  })

  it('takes a value filtered on out on a plain click, and adds any other one at the end', () => {
    // A plain click on a tag filtered on
    const withoutAlgebra = toggleFilterValue([ALGEBRA, GEOMETRY], ALGEBRA, false)

    // Algebra is gone, Geometry still there
    expect(withoutAlgebra).toEqual([GEOMETRY])

    // A plain click on a tag nothing filters on
    const withCombinatorics = toggleFilterValue([ALGEBRA, GEOMETRY], COMBINATORICS, false)

    // Combinatorics joins after the tags already there
    expect(withCombinatorics).toEqual([ALGEBRA, GEOMETRY, COMBINATORICS])
  })
})

describe('clearFilters', () => {
  it('clears every filter, the mark status included, inside the list or the favorites being browsed', () => {
    // A list being browsed under a search, a tag and a mark status
    const inList = {
      ...createDefaultFilters(),
      searchText: 'triangle',
      searchInSolution: true,
      tags: [ALGEBRA],
      markStatus: 'marked' as const,
      listContentId: 'study-group',
    }

    // Cleared
    const clearedList = clearFilters(inList)

    // The list stays and nothing else does
    expect(clearedList).toEqual({
      ...createDefaultFilters(),
      listContentId: 'study-group',
    })

    // The favorites under a tag
    const inFavorites = { ...createDefaultFilters(), tags: [GEOMETRY], favoritesOnly: true }

    // Cleared the same way
    const clearedFavorites = clearFilters(inFavorites)

    // The favorites stay
    expect(clearedFavorites).toEqual({ ...createDefaultFilters(), favoritesOnly: true })
  })
})
