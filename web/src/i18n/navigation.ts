import { createNavigation } from 'next-intl/navigation'

import { routing } from './i18n'

/** Localized navigation utilities for client-side routing. */
export const { Link, usePathname, useRouter } = createNavigation(routing)
