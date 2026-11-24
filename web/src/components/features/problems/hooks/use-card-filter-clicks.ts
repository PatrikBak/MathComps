import { useCallbackRef } from '@mantine/hooks'

import { isExclusiveSelection } from '@/components/shared/utils/event-utils'

import type { AuthorClickHandler, TagClickHandler } from '../types/problem-card-types'
import type { SearchFiltersState } from '../types/problem-library-types'
import { toggleFilterValue } from '../utils/filter-update-utils'

/**
 * The options of {@link useCardFilterClicks}.
 */
type UseCardFilterClicksOptions = {
  /** The filters currently applied, null until they have been read. */
  filters: SearchFiltersState | null
  /** Applies a change to the filters. */
  onFiltersChange: (newFilters: SearchFiltersState) => void
}

/**
 * What a problem's card does to the filters.
 */
type UseCardFilterClicksResult = {
  /** {@link TagClickHandler}. */
  toggleTag: TagClickHandler
  /** {@link AuthorClickHandler}. */
  toggleAuthor: AuthorClickHandler
  /** Shows the problems of one of the reader's lists, by the list's content id. */
  showList: (contentId: string) => void
}

/**
 * The ways a problem's card narrows the library: by one of its tags, by one of its authors, or to one of the reader's
 * lists. Each stays the same function for the page's life and acts on the filters as they stand when it runs, since
 * every card is handed them and a new one would draw every card's statement again.
 *
 * @param options - The filters and the way to change them.
 * @returns The functions applying a card's clicks to the filters.
 */
export function useCardFilterClicks({
  filters,
  onFiltersChange,
}: UseCardFilterClicksOptions): UseCardFilterClicksResult {
  // A function which filters by a tag, or takes it back out, or under the modifier filters by it alone
  const toggleTag = useCallbackRef<TagClickHandler>((tag, event) => {
    // Filters not yet read have nothing to change
    if (filters === null) return

    // The tag as a filter names it, under its short name alone
    const picked = { slug: tag.slug, displayName: tag.displayName, fullName: null }

    // The tags filtered on once the click is applied
    onFiltersChange({
      ...filters,
      tags: toggleFilterValue(filters.tags, picked, isExclusiveSelection(event)),
    })
  })

  // A function which filters by an author, or takes them back out, or under the modifier filters by them alone
  const toggleAuthor = useCallbackRef<AuthorClickHandler>((author, event) => {
    // Filters not yet read have nothing to change
    if (filters === null) return

    // The author as a filter names them, under their credited name alone
    const picked = { ...author, fullName: null }

    // The authors filtered on once the click is applied
    onFiltersChange({
      ...filters,
      authors: toggleFilterValue(filters.authors, picked, isExclusiveSelection(event)),
    })
  })

  // A function which shows the problems of one of the reader's lists, the liked view giving way to it
  const showList = useCallbackRef((contentId: string) => {
    // Filters not yet read have nothing to change
    if (filters === null) return

    // The list, in place of the liked problems
    onFiltersChange({ ...filters, favoritesOnly: false, listContentId: contentId })
  })

  // The functions applying a card's clicks
  return { toggleTag, toggleAuthor, showList }
}
