import type { Locale } from '@/i18n/i18n'

/** The twelve names a year is made of, January first. */
type MonthNames = readonly [
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
]

/**
 * Month names, per language, January first.
 *
 * Written out here rather than read off `Intl`, a heading wanting the capitalized nominative that `Intl`
 * does not hand back for Slovak or Czech. Kept out of the message files because a name is minted in every
 * language at once, and those ship one locale at a time.
 */
const MONTH_NAMES: Record<Locale, MonthNames> = {
  sk: [
    'Január',
    'Február',
    'Marec',
    'Apríl',
    'Máj',
    'Jún',
    'Júl',
    'August',
    'September',
    'Október',
    'November',
    'December',
  ],
  cs: [
    'Leden',
    'Únor',
    'Březen',
    'Duben',
    'Květen',
    'Červen',
    'Červenec',
    'Srpen',
    'Září',
    'Říjen',
    'Listopad',
    'Prosinec',
  ],
  en: [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ],
}

/**
 * Writes the month an instant falls in, with its year.
 *
 * Read in UTC, so the month is the one the instant was minted in rather than the one the reader's own
 * offset drags it into.
 *
 * @param instant - The instant, as an ISO timestamp.
 * @param locale - The language to name the month in.
 *
 * @returns The month and year, as a heading reads them.
 */
export function formatMonthAndYear(instant: string, locale: Locale): string {
  // The instant, as a date to read the fields off
  const date = new Date(instant)

  // The month it belongs to, and the year
  return `${MONTH_NAMES[locale][date.getUTCMonth()]} ${date.getUTCFullYear()}`
}

/**
 * The clock an instant shows in one zone, to the minute.
 *
 * @param instant - The instant to read.
 * @param timeZone - The zone to read it in.
 *
 * @returns The hour and minute the zone's clock is on.
 */
function readClock(instant: Date, timeZone: string): { hour: number; minute: number } {
  // The two fields, as the zone's own clock words them
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(instant)

  /**
   * Picks one field out of the formatted parts.
   *
   * @param type - Which field to take.
   *
   * @returns Its value as a number.
   */
  const field = (type: 'hour' | 'minute') =>
    Number(parts.find((part) => part.type === type)?.value ?? '0')

  // The clock those two fields make
  return { hour: field('hour'), minute: field('minute') }
}

/**
 * Whether a span runs from one midnight to the last minute before another, on the clock of one zone.
 *
 * A span authored as whole days holds that shape only in the zone it was authored in. Two hours west
 * the same span starts at eleven the evening before.
 *
 * @param start - When the span opens.
 * @param end - When it closes, being the last instant inside it rather than the first outside.
 * @param timeZone - The zone whose clock decides.
 *
 * @returns Whether the span covers whole days there.
 */
export function coversWholeLocalDays(start: Date, end: Date, timeZone: string): boolean {
  // Where the two ends sit on that clock
  const opens = readClock(start, timeZone)
  const closes = readClock(end, timeZone)

  // Open on the stroke of midnight, and closed on the last minute the day has
  return opens.hour === 0 && opens.minute === 0 && closes.hour === 23 && closes.minute === 59
}
