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
