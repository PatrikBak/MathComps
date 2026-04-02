import { ExternalLink } from 'lucide-react'
import React from 'react'

import { AppLink } from '@/components/shared/components/AppLink'
import { cn } from '@/components/shared/utils/css-utils'
import { shortenYouTubeUrls } from '@/components/shared/utils/string-utils'

/**
 * Props for the {@link ExternalLinkButton} component.
 */
type ExternalLinkButtonProps = {
  /** External destination URL. */
  href: string
  /** Custom text to display instead of the URL. If not provided, the URL will be formatted and displayed. */
  customText?: string
}

/**
 * Reusable external link renderer for guide resources and competition links.
 */
export function ExternalLinkButton({ href, customText }: ExternalLinkButtonProps) {
  let displayText

  // Use custom text if provided...
  if (customText) {
    displayText = customText
  } else {
    // Otherwise extract readable display text from URL
    displayText = href.replace(/^https?:\/\//, '').replace(/\/$/, '')

    // Shorten YouTube links to show only the channel/video identifier
    displayText = shortenYouTubeUrls(displayText)
  }

  return (
    <AppLink
      href={href}
      external
      newTab
      className={cn(
        'inline-flex items-center gap-1.5 text-sm text-link no-underline transition-colors hover:text-link-hover sm:text-base'
      )}
    >
      <ExternalLink size={13} />
      {displayText}
    </AppLink>
  )
}
