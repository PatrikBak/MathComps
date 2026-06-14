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

/** Meta values substituted for any field that can't be read. */
export const FALLBACK_META: ManifestMeta = {
  competition: '',
  category: null,
  round: null,
  season: { year: 0 },
  date: '',
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
  const competition = requireSlug(parsed.competition, 'competition', errors)
  const round = optionalSlug(parsed.round, 'round', errors)
  const category = optionalSlug(parsed.category, 'category', errors)
  const season = narrowSeason(parsed.season, errors)
  const date = narrowDate(parsed.date, errors)
  const language = narrowLanguage(parsed.language, errors)

  // Assemble the best-effort meta alongside the collected issues
  return { meta: { competition, category, round, season, date, language }, errors }
}

/**
 * Reads a required slug field, recording an error and returning `''` when it is
 * missing or not a non-empty string.
 *
 * @param value - The raw field value from the parsed document.
 * @param field - The field name, used in the error message.
 * @param errors - Accumulator the issue is pushed onto.
 *
 * @returns The slug, or `''` when missing or malformed.
 */
function requireSlug(value: unknown, field: string, errors: VerdictError[]): string {
  // A non-empty string is a usable slug
  if (typeof value === 'string' && value.trim() !== '') return value

  // Anything else is missing or malformed
  errors.push(metaIssue(`${field} is required and must be a non-empty string`))
  return ''
}

/**
 * Reads an optional slug field, returning `null` when absent and recording an
 * error when present but not a non-empty string.
 *
 * @param value - The raw field value from the parsed document.
 * @param field - The field name, used in the error message.
 * @param errors - Accumulator the issue is pushed onto.
 *
 * @returns The slug, or `null` when absent or malformed.
 */
function optionalSlug(value: unknown, field: string, errors: VerdictError[]): string | null {
  // An absent optional slug is simply null
  if (value === undefined || value === null) return null

  // When present it must still be a non-empty string
  if (typeof value === 'string' && value.trim() !== '') return value

  // Present but malformed
  errors.push(metaIssue(`${field} must be a non-empty string when present`))
  return null
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
