import type { ComponentPropsWithoutRef, MouseEvent } from 'react'

import { AppLink } from '@/components/shared/components/AppLink'
import { focusForReader } from '@/components/shared/utils/focus-utils'

import { SANITIZED_ID_PREFIX } from '../utils/markdown-pipeline'

/**
 * Props for the {@link RichMathEditorInPageLink} component.
 */
type RichMathEditorInPageLinkProps = ComponentPropsWithoutRef<'a'> & {
  /** Where the link points within the content: `#` and its target's id as the content writes it. */
  href: string
}

/**
 * A link to a place within the same rendered content, such as a footnote mark or the back link in its footnote.
 * Pressing it brings the target into view inside whatever scrolls the content, a dialog included, and keeps the
 * page's address.
 */
export function RichMathEditorInPageLink({
  href,
  children,
  ...attributes
}: RichMathEditorInPageLinkProps) {
  // A function which brings the link's target into view and hands it the focus
  const reachTarget = (event: MouseEvent<HTMLAnchorElement>) => {
    // The page keeps its address, whether or not the target exists
    event.preventDefault()

    // The element the link points at, under the id the sanitizer gave it
    const target = document.getElementById(`${SANITIZED_ID_PREFIX}${href.slice(1)}`)

    // A link to nothing in the content does nothing
    if (target === null) return

    // The target, in the middle of whatever scrolls it
    target.scrollIntoView({ block: 'center' })

    // Where the focus goes: the target when it is a link, otherwise the first link in it
    const landing = target instanceof HTMLAnchorElement ? target : target.querySelector('a')

    // The focus there, so the next Tab goes on from the target
    focusForReader(landing, { preventScroll: true })
  }

  // The link, staying on the page
  return (
    <AppLink href={href} plain onClick={reachTarget} {...attributes}>
      {children}
    </AppLink>
  )
}
