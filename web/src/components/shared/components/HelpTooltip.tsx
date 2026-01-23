'use client'

import { HelpCircle } from 'lucide-react'
import React from 'react'

import { Tooltip } from '@/components/shared/components/Tooltip'

/**
 * Props for the {@link HelpTooltip} component.
 */
type HelpTooltipProps = {
  /** The content to display in the tooltip */
  content: React.ReactNode
}

/**
 * A small client component wrapper for {@link Tooltip} with '?' icon.
 */
export function HelpTooltip({ content }: HelpTooltipProps) {
  return (
    <Tooltip placement="top" content={content}>
      <HelpCircle className="inline h-3.5 w-3.5 text-slate-400/80 cursor-help" />
    </Tooltip>
  )
}
