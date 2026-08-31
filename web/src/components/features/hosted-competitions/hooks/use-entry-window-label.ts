'use client'

import { useFormatter, useTranslations } from 'next-intl'
import { useCallback } from 'react'

import { coversWholeLocalDays } from '@/components/shared/utils/date-utils'

/**
 * The two ends of an entry window, worded.
 */
export type EntryWindowLabel = {
  /** When it starts taking entries. */
  opens: string
  /** When it stops. */
  closes: string
}

/**
 * Wording for the window a group takes entries in, on the clock the reader keeps.
 *
 * A window is authored as whole days, and holds that shape only in the zone it was authored in. Where the
 * reader's own clock agrees it is said as two bare dates; two hours west it opens at eleven the evening
 * before, and there it says the hours as well, those being what a reader would otherwise miss the close
 * by.
 *
 * Each end is said on its own. Handed the pair, the range formatter picks its own field widths per
 * language and per engine, dropping the month name for a number in Czech and doing so in Slovak on
 * Chrome but not on Safari, so one language reads September and the next 9.
 *
 * @returns A function which words a window, and hands back null for a group that never closes.
 */
export function useEntryWindowLabel(): (
  opensAt: string,
  closesAt: string | null
) => EntryWindowLabel | null {
  // Competitions copy
  const t = useTranslations('competitions')

  // Date formatting for the reader's language
  const format = useFormatter()

  // A function which words a window
  return useCallback(
    (opensAt: string, closesAt: string | null) => {
      // A group with no close takes entries forever, and has no window to word
      if (closesAt === null) {
        return null
      }

      // The zone the reader's own clock is on, which is the one a deadline is kept on. Safe to read
      // straight off the runtime: a group is drawn only once its fetch has landed, which never happens
      // on the server, so there is no server render for this to disagree with
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone

      // The two ends, as instants
      const opens = new Date(opensAt)
      const closes = new Date(closesAt)

      // Whether the window says a clock at all
      const saysHours = !coversWholeLocalDays(opens, closes, timeZone)

      /**
       * Says one end of the window.
       *
       * @param instant - The end to say.
       *
       * @returns Its date, carrying the time as well where the hours matter.
       */
      function say(instant: Date): string {
        // The day, in the shortest form that stays unambiguous: a number in Slovak and Czech, an
        // abbreviated name in English, where a number reads as an American month-first date
        const date = format.dateTime(instant, { day: 'numeric', month: 'short', timeZone })

        // The date alone, where the hours do not matter
        if (!saysHours) {
          return date
        }

        // The hour, on a 24-hour clock in every language: 12:00 AM reads as noon to a lot of people
        const time = format.dateTime(instant, {
          hour: 'numeric',
          minute: '2-digit',
          hourCycle: 'h23',
          timeZone,
        })

        // Joined by the mark the language's own date wants between the two
        return t('entryWindowMoment', { date, time })
      }

      // Both ends, said
      return { opens: say(opens), closes: say(closes) }
    },
    [format, t]
  )
}
