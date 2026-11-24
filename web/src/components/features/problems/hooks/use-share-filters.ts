import { useClipboard } from '@mantine/hooks'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'

import { addressedOptionQuery } from '@/components/shared/utils/url-utils'

import { getProblemsPageUrl } from '../services/problem-routes'
import type { ProblemCardView } from '../types/problem-card-types'
import type { SearchFiltersState } from '../types/problem-library-types'
import { PROBLEM_CARD_VIEW_CHOICE, serializeFilters } from '../utils/search-url-serialization'

/**
 * The options of {@link useShareFilters}.
 */
type UseShareFiltersOptions = {
  /** The filters the link carries. */
  filters: SearchFiltersState
  /** How the cards are drawn, which the link carries. */
  cardView: ProblemCardView
}

/**
 * A function which copies a link to the library under some filters and card view, and says so in a toast.
 *
 * @param options - The filters and the way the cards are drawn.
 * @returns The function copying the link.
 */
export function useShareFilters({ filters, cardView }: UseShareFiltersOptions): () => void {
  // Translations for the shared actions
  const tActions = useTranslations('ui.actions')

  // The clipboard
  const clipboard = useClipboard()

  // A function which copies the link
  const shareFilters = () => {
    // The filters and the card view as the address writes them, each left out where it says nothing
    const query = [
      serializeFilters(filters),
      addressedOptionQuery(PROBLEM_CARD_VIEW_CHOICE, cardView),
    ]
      .filter((part) => part !== '')
      .join('&')

    // The library's address, carrying the query where there is one
    const shareUrl = `${window.location.origin}${getProblemsPageUrl(query)}`

    // Copied
    clipboard.copy(shareUrl)

    // And said so
    toast.success(tActions('linkCopied'))
  }

  // The function copying the link
  return shareFilters
}
