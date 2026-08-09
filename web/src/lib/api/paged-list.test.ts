import { describe, expect, it } from 'vitest'

import { dedupePagedItems, type PagedList } from './paged-list'

/**
 * One item of a paged list, carrying nothing beyond what identifies it since the flattening reads nothing else.
 */
type Item = {
  /** What identifies it. */
  id: string
}

/**
 * One page of results, as an endpoint serves it.
 *
 * @param ids - What the page holds, as identities.
 * @returns The page.
 */
function page(ids: string[]): PagedList<Item> {
  // A page of that many items, its counts standing in for a list nothing else is read off
  return {
    items: ids.map((id) => ({ id })),
    page: 1,
    pageSize: 20,
    totalCount: ids.length,
  }
}

/**
 * Flattens pages of the fixture items, which every case here does.
 *
 * @param pages - The pages loaded so far.
 * @returns What the flattened list holds, as identities.
 */
function flatten(pages: PagedList<Item>[]): string[] {
  // The flattened list, read as the identities it lists
  return dedupePagedItems(pages, (item) => item.id).map((item) => item.id)
}

describe('dedupePagedItems', () => {
  it('keeps an item where it was first seen when a later page brings it back', () => {
    // An item written between the two fetches, which moves up and comes back on the second page
    expect(flatten([page(['s1', 's2']), page(['s2', 's3'])])).toEqual(['s1', 's2', 's3'])
  })

  it('keeps one copy of an item a single page lists twice', () => {
    // A page that repeated itself, which the reader should still see one of
    expect(flatten([page(['s1', 's2', 's1'])])).toEqual(['s1', 's2'])
  })

  it('reads the pages in the order they were asked for', () => {
    // Three pages with nothing in common, so only the ordering is under test
    expect(flatten([page(['s1', 's2']), page(['s3']), page(['s4', 's5'])])).toEqual([
      's1',
      's2',
      's3',
      's4',
      's5',
    ])
  })

  it('reads nothing out of nothing', () => {
    // The state before the first page arrives
    expect(flatten([])).toEqual([])
  })

  it('reads past a page that holds nothing', () => {
    // The page a narrowing leaves empty, sitting ahead of one that isn't
    expect(flatten([page([]), page(['s1'])])).toEqual(['s1'])
  })
})
