import { describe, expect, it } from 'vitest'

import { emptyListReason } from '../utils/empty-list-reason'
import { createDefaultFilters } from '../utils/url-initialization'

/** A tag to filter on. */
const TAG = { slug: 'combinatorics', displayName: 'Combinatorics', fullName: null }

describe('emptyListReason', () => {
  it('blames the filters for an empty list whenever anything narrows it, inside the favorites too', () => {
    // A tag inside the favorites
    const reason = emptyListReason({ ...createDefaultFilters(), favoritesOnly: true, tags: [TAG] })

    // The tag is what matched nothing
    expect(reason).toBe('filters')

    // The mark status alone narrows a list as much
    expect(
      emptyListReason({ ...createDefaultFilters(), listContentId: 'list-1', markStatus: 'marked' })
    ).toBe('filters')
  })

  it('names the favorites or the list being browsed once nothing narrows it', () => {
    // The favorites alone
    expect(emptyListReason({ ...createDefaultFilters(), favoritesOnly: true })).toBe('favorites')

    // A list alone
    expect(emptyListReason({ ...createDefaultFilters(), listContentId: 'list-1' })).toBe('list')
  })
})
