'use client'

import type { ReactNode } from 'react'

import { FOCUS_RING_CLASS } from '@/components/shared/components/Button'
import { Tooltip } from '@/components/shared/components/Tooltip'
import { cn } from '@/components/shared/utils/css-utils'

/**
 * Props for the {@link TooltipIcon} component.
 */
type TooltipIconProps = {
  /** The icon. */
  icon: ReactNode
  /** What the icon stands for, read out in its place. */
  label: string
  /** What the tooltip says on hover and focus, read out after the icon's name. */
  content: ReactNode
  /** Classes placing and coloring the icon's button among what stands around it. */
  className: string
}

/**
 * An icon saying more in a tooltip on hover and focus.
 *
 * The icon sits in a button rather than standing on its own, since an SVG takes no focus, so what the tooltip says
 * would otherwise reach a pointer alone.
 */
export function TooltipIcon({ icon, label, content, className }: TooltipIconProps) {
  return (
    <Tooltip placement="top" content={content}>
      <button
        type="button"
        aria-label={label}
        className={cn('inline-flex cursor-help rounded-full', FOCUS_RING_CLASS, className)}
      >
        {icon}
      </button>
    </Tooltip>
  )
}
