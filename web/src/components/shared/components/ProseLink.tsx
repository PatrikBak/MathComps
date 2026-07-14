import type { ReactNode } from 'react'

import { AppLink } from './AppLink'

/**
 * An inline text link used inside a sentence of prose, always underlined so it doesn't rely on color
 * alone to read as a link.
 */
export const PROSE_LINK_CLASS =
  'font-medium text-link underline underline-offset-2 hover:text-link-hover'

/**
 * Props for the {@link ProseLink} component.
 */
type ProseLinkProps = {
  /** The destination URL. */
  href: string
  /** Whether to open the link in a new tab. */
  newTab?: boolean
  /** The link's visible text. */
  children: ReactNode
}

/**
 * An inline text link for use inside prose.
 */
export function ProseLink({ href, newTab, children }: ProseLinkProps) {
  return (
    <AppLink href={href} newTab={newTab} plain className={PROSE_LINK_CLASS}>
      {children}
    </AppLink>
  )
}
