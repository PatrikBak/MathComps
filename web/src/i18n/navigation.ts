import { createNavigation } from 'next-intl/navigation'

import { routing } from './i18n'

/** Localized navigation utilities for client- and server-side routing. */
export const { Link, usePathname, useRouter, redirect, getPathname } = createNavigation(routing)
