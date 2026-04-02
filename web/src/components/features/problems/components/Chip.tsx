import * as React from 'react'

import { useSmartLongPress } from '@/hooks/use-smart-long-press'

import { cn } from '../../../shared/utils/css-utils'

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
  const longPressHandlers = useSmartLongPress(() => {
    if (clickable && onClick) {
      onClick({
        ctrlKey: true,
        metaKey: false,
      } as React.MouseEvent)
    }
  })

  // Determine styling based on selected state and clickable state
  const getChipStyling = () => {
    const baseStyles =
      'inline-flex max-w-full items-center gap-1.5 rounded-full py-0.5 px-1.5 sm:py-1 sm:px-2 text-[11px] sm:text-[12px] font-medium transition-colors border'

    if (isSelected) {
      // Selected state: bright indigo background with white text
      const selectedStyles = 'border-focus-light bg-focus/80 text-focus-foreground'
      const hoverStyles = clickable ? 'hover:bg-focus-light/90 hover:border-focus-light' : ''
      return `${baseStyles} ${selectedStyles} ${hoverStyles}`
    } else {
      // Default state: subtle indigo background
      const defaultStyles = 'border-muted/40 bg-focus/20 text-focus-tint'
      const hoverStyles = clickable ? 'hover:bg-focus/30 hover:border-focus-light/60' : ''
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
