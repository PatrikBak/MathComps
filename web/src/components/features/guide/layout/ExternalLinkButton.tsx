import { ExternalLink } from 'lucide-react'
import React from 'react'

import { cn } from '@/components/shared/utils/css-utils'
import { shortenYouTubeUrls } from '@/components/shared/utils/string-utils'

import { GUIDE_STYLES } from './guide-styles'

/**
 * Reusable external link component with consistent styling.
 * Used throughout the guide for all external resource links.
 */
type ExternalLinkButtonProps = {
  href: string
  /** Custom text to display instead of the URL. If not provided, the URL will be formatted and displayed. */
  customText?: string
}

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
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        GUIDE_STYLES.link,
        'inline-flex items-center gap-1.5 text-sm sm:text-base no-underline'
      )}
    >
      <ExternalLink size={13} />
      {displayText}
    </a>
  )
}
