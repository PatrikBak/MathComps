'use client'

import { useTranslations } from 'next-intl'
import type { ComponentProps } from 'react'

import { AppLink } from '@/components/shared/components/AppLink'
import { FOCUS_RING_CLASS } from '@/components/shared/components/Button'
import { cn } from '@/components/shared/utils/css-utils'

import { CompetitionClock } from './CompetitionClock'

/**
 * How each press sits: quiet words beside the reading they act on, since none of them is pressed more than
 * once in an entry and the clock is the only part worth a glance while it runs.
 */
const ACTION_CLASS = cn(
  'rounded text-sm text-muted transition-colors hover:text-foreground',
  FOCUS_RING_CLASS
)

/**
 * Props for the {@link CompetitionStandingStrip}.
 */
type CompetitionStandingStripProps = {
  /** When the entry stops counting, as an ISO-8601 string; null on one given up for the problems. */
  endsAt: string | null
  /** The instant the clock is read against, in epoch milliseconds. */
  now: number
  /** Whether the student closed the entry themselves rather than letting the clock close it. */
  wasHandedIn: boolean
  /** Asks whether they mean to hand it in; null once there is nothing left to hand in. */
  onFinish: (() => void) | null
  /** Opens the terms the entry runs on. */
  onOpenRules: () => void
  /** The way back out to the list. */
  listHref: ComponentProps<typeof AppLink>['href']
}

/**
 * Where a student's entry stands and what can be done about it.
 *
 * One row at every width, wrapping when it runs out of room. An arrangement that swaps at a screen size
 * cannot say which one a reader will get: what fits depends on the language and on whether the entry can
 * still be handed in, so the same window shows either. Wrapping asks the words themselves.
 *
 * The clock keeps a surface of its own and the presses do not, which is the standing hierarchy: one thing
 * is read over and over while the entry runs, the others are pressed once and never again.
 */
export function CompetitionStandingStrip({
  endsAt,
  now,
  wasHandedIn,
  onFinish,
  onOpenRules,
  listHref,
}: CompetitionStandingStripProps) {
  // Competitions copy
  const t = useTranslations('competitions')

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
      {/* The reading, which an entry given up for the problems never started */}
      {endsAt !== null && (
        <span className="inline-flex rounded-lg border border-foreground/10 bg-foreground/[0.04]">
          <CompetitionClock endsAt={endsAt} now={now} wasHandedIn={wasHandedIn} />
        </span>
      )}

      {/* Handing the entry in ahead of its clock, offered only while there is one to hand in */}
      {onFinish !== null && (
        <button type="button" className={ACTION_CLASS} onClick={onFinish}>
          {t('finishEntry')}
        </button>
      )}

      {/* The terms it runs on */}
      <button type="button" className={ACTION_CLASS} onClick={onOpenRules}>
        {t('rulesButton')}
      </button>

      {/* And the way back out */}
      <AppLink href={listHref} plain className={ACTION_CLASS}>
        {t('backToCompetitions')}
      </AppLink>
    </div>
  )
}
