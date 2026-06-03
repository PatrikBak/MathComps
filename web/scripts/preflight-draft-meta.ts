/**
 * Meta narrowing for the draft preflight: turns the parsed `_meta.yaml` document
 * into a typed {@link ManifestMeta}, collecting one error per missing or
 * malformed field. Pure (no filesystem), so it is unit-tested directly.
 */

import type { Locale } from '../src/i18n/i18n'
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '../src/i18n/i18n'
import { isRecord } from './preflight-draft-parse'
import type { ManifestMeta, Season, VerdictError } from './preflight-draft-types'

/** Filename of the folder-level taxonomy file, parsed once per draft. */
export const META_FILENAME = '_meta.yaml'

/** Meta values to fall back on so the manifest shape stays stable when `_meta.yaml` is unusable. */
export const FALLBACK_META: ManifestMeta = {
  competition: '',
  category: null,
  round: '',
  season: { year: 0, edition: 0 },
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
  const round = requireSlug(parsed.round, 'round', errors)
  const category = optionalSlug(parsed.category, 'category', errors)
  const season = narrowSeason(parsed.season, errors)
  const language = narrowLanguage(parsed.language, errors)

  // Assemble the best-effort meta alongside the collected issues
  return { meta: { competition, category, round, season, language }, errors }
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
 * Narrows the `season` mapping, recording an error for each missing number.
 *
 * @param value - The raw `season` value from the parsed document.
 * @param errors - Accumulator the issues are pushed onto.
 *
 * @returns The season, with `0` substituted for any missing number.
 */
function narrowSeason(value: unknown, errors: VerdictError[]): Season {
  // The season must itself be a mapping of two numbers
  if (!isRecord(value)) {
    errors.push(metaIssue('season is required and must have numeric "year" and "edition"'))
    return { year: 0, edition: 0 }
  }

  // Narrow each number independently so both can be reported
  return {
    year: requireNumber(value.year, 'season.year', errors),
    edition: requireNumber(value.edition, 'season.edition', errors),
  }
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
