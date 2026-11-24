import * as React from 'react'

import { cn } from '../utils/css-utils'
import { LoadingSpinner } from './LoadingSpinner'

/**
 * The hue a highlighted count reads in.
 */
type CountBadgeColor = 'indigo' | 'red'

/**
 * How the icon and its badge are tinted in one state.
 */
type CountBadgeTheme = {
  /** The badge's fill and text. */
  badgeClass: string
  /** The icon's colour. */
  iconClass: string
}

/**
 * How a highlighted count is tinted, in each hue.
 */
const HIGHLIGHTED_THEMES: Record<CountBadgeColor, CountBadgeTheme> = {
  indigo: { badgeClass: 'bg-focus text-focus-foreground', iconClass: 'text-focus' },
  red: { badgeClass: 'bg-error text-error-foreground', iconClass: 'text-error' },
}

/**
 * How a count reads while nothing highlights it, whatever its hue.
 */
const MUTED_THEME: CountBadgeTheme = {
  badgeClass: 'bg-surface text-muted',
  iconClass: 'text-muted',
}

/**
 * Props for the {@link CountBadge} component.
 */
type CountBadgeProps = {
  /** The icon the count belongs to. */
  children: React.ReactNode
  /** How many of what the icon stands for there are. */
  count: number
  /** The hue the icon and its badge take while highlighted. */
  color: CountBadgeColor
  /** Classes for the box holding the icon and its badge. */
  className?: string
  /** Whether the count stands out, such as a problem the reader liked or a thread with comments in it. */
  isHighlighted: boolean
  /** Whether the count is still on its way. */
  isLoading?: boolean
}

/**
 * An icon with a count floating at its corner, for things like likes and comments. Once loaded, a count of zero
 * shows the icon alone.
 */
export function CountBadge({
  children,
  count,
  color,
  className,
  isHighlighted,
  isLoading = false,
}: CountBadgeProps) {
  // How the icon and the badge are tinted in their state
  const theme = isHighlighted ? HIGHLIGHTED_THEMES[color] : MUTED_THEME

  // Whether the badge shows: while the count loads, or once there is anything to count
  const isBadgeShown = isLoading || count > 0

  return (
    <span className={cn('relative inline-flex items-center justify-center', className)}>
      {/* The icon */}
      <span className={cn('transition-colors duration-200', theme.iconClass)}>{children}</span>

      {/* The badge */}
      {isBadgeShown && (
        <span
          className={cn(
            'absolute -top-1.5 -right-2.5',
            'inline-flex items-center justify-center px-1.5 h-4.5 min-w-[1.125rem]',
            'text-[10px] font-bold rounded-full shadow-sm border transition-all duration-300',
            theme.badgeClass,
            isHighlighted ? 'border-foreground/20' : 'border-foreground/10',
            isLoading && 'bg-surface'
          )}
        >
          {isLoading ? <LoadingSpinner className="w-2.5 h-2.5 border-[1.5px]" /> : count}
        </span>
      )}
    </span>
  )
}
