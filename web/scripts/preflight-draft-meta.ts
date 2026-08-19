/**
 * Meta narrowing for the draft preflight: turns the parsed `_meta.yaml` document
 * into a typed {@link ManifestMeta}, collecting one error per missing or
 * malformed field. Pure — no filesystem access.
 */

import type { Locale } from '../src/i18n/i18n'
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '../src/i18n/i18n'
import { isRecord } from './preflight-draft-parse'
import type { ManifestMeta, Season, VerdictError } from './preflight-draft-types'

/** Filename of the folder-level taxonomy file. */
export const META_FILENAME = '_meta.yaml'

/** The key `_meta.yaml` names the competition by. */
const COMPETITION_FIELD = 'competition'

/** The only shape a competition is addressed in: lowercase alphanumeric segments joined by hyphens. */
const COMPETITION_PATH_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/

/** Meta values substituted for any field that can't be read. */
export const FALLBACK_META: ManifestMeta = {
  competitionPath: '',
  season: { year: 0 },
  date: '',
  visibleSince: null,
  language: DEFAULT_LOCALE,
}

/** Best-effort meta paired with every issue found while reading or narrowing it. */
export type MetaResult = {
  /** The taxonomy, with fallbacks substituted for any field that errored. */
  meta: ManifestMeta
  /** Each missing or malformed field, as a `_meta.yaml` error. */
  errors: VerdictError[]
}

/**
 * Builds a file-level `_meta.yaml` error.
 *
 * @param message - The human-readable description.
 *
 * @returns The assembled {@link VerdictError}.
 */
export function metaIssue(message: string): VerdictError {
  // Every meta problem is a file-level error on _meta.yaml
  return {
    file: META_FILENAME,
    half: null,
    line: null,
    col: null,
    rule: 'meta',
    message,
    severity: 'error',
  }
}

/**
 * Narrows the parsed `_meta.yaml` document into a typed {@link ManifestMeta},
 * collecting an error for every missing or malformed field rather than throwing.
 *
 * @param parsed - The value `YAML.parse` produced for `_meta.yaml`.
 *
 * @returns The best-effort meta and every issue found while narrowing it.
 */
export function narrowMeta(parsed: unknown): MetaResult {
  // A non-mapping document carries none of the fields we need
  if (!isRecord(parsed)) {
    return {
      meta: FALLBACK_META,
      errors: [metaIssue('_meta.yaml must contain a mapping of fields')],
    }
  }

  // Narrow each field independently so every problem is reported at once
  const errors: VerdictError[] = []
  const competitionPath = requireCompetitionPath(parsed[COMPETITION_FIELD], errors)
  const season = narrowSeason(parsed.season, errors)
  const date = narrowDate(parsed.date, errors)
  const visibleSince = narrowVisibleSince(parsed.visibleSince, errors)
  const language = narrowLanguage(parsed.language, errors)

  // Assemble the best-effort meta alongside the collected issues
  return { meta: { competitionPath, season, date, visibleSince, language }, errors }
}

/**
 * Reads the required competition path, recording an error and returning `''` when it is missing or not a
 * well-formed path. The shape check is what keeps a malformed segment out of the C# half, which walks
 * the path segment by segment and refuses anything outside the slug alphabet.
 *
 * @param value - The raw `competition` value from the parsed document.
 * @param errors - Accumulator the issue is pushed onto.
 *
 * @returns The competition path, or `''` when missing or malformed.
 */
function requireCompetitionPath(value: unknown, errors: VerdictError[]): string {
  // A string whose every segment is drawn from the slug alphabet addresses a competition
  if (typeof value === 'string' && COMPETITION_PATH_PATTERN.test(value)) return value

  // Anything else is missing or malformed
  errors.push(
    metaIssue(
      `${COMPETITION_FIELD} is required and must be a path of lowercase alphanumeric segments joined by "-" (e.g. csmo-a-iii)`
    )
  )
  return ''
}

/**
 * Narrows the `season` mapping, recording an error when its year is missing.
 *
 * @param value - The raw `season` value from the parsed document.
 * @param errors - Accumulator the issue is pushed onto.
 *
 * @returns The season, with `0` substituted for a missing year.
 */
function narrowSeason(value: unknown, errors: VerdictError[]): Season {
  // The season must itself be a mapping carrying a year
  if (!isRecord(value)) {
    errors.push(metaIssue('season is required and must have a numeric "year"'))
    return { year: 0 }
  }

  // Narrow the season's year
  return {
    year: requireNumber(value.year, 'season.year', errors),
  }
}

/**
 * Reads the required `date` field, recording an error and returning `''` when it
 * is missing or not a real `YYYY-MM-DD` calendar date.
 *
 * @param value - The raw `date` value from the parsed document.
 * @param errors - Accumulator the issue is pushed onto.
 *
 * @returns The date string, or `''` when missing or malformed.
 */
function narrowDate(value: unknown, errors: VerdictError[]): string {
  // A `YYYY-MM-DD` string that round-trips to the same calendar date is valid
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    // Parse as UTC midnight
    const parsed = new Date(`${value}T00:00:00Z`)

    // Accept only when it round-trips — rejects rolled-over dates like 2026-13-01
    if (!Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value)) return value
  }

  // Missing, wrong shape, or not a real date
  errors.push(metaIssue('date is required and must be a valid YYYY-MM-DD date'))
  return ''
}

/**
 * Reads the optional `visibleSince` field, recording an error and returning `null` when it is present but not an
 * ISO-8601 instant carrying an explicit offset. An offset is demanded rather than assumed because the value
 * embargoes a round: a bare wall-clock time would open it at whatever the importing machine happens to think the
 * zone is, which is the one thing an embargo must not depend on.
 *
 * @param value - The raw `visibleSince` value from the parsed document.
 * @param errors - Accumulator the issue is pushed onto.
 *
 * @returns The timestamp string, or `null` when absent or malformed.
 */
function narrowVisibleSince(value: unknown, errors: VerdictError[]): string | null {
  // Absent is the ordinary case: the round is open from the moment it lands
  if (value === undefined || value === null) return null

  // An instant with an explicit `Z` or `±HH:MM` offset, down to optional fractional seconds
  const shape = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/

  // A well-shaped string is the only thing worth reading a real instant out of
  if (typeof value === 'string' && shape.test(value)) {
    // The instant itself, which rejects an impossible hour or month
    const instant = new Date(value)

    // The calendar day it names, parsed on its own: a real day round-trips, while Feb 30th silently rolls over
    const [calendarDay] = value.split('T')
    const day = new Date(`${calendarDay}T00:00:00Z`)

    // Both have to hold: a parsable instant naming a day that exists
    if (!Number.isNaN(instant.getTime()) && day.toISOString().startsWith(calendarDay)) return value
  }

  // Present but unusable
  errors.push(
    metaIssue(
      'visibleSince must be an ISO-8601 instant with an explicit offset (e.g. 2026-09-14T18:00:00Z), or be omitted'
    )
  )
  return null
}

/**
 * Reads a required numeric field, recording an error and returning `0` when invalid.
 *
 * @param value - The raw field value from the parsed document.
 * @param field - The field name, used in the error message.
 * @param errors - Accumulator the issue is pushed onto.
 *
 * @returns The number, or `0` when missing or malformed.
 */
function requireNumber(value: unknown, field: string, errors: VerdictError[]): number {
  // A finite number is valid
  if (typeof value === 'number' && Number.isFinite(value)) return value

  // Anything else is missing or malformed
  errors.push(metaIssue(`${field} is required and must be a number`))
  return 0
}

/**
 * Narrows the `language` field to a supported {@link Locale}, defaulting on failure.
 *
 * @param value - The raw `language` value from the parsed document.
 * @param errors - Accumulator the issue is pushed onto.
 *
 * @returns A supported {@link Locale}, or the default when missing or unsupported.
 */
function narrowLanguage(value: unknown, errors: VerdictError[]): Locale {
  // The language must be one of the supported locale slugs
  if (typeof value === 'string' && SUPPORTED_LOCALES.some((locale) => locale === value)) {
    return value as Locale
  }

  // Unsupported or missing — record it and fall back to the default
  errors.push(
    metaIssue(
      `language must be one of ${SUPPORTED_LOCALES.join(', ')} (got ${JSON.stringify(value)})`
    )
  )
  return DEFAULT_LOCALE
}
