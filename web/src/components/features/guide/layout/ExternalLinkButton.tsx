import { ExternalLink } from 'lucide-react'
import React, { type ReactNode } from 'react'

import { AppLink } from '@/components/shared/components/AppLink'
import { cn } from '@/components/shared/utils/css-utils'
import { shortenYouTubeUrls } from '@/components/shared/utils/string-utils'

/**
 * Props for the {@link ExternalLinkButton} component.
 */
type ExternalLinkButtonProps = {
  /** External destination URL. */
  href: string
  /** Label override; falls back to the formatted URL when absent. */
  customText?: string
  /** Leading glyph; defaults to the external-link arrow (e.g. a flag for a national variant). */
  icon?: ReactNode
}

/**
 * Reusable external link renderer for guide resources and competition links.
 */
export function ExternalLinkButton({ href, customText, icon }: ExternalLinkButtonProps) {
  // The label: the caller's text, else the URL stripped to a readable, YouTube-shortened form
  const displayText =
    customText || shortenYouTubeUrls(href.replace(/^https?:\/\//, '').replace(/\/$/, ''))

  // Render the link with the chosen glyph and display text
  return (
    <AppLink
      href={href}
      external
      newTab
      className={cn(
        'inline-flex items-center gap-1.5 text-sm text-link no-underline transition-colors hover:text-link-hover sm:text-base'
      )}
    >
      {/* Leading glyph: the caller's, or the default external-link arrow */}
      {icon ?? <ExternalLink size={13} />}
      {displayText}
    </AppLink>
  )
}
