'use client'

import { Timer } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { assertNever } from '@/components/shared/utils/assert-never'
import { cn } from '@/components/shared/utils/css-utils'
import { formatClockRemaining } from '@/components/shared/utils/duration-utils'
import { SECOND_MS } from '@/components/shared/utils/time-units'

import type { ClockDisplayMode } from '../model/hosted-competition-state'
import { clockDisplayMode, clockMinutesLeft } from '../model/hosted-competition-state'

/**
 * How each precision colours the reading and its icon.
 */
type ClockModeColors = {
  /** What the reading itself is painted in. */
  reading: string
  /** And the icon beside it. */
  icon: string
}

/**
 * What each precision is painted in: the last minute in the colour a deadline is said in, everything
 * before it in the one an ordinary reading is.
 */
const CLOCK_MODE_COLORS: Record<ClockDisplayMode, ClockModeColors> = {
  minutes: { reading: 'text-foreground', icon: 'text-muted' },
  seconds: { reading: 'text-error', icon: 'text-error' },
}

/**
 * How the reading sits, whatever it currently says. It carries no surface of its own, and it never breaks
 * across lines: a clock split over two of them stops reading as a clock.
 */
const CLOCK_CLASS =
  'inline-flex items-center gap-1.5 whitespace-nowrap px-3 py-2 text-sm font-medium tabular-nums'

/**
 * Props for the {@link CompetitionClock}.
 */
type CompetitionClockProps = {
  /** When the entry's clock runs out, as an ISO-8601 string. */
  endsAt: string
  /** The instant it is read against, in epoch milliseconds. */
  now: number
  /** Whether the student closed the entry themselves rather than letting the clock close it. */
  wasHandedIn: boolean
}

/**
 * How much of an entrant's own clock is left, read to the precision {@link clockDisplayMode} sets.
 */
export function CompetitionClock({ endsAt, now, wasHandedIn }: CompetitionClockProps) {
  // Competitions copy
  const t = useTranslations('competitions')

  // How much of it is left
  const remainingMs = Date.parse(endsAt) - now

  // Over, which is words rather than a reading. The last second goes with it: `now` ticks up to a second
  // behind the end, so a reader would otherwise meet `0:00` for a frame every time an entry ends
  if (remainingMs < SECOND_MS) {
    return (
      <span className={cn(CLOCK_CLASS, 'text-muted')}>
        <Timer size={14} />
        {wasHandedIn ? t('clockFinished') : t('clockSpent')}
      </span>
    )
  }

  // How precisely to say it
  const mode = clockDisplayMode(remainingMs)

  // What that precision is painted in
  const colors = CLOCK_MODE_COLORS[mode]

  // The reading, which turns red for its last minute
  return (
    <span className={cn(CLOCK_CLASS, colors.reading)}>
      <Timer size={14} className={colors.icon} />
      {clockText()}
    </span>
  )

  /**
   * Says how much is left, as precisely as this point in the clock deserves.
   *
   * @returns The words.
   */
  function clockText(): string {
    switch (mode) {
      // Still a way off, so a rounded reading is the honest one
      case 'minutes': {
        // How the remainder breaks down, every part-minute counted as a whole one
        const { hours, minutes } = clockMinutesLeft(remainingMs)

        // Hours only once there are any
        return hours > 0
          ? t('clockLeftHours', { hours, minutes })
          : t('clockLeftMinutes', { minutes })
      }

      // Inside the last minute, where the seconds are the decision
      case 'seconds':
        return formatClockRemaining(remainingMs)

      // Every mode is handled above
      default:
        return assertNever(mode)
    }
  }
}
