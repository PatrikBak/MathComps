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
}

/**
 * Every destination the main navigation offers, in the order it offers them.
 *
 * Held here rather than in either navigation, so the header and the drawer cannot disagree.
 */
export const NAVIGATION_ITEMS: NavigationItem[] = [
  { href: ROUTES.PROBLEMS, labelKey: 'problems' },
  { href: ROUTES.HANDOUTS, labelKey: 'handouts' },
  { href: ROUTES.COMPETITIONS, labelKey: 'competitions' },
  { href: ROUTES.GUIDE, labelKey: 'guide' },
  { href: ROUTES.NEWS, labelKey: 'news' },
]
