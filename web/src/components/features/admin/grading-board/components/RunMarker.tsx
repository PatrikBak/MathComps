'use client'

import { Clock, PenLine } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'

import { TooltipIcon } from '@/components/shared/components/TooltipIcon'
import { assertNever } from '@/components/shared/utils/assert-never'

import type { EntrantRun } from '../model/entrant-run'

/**
 * Props for the {@link RunMarker} component.
 */
type RunMarkerProps = {
  /** Where the entrant stands on their own run. */
  run: EntrantRun
}

/**
 * An entrant's run as an icon, while they may still write: a clock while they are solving, a pen while they may
 * still comment on their own solutions. Hovering or focusing it says when that ends. Nothing once they are done.
 */
export function RunMarker({ run }: RunMarkerProps) {
  // Grading copy
  const t = useTranslations('admin.grading.run')

  // Dates and times in the reader's language
  const format = useFormatter()

  // Which state the entrant is in
  switch (run.kind) {
    // Still on the clock
    case 'solving':
      return (
        <TooltipIcon
          icon={<Clock size={13} strokeWidth={2.25} aria-hidden />}
          label={t('solving.label')}
          content={t('solving.until', {
            time: format.dateTime(new Date(run.until), { timeStyle: 'short' }),
          })}
          className="shrink-0 text-muted"
        />
      )

    // Off the clock, still able to comment
    case 'noteOpen':
      return (
        <TooltipIcon
          icon={<PenLine size={13} strokeWidth={2.25} aria-hidden />}
          label={t('noteOpen.label')}
          content={t('noteOpen.until', {
            time: format.dateTime(new Date(run.until), { timeStyle: 'short' }),
          })}
          className="shrink-0 text-muted"
        />
      )

    // Nothing more to come
    case 'done':
      return null

    // Every state is handled above
    default:
      return assertNever(run)
  }
}
