'use client'

import { HelpCircle } from 'lucide-react'
import { useTranslations } from 'next-intl'
import React from 'react'

import { TooltipIcon } from '@/components/shared/components/TooltipIcon'

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
 * A small client component wrapper for {@link TooltipIcon} with '?' icon.
 */
export function HelpTooltip({ content, label }: HelpTooltipProps) {
  // Translations for the shared action labels
  const tActions = useTranslations('ui.actions')

  return (
    <TooltipIcon
      icon={<HelpCircle className="h-3.5 w-3.5 text-muted/80" aria-hidden="true" />}
      label={tActions('moreInformationAbout', { subject: label })}
      content={content}
      className="align-middle"
    />
  )
}
