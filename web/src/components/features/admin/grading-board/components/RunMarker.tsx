'use client'

import { Clock, PenLine } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import type { ReactNode } from 'react'

import { FOCUS_RING_CLASS } from '@/components/shared/components/Button'
import { Tooltip } from '@/components/shared/components/Tooltip'
import { assertNever } from '@/components/shared/utils/assert-never'
import { cn } from '@/components/shared/utils/css-utils'

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
        <MarkerIcon
          label={t('solving.label')}
          until={t('solving.until', {
            time: format.dateTime(new Date(run.until), { timeStyle: 'short' }),
          })}
          icon={<Clock size={13} strokeWidth={2.25} aria-hidden />}
        />
      )

    // Off the clock, still able to comment
    case 'noteOpen':
      return (
        <MarkerIcon
          label={t('noteOpen.label')}
          until={t('noteOpen.until', {
            time: format.dateTime(new Date(run.until), { timeStyle: 'short' }),
          })}
          icon={<PenLine size={13} strokeWidth={2.25} aria-hidden />}
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

/**
 * Props for the {@link MarkerIcon} component.
 */
type MarkerIconProps = {
  /** The state the icon stands for, read out in its place. */
  label: string
  /** When the state the icon stands for ends, shown on hover and focus and read out after its name. */
  until: string
  /** The icon. */
  icon: ReactNode
}

/**
 * One state's icon, saying when the state ends on hover and focus.
 *
 * The icon sits in a button rather than standing on its own, since an SVG takes no focus, so the time the state ends
 * would otherwise reach a pointer alone.
 */
function MarkerIcon({ label, until, icon }: MarkerIconProps) {
  return (
    <Tooltip placement="top" content={until}>
      <button
        type="button"
        aria-label={label}
        className={cn('inline-flex shrink-0 cursor-help rounded-full text-muted', FOCUS_RING_CLASS)}
      >
        {icon}
      </button>
    </Tooltip>
  )
}
