import { useLongPress } from '@mantine/hooks'
import * as React from 'react'

import { cn } from '../../../shared/utils/css-utils'
import { LONG_PRESS_THRESHOLD_MS } from '../../../shared/utils/event-utils'

/**
 * Chip Component for individual filter items.
 */
export default function Chip({
  children,
  onClick,
  clickable = false,
  isSelected = false,
  title,
  className,
}: {
  children: React.ReactNode
  onClick?: (event: React.MouseEvent) => void
  clickable?: boolean
  isSelected?: boolean
  title?: string
  className?: string
}) {
  // Long-press handler for exclusive selection on mobile
  const longPressHandlers = useLongPress(
    () => {
      if (clickable && onClick) {
        // Create a synthetic event that will be treated as exclusive selection
        // by checking for a custom property
        const syntheticEvent = {
          ctrlKey: true,
          metaKey: false,
        } as React.MouseEvent
        onClick(syntheticEvent)
      }
    },
    {
      threshold: LONG_PRESS_THRESHOLD_MS,
    }
  )

  // Determine styling based on selected state and clickable state
  const getChipStyling = () => {
    const baseStyles =
      'inline-flex max-w-full items-center gap-1.5 rounded-full py-1 px-2 text-[12px] font-medium transition-colors border'

    if (isSelected) {
      // Selected state: bright indigo background with white text
      const selectedStyles = 'border-indigo-400 bg-indigo-500/80 text-white'
      const hoverStyles = clickable ? 'hover:bg-indigo-400/90 hover:border-indigo-300' : ''
      return `${baseStyles} ${selectedStyles} ${hoverStyles}`
    } else {
      // Default state: subtle indigo background
      const defaultStyles = 'border-slate-600/60 bg-indigo-600/20 text-indigo-100'
      const hoverStyles = clickable ? 'hover:bg-indigo-500/30 hover:border-indigo-400/60' : ''
      return `${baseStyles} ${defaultStyles} ${hoverStyles}`
    }
  }

  return (
    <span
      className={cn(getChipStyling(), clickable && 'select-none', className)}
      onClick={(event) => {
        if (clickable && onClick) {
          onClick(event)
        }
      }}
      {...(clickable ? longPressHandlers : {})}
      data-clickable={clickable ? 'true' : undefined}
      title={title || (typeof children === 'string' ? children : undefined)}
    >
      {/* Display full tag text without truncation, but keep it on one line */}
      <span className="truncate">{children}</span>
    </span>
  )
}
