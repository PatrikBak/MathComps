import type { ReactNode } from 'react'

import { AppLink } from '@/components/shared/components/AppLink'
import { HelpTooltip } from '@/components/shared/components/HelpTooltip'
import { cn } from '@/components/shared/utils/css-utils'

import type { HandoutSource } from './handout-metadata-types'
import { HANDOUT_SOURCE_COLORS } from './handout-style-colors'

/**
 * Props for the {@link HandoutStyleBadge} component.
 */
type HandoutStyleBadgeProps = {
  /** Source/origin of the handout (drives the color scheme) */
  source: HandoutSource
  /** Text displayed inside the pill */
  label: string
  /**
   * Optional external URL. When provided, the entire badge becomes a
   * clickable link opening in a new tab.
   */
  href?: string
  /**
   * Optional tooltip content rendered inside the badge as a small `?` icon.
   * Used for event descriptions that elaborate on the event name.
   */
  tooltipContent?: ReactNode
  /** Additional Tailwind classes to merge */
  className?: string
}

/**
 * Small colored pill displaying a handout's source label. The caller is
 * responsible for providing the localized `label` string (either a translated
 * source name or a specific event name). Accepts an optional `?` tooltip
 * rendered inline and an optional `href` that makes the whole pill clickable.
 */
export function HandoutStyleBadge({
  source,
  label,
  href,
  tooltipContent,
  className,
}: HandoutStyleBadgeProps) {
  // Get the color scheme
  const scheme = HANDOUT_SOURCE_COLORS[source]

  // Prepare the badge component
  const pill = (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] sm:text-xs font-medium',
        scheme.bg,
        scheme.text,
        href && 'hover:opacity-80 transition-opacity',
        className
      )}
    >
      {label}
      {tooltipContent && (
        <span className="pointer-events-auto inline-flex">
          <HelpTooltip content={tooltipContent} />
        </span>
      )}
    </span>
  )

  // When an external href is set, return an app link which makes the pill clickable
  if (href) {
    return (
      <AppLink href={href} external newTab className="pointer-events-auto inline-flex">
        {pill}
      </AppLink>
    )
  }

  // With no href just return the pill
  return pill
}
