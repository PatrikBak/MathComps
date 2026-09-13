import { ChevronRight } from 'lucide-react'
import React from 'react'

import { FOCUS_RING_CLASS } from '@/components/shared/components/Button'
import { cn } from '@/components/shared/utils/css-utils'

/**
 * Color classes for a badge's text, background, and border.
 */
type BadgePaletteEntry = {
  /** Badge text color (e.g., `text-green-200`). */
  text: string
  /** Badge background fill (e.g., `bg-green-500/15`). */
  bg: string
  /** Badge outline border (e.g., `border-green-400/20`). */
  border: string
}

/**
 * The color a row carries, which is what tells one row from another where a stack mixes several kinds of
 * thing. The label takes the text color and the mark is a circle filled from the badge.
 */
export type DisclosureAccent = {
  /** Text color class the label and the chevron take (e.g., `text-yellow-300`). */
  textColorClass: string
  /** The circle's own colors. */
  badge: BadgePaletteEntry
}

/**
 * Props for the {@link DisclosurePanel} component.
 */
export type DisclosurePanelProps = {
  /** Translated label, e.g. "Proof", "Solution", "Hint". */
  label: string
  /** The color the row carries. */
  accent: DisclosureAccent
  /** The mark at the head of the row, saying which of the stack this is. */
  badgeContent: React.ReactNode
  /** Panel body shown when expanded. */
  children: React.ReactNode
}

/**
 * A single disclosure panel: a badged, labelled row that folds its body away.
 */
export function DisclosurePanel({ label, accent, badgeContent, children }: DisclosurePanelProps) {
  return (
    <details className="group">
      <summary
        className={cn(
          'ui-text flex cursor-pointer items-center gap-2 px-4 py-3 leading-6 font-medium',
          'hover:bg-foreground/5 sm:px-5 sm:py-3.5 [&::-webkit-details-marker]:hidden',
          FOCUS_RING_CLASS,
          accent.textColorClass
        )}
      >
        <span
          className={cn(
            'inline-flex h-5 min-w-5 items-center justify-center rounded-full border text-xs font-semibold',
            accent.badge.bg,
            accent.badge.text,
            accent.badge.border
          )}
        >
          {badgeContent}
        </span>
        {label}

        <ChevronRight
          size={16}
          className="ml-auto opacity-70 transition-transform group-open:rotate-90 motion-reduce:transition-none"
        />
      </summary>

      <div className="px-4 pt-3 pb-4 text-foreground/70 sm:px-5 sm:pt-4 sm:pb-5">{children}</div>
    </details>
  )
}
