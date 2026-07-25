import { useParams } from 'next/navigation'

import { ROUTES } from '@/i18n/i18n'
import { usePathname } from '@/i18n/navigation'

/**
 * Whether the reader already has a given handout open, which turns a link into that handout into a scroll
 * within the page.
 *
 * Answered from the route and its slug, the only signals that tell handouts apart: an environment's anchor
 * id is unique within its handout but not across handouts, so a namesake elsewhere would pass for this one.
 * Every uncertain case answers false, leaving the link to navigate.
 *
 * @param handoutSlug - The handout's slug in the active locale, or null when it has none there.
 * @returns Whether that handout's page is the one being read.
 */
export function useIsCurrentHandout(handoutSlug: string | null): boolean {
  // The route the reader is on, as its internal template rather than the localized path they see
  const pathname = usePathname()

  // The dynamic segments of that route
  const params = useParams()

  // Hand back whether that route is this handout's own page
  return handoutSlug !== null && pathname === ROUTES.HANDOUT_DETAIL && params.slug === handoutSlug
}
