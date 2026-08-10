'use client'

import { HelpCircle } from 'lucide-react'
import { useTranslations } from 'next-intl'
import React from 'react'

import { FOCUS_RING_CLASS } from '@/components/shared/components/Button'
import { Tooltip } from '@/components/shared/components/Tooltip'
import { cn } from '@/components/shared/utils/css-utils'

/**
 * Props for the {@link HelpTooltip} component.
 */
type HelpTooltipProps = {
  /** The content to display in the tooltip */
  content: React.ReactNode
  /**
   * What the help is about, which its accessible name is built around.
   *
   * A page carrying several of these would otherwise offer a row of identical "more information"
   * controls, none of which says what it would explain until it is opened.
   */
  label: string
}

/**
 * A small client component wrapper for {@link Tooltip} with '?' icon.
 *
 * The icon sits in a button rather than standing on its own, since an SVG takes no focus and what
 * it has to say would otherwise be reachable by pointer alone.
 */
export function HelpTooltip({ content, label }: HelpTooltipProps) {
  // Translations for the shared action labels
  const tActions = useTranslations('ui.actions')

  return (
    <Tooltip placement="top" content={content}>
      <button
        type="button"
        aria-label={tActions('moreInformationAbout', { subject: label })}
        className={cn('inline-flex cursor-help rounded-full align-middle', FOCUS_RING_CLASS)}
      >
        <HelpCircle className="h-3.5 w-3.5 text-muted/80" aria-hidden="true" />
      </button>
    </Tooltip>
  )
}
