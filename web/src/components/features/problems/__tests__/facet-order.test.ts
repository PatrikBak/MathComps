import { describe, expect, it } from 'vitest'

import { sortByFacetOrder } from '../utils/facet-order'

describe('sortByFacetOrder', () => {
  it('orders values as the facet does, the ones it no longer offers last in the order they came', () => {
    // A facet offering three seasons, newest first
    const facetOptions = [{ slug: '76' }, { slug: '75' }, { slug: '74' }]

    // The seasons filtered on, two of them gone from the facet, in the order they were picked
    const sorted = sortByFacetOrder(
      [{ slug: 'old-b' }, { slug: '74' }, { slug: 'old-a' }, { slug: '76' }],
      facetOptions
    )

    // The facet's own seasons lead in its order, the others trail as they were
    expect(sorted.map((value) => value.slug)).toEqual(['76', '74', 'old-b', 'old-a'])
  })
})
