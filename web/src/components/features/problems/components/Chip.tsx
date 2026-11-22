import type { MouseEvent, ReactNode } from 'react'

import { cn } from '@/components/shared/utils/css-utils'
import { EXCLUSIVE_LONG_PRESS } from '@/components/shared/utils/event-utils'
import { useSmartLongPress } from '@/hooks/use-smart-long-press'

/**
 * What every chip is drawn with, selected or not. The edge is always there, so selecting a chip moves nothing.
 */
const CHIP_CLASS =
  'inline-flex max-w-full items-center gap-1.5 rounded-full border px-1.5 py-0.5 text-[11px] font-medium transition-colors sm:px-2 sm:py-1 sm:text-[12px]'

/**
 * How a chip reads in one of its states, at rest and under the pointer.
 */
type ChipTint = {
  /** The chip's edge, fill and text at rest. */
  restClass: string
  /** How a clickable chip answers the pointer. */
  hoverClass: string
}

/**
 * A chip standing for something filtered on: a deeper focus tint, edged.
 */
const SELECTED_TINT: ChipTint = {
  restClass: 'border-focus-light/50 bg-focus/45 text-focus-foreground',
  hoverClass: 'hover:border-focus-light/70 hover:bg-focus/55',
}

/**
 * Any other chip: a faint focus tint, its edge clear.
 */
const UNSELECTED_TINT: ChipTint = {
  restClass: 'border-transparent bg-focus/20 text-focus-tint',
  hoverClass: 'hover:border-focus-light/60 hover:bg-focus/30',
}

/**
 * The props of {@link Chip}.
 */
type ChipProps = {
  /** What the chip reads. */
  children: ReactNode
  /**
   * Acts on a click, or on a long press, which reads as a click with the modifier held. A chip without one is a
   * plain label.
   */
  onClick?: (event: MouseEvent) => void
  /** Whether the chip stands for something already filtered on. */
  isSelected?: boolean
  /** The chip's tooltip; a chip reading plain text shows that text without one. */
  title?: string
  /** Classes for the chip on top of its own. */
  className?: string
}

/**
 * A small rounded label for one value, such as a tag or a filter. Given a click handler it acts as a control,
 * and a long press asks for that value alone.
 */
export default function Chip({
  children,
  onClick,
  isSelected = false,
  title,
  className,
}: ChipProps) {
  // The handlers answering a long press, which a touchscreen offers in place of the modifier
  const longPressHandlers = useSmartLongPress(() => onClick?.(EXCLUSIVE_LONG_PRESS))

  // Whether the chip acts on a click at all
  const isClickable = onClick !== undefined

  // How the chip reads in its state
  const tint = isSelected ? SELECTED_TINT : UNSELECTED_TINT

  return (
    <span
      className={cn(
        CHIP_CLASS,
        tint.restClass,
        isClickable && tint.hoverClass,
        isClickable && 'select-none',
        className
      )}
      onClick={onClick}
      {...(isClickable ? longPressHandlers : {})}
      data-clickable={isClickable ? 'true' : undefined}
      title={title ?? (typeof children === 'string' ? children : undefined)}
    >
      {/* The value, kept on one line and cut short where the room runs out */}
      <span className="truncate">{children}</span>
    </span>
  )
}
