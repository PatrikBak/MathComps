import type { Messages } from 'next-intl'

import { ROUTES } from '@/i18n/i18n'

/**
 * One destination in the site's main navigation.
 */
type NavigationItem = {
  /** Where it goes. */
  href: string
  /** Its label's key in the `navigation` namespace. */
  labelKey: keyof Messages['navigation']
  /** Whether only an admin sees it. */
  adminOnly: boolean
}

/**
 * Every destination the main navigation offers, in the order it offers them.
 *
 * Held here rather than in either navigation, so the header and the drawer cannot disagree.
 */
const NAVIGATION_ITEMS: NavigationItem[] = [
  { href: ROUTES.PROBLEMS, labelKey: 'problems', adminOnly: false },
  { href: ROUTES.HANDOUTS, labelKey: 'handouts', adminOnly: false },
  // The competitions, while they are still being built out
  { href: ROUTES.COMPETITIONS, labelKey: 'competitions', adminOnly: true },
  { href: ROUTES.GUIDE, labelKey: 'guide', adminOnly: false },
  { href: ROUTES.NEWS, labelKey: 'news', adminOnly: false },
]

/**
 * The destinations a given reader is offered.
 *
 * @param isAdmin - Whether the reader gets the sections that are not announced yet.
 *
 * @returns The navigation items to render, in order.
 */
export function visibleNavigationItems(isAdmin: boolean): NavigationItem[] {
  // Hold back the sections that are not announced yet
  return NAVIGATION_ITEMS.filter((item) => isAdmin || !item.adminOnly)
}
