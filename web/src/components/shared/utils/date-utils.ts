import type { Locale } from '@/i18n/i18n'

import { HOUR_MINUTES } from './time-units'

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

/**
 * An ISO-8601 instant on a clock running 00 to 23, with an explicit `Z` or `±HH:MM` offset, capturing the day it
 * names and the offset's hours and minutes.
 */
const INSTANT_WITH_OFFSET_PATTERN =
  /^(\d{4}-\d{2}-\d{2})T(?:[01]\d|2[0-3]):\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-](\d{2}):(\d{2}))$/

/** The widest offset any zone carries from UTC, in minutes. */
const MAX_UTC_OFFSET_MINUTES = 14 * HOUR_MINUTES

/** The first year an instant may fall in once read in UTC: year 1 of the Common Era. */
const FIRST_INSTANT_YEAR = 1

/** The last year an instant may fall in once read in UTC: the last one four digits spell. */
const LAST_INSTANT_YEAR = 9999

/**
 * Whether a string names a real calendar day as `YYYY-MM-DD`. Feb 30th has the shape of a day but rolls over to
 * March when parsed, so only a day that reads back as itself counts.
 *
 * @param value - The string to test.
 *
 * @returns Whether it is a real day.
 */
export function isCalendarDate(value: string): boolean {
  // The shape comes first, since a parse alone accepts far more
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false

  // That day at midnight in UTC
  const day = new Date(`${value}T00:00:00Z`)

  // A real day reads back as itself
  return !Number.isNaN(day.getTime()) && day.toISOString().startsWith(value)
}

/**
 * Whether a string is an ISO-8601 instant carrying an explicit offset, so it means the same moment wherever it is
 * read. It has to name a real day and a real time of it, carry an offset no wider than any zone's, and fall
 * between years 1 and 9999 once read in UTC.
 *
 * @param value - The string to test.
 *
 * @returns Whether it is such an instant.
 */
export function isInstantWithOffset(value: string): boolean {
  // The shape, with the day it names and its offset pulled out
  const match = INSTANT_WITH_OFFSET_PATTERN.exec(value)

  // Anything not shaped like an instant is refused
  if (match === null) return false

  // The instant itself, which rejects a minute or a second past 59
  const instant = new Date(value)

  // The year it falls in on the UTC clock
  const utcYear = instant.getUTCFullYear()

  // The day it names, and the offset's hours and minutes, both zero under `Z`
  const [, day, offsetHours = '00', offsetMinutes = '00'] = match

  // The offset in minutes
  const offset = Number(offsetHours) * HOUR_MINUTES + Number(offsetMinutes)

  // A parsable instant on a real day, with an offset no wider than any zone's, in a year an instant may fall in
  return (
    !Number.isNaN(instant.getTime()) &&
    isCalendarDate(day) &&
    offset <= MAX_UTC_OFFSET_MINUTES &&
    utcYear >= FIRST_INSTANT_YEAR &&
    utcYear <= LAST_INSTANT_YEAR
  )
}
