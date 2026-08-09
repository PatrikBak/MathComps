/**
 * One page of results, as every paged endpoint the backend serves puts it on the wire.
 *
 * @template TItem - What the page holds.
 */
export type PagedList<TItem> = {
  /** The page's items, in the order the endpoint serves them. */
  items: TItem[]
  /** Which page it is, counting from 1. */
  page: number
  /** How many items a full page holds. */
  pageSize: number
  /** How many items the narrowing leaves in all. */
  totalCount: number
}

/**
 * Flattens loaded pages into the one list they read as, keeping the first sighting of each item.
 *
 * An item written between two fetches moves the boundary the pages were cut at, so it can come back on both
 * of them; a list read newest-first over data that keeps moving has to deal with it.
 *
 * @template TItem - What a page of results holds.
 * @param pages - The pages loaded so far, in the order they were asked for.
 * @param getId - Says which item a page's entry is, so two sightings of one can be told apart from two items.
 * @returns The items, in the order the pages served them.
 */
export function dedupePagedItems<TItem>(
  pages: readonly PagedList<TItem>[],
  getId: (item: TItem) => string
): TItem[] {
  // Which items have already been taken
  const seen = new Set<string>()

  // Every page's items, each one kept only the first time it shows up
  return pages.flatMap((page) =>
    page.items.filter((item) => {
      // Already taken off an earlier page
      if (seen.has(getId(item))) return false

      // Taken now, so a later page can't bring it back
      seen.add(getId(item))

      // Kept
      return true
    })
  )
}
