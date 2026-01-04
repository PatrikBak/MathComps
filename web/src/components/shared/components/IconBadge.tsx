import * as React from 'react'

import { cn } from '../utils/css-utils'
import { LoadingSpinner } from './LoadingSpinner'

/**
 * Props for the {@link IconBadge} component.
 */
type IconBadgeProps = {
  /** The icon component to display. */
  children: React.ReactNode
  /** The numeric count to display in the badge. */
  count: number
  /** Color theme for the badge and icon highlight. */
  color?: 'indigo' | 'red' | 'gray'
  /** Optional additional class for the container. */
  className?: string
  /** Whether the badge should be highlighted (e.g. if liked or has comments). */
  isHighlighted?: boolean
  /** Whether the data for the badge is currently loading. */
  isLoading?: boolean
}

/**
 * A reusable component that renders an icon with a floating count badge.
 * Used for engagement metrics like likes and comment counts.
 */
export function IconBadge({
  children,
  count,
  color = 'indigo',
  className,
  isHighlighted = false,
  isLoading = false,
}: IconBadgeProps) {
  // Define color variations
  const colorMap = {
    indigo: {
      badge: 'bg-indigo-500 text-white',
      icon: 'text-indigo-400',
      border: 'border-indigo-500/20',
    },
    red: {
      badge: 'bg-red-500 text-white',
      icon: 'text-red-400',
      border: 'border-red-500/20',
    },
    gray: {
      badge: 'bg-slate-800 text-gray-500',
      icon: 'text-gray-400',
      border: 'border-slate-600/30',
    },
  }

  // Determine which theme to use based on highlighted state
  const activeTheme = isHighlighted ? colorMap[color] : colorMap.gray

  return (
    <span className={cn('relative inline-flex items-center justify-center', className)}>
      {/* The Icon */}
      <span className={cn('transition-colors duration-200', activeTheme.icon)}>{children}</span>

      {/* The Badge */}
      <span
        className={cn(
          'absolute -top-1.5 -right-2.5',
          'inline-flex items-center justify-center px-1.5 h-4.5 min-w-[1.125rem]',
          'text-[10px] font-bold rounded-full shadow-sm border transition-all duration-300',
          activeTheme.badge,
          isHighlighted ? 'border-white/20' : 'border-slate-600',
          isLoading && 'bg-slate-800'
        )}
      >
        {isLoading ? <LoadingSpinner className="w-2.5 h-2.5 border-[1.5px]" /> : count}
      </span>
    </span>
  )
}
