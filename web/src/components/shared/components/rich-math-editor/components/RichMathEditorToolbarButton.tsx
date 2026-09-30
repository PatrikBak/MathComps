import type { ComponentProps, ReactNode } from 'react'

import { cn } from '@/components/shared/utils/css-utils'
import { preventFocusLoss } from '@/components/shared/utils/dom-utils'

/**
 * Props for the {@link ToolbarButton} component.
 */
export type ToolbarButtonProps = {
  /** The icon the button reads as, or the glyph it is written with */
  mark: ReactNode
  /** What the button does, as its tooltip and as its words where it is a row */
  title: string
  /** Whether the button is a row of a list */
  isRow?: boolean
  /** Whether the button is a toggle that is on; a plain button leaves it out */
  isPressed?: boolean
  /** The words the button reads beside its mark, where it is not a row */
  children?: ReactNode
} & Omit<ComponentProps<'button'>, 'title' | 'children' | 'className'>

/**
 * A control of the editor's toolbar: a square around its mark, its mark beside its words, or a row of
 * the list the overflow opens. Every square is one width, which is what lets the toolbar count how many
 * of them fit.
 */
export function ToolbarButton({
  mark,
  title,
  isRow = false,
  isPressed,
  children,
  ...buttonProps
}: ToolbarButtonProps) {
  // One button, in whichever of its shapes its place calls for
  return (
    <button
      type="button"
      // The cursor stays where it is as the button is pressed
      onMouseDown={preventFocusLoss}
      // A row already reads as its title
      title={isRow ? undefined : title}
      aria-pressed={isPressed}
      {...buttonProps}
      className={cn(
        'flex shrink-0 items-center transition-colors disabled:cursor-not-allowed disabled:opacity-40',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus',
        isRow
          ? [
              'w-full gap-2 rounded-md px-3 py-1.5 text-left text-sm text-foreground',
              'enabled:hover:bg-foreground/5 data-open:bg-foreground/5',
            ]
          : [
              'h-7 justify-center gap-1.5 rounded text-xs text-muted',
              'enabled:hover:bg-foreground/10 enabled:hover:text-foreground',
              'aria-pressed:bg-brand/10 aria-pressed:text-brand-light',
              'data-open:bg-brand/10 data-open:text-brand-light',
            ],
        !isRow && (children ? 'px-2' : 'w-7')
      )}
    >
      {/* The mark: an icon, or a glyph in the editor's own mono face */}
      <span
        className={cn(
          'flex shrink-0 justify-center font-mono text-sm font-semibold [&_svg]:size-3.5',
          isRow && 'w-5'
        )}
      >
        {mark}
      </span>

      {/* The words */}
      {isRow ? title : children}
    </button>
  )
}
