import type { Locale } from '@/i18n/i18n'
import { type LocalizedString, type PartialLocalizedString, SUPPORTED_LOCALES } from '@/i18n/i18n'

/**
 * Validates that a {@link LocalizedString} has non-empty values for all supported locales.
 *
 * @param value - The {@link LocalizedString} to validate.
 * @param fieldName - The name of the field being validated (for error messages).
 * @param context - Description of the containing item (for error messages).
 *
 * @yields Error messages for any validation failures.
 */
export function* validateLocalizedString(
  value: LocalizedString | undefined,
  fieldName: string,
  context: string
): Generator<string> {
  // Bail when the whole value is missing
  if (!value) {
    yield `❌ Missing ${fieldName} for ${context}`
    // Nothing more to check once it is missing
    return
  }

  // Ensure non-empty value for each locale
  for (const locale of SUPPORTED_LOCALES) {
    if (!value[locale] || value[locale].trim() === '') {
      yield `❌ Missing ${locale} value for ${fieldName} in ${context}`
    }
  }
}

/**
 * Validates that a {@link PartialLocalizedString} has non-empty values for the specified locales.
 *
 * @param value - The {@link PartialLocalizedString} to validate.
 * @param fieldName - The name of the field being validated (for error messages).
 * @param context - Description of the containing item (for error messages).
 * @param locales - The locales that must have values.
 *
 * @yields Error messages for any validation failures.
 */
export function* validatePartialLocalizedString(
  value: PartialLocalizedString | undefined,
  fieldName: string,
  context: string,
  locales: readonly Locale[]
): Generator<string> {
  // Bail when the whole value is missing
  if (!value) {
    yield `❌ Missing ${fieldName} for ${context}`
    // Nothing more to check once it is missing
    return
  }

  // Ensure non-empty value for each required locale
  for (const locale of locales) {
    if (!value[locale] || value[locale]!.trim() === '') {
      yield `❌ Missing ${locale} value for ${fieldName} in ${context}`
    }
  }
}

/**
 * Validates that a date string matches the expected YYYY-MM-DD format.
 *
 * @param date - The date string to validate.
 * @param context - Description of the containing item (for error messages).
 *
 * @yields Error messages for any validation failures.
 */
export function* validateDateFormat(date: string | undefined, context: string): Generator<string> {
  // Ensure non-empty and non-whitespace value
  if (!date || date.trim() === '') {
    yield `❌ Missing date for ${context}`
    // No date means nothing else to validate
    return
  }

  // Ensure YYYY-MM-DD format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    yield `❌ Invalid date format "${date}" in ${context} (expected YYYY-MM-DD)`
  }
}

/**
 * Validates that a required string field is present and non-empty.
 *
 * @param value - The string value to validate.
 * @param fieldName - The name of the field being validated (for error messages).
 * @param context - Description of the containing item (for error messages).
 *
 * @yields Error messages for any validation failures.
 */
export function* validateRequiredField(
  value: string | undefined,
  fieldName: string,
  context: string
): Generator<string> {
  // Ensure the value is there and not a whitespace string
  if (!value || value.trim() === '') {
    yield `❌ Missing ${fieldName} for ${context}`
  }
}

/**
 * Validates that a required array field is present and non-empty.
 *
 * @param value - The array value to validate.
 * @param fieldName - The name of the field being validated (for error messages).
 * @param context - Description of the containing item (for error messages).
 *
 * @yields Error messages for any validation failures.
 */
export function* validateRequiredArray(
  value: unknown[] | undefined,
  fieldName: string,
  context: string
): Generator<string> {
  // Ensure the array is there and has at least one item
  if (!value || value.length === 0) {
    yield `❌ Missing ${fieldName} for ${context}`
  }
}

/**
 * Validates an optional link target: an absolute `http(s)` URL or an internal route path (leading
 * `/`). An absent link passes — use {@link validateRequiredField} alongside when a link is mandatory.
 *
 * @param link - The link target to validate.
 * @param fieldName - The name of the field being validated (for error messages).
 * @param context - Description of the containing item (for error messages).
 *
 * @yields An error when a present link is neither a URL nor an internal route path.
 */
export function* validateOptionalLink(
  link: string | undefined,
  fieldName: string,
  context: string
): Generator<string> {
  // Absent is fine; when present it must be a URL or an internal route path
  if (link && !link.startsWith('http') && !link.startsWith('/')) {
    yield `❌ Invalid ${fieldName} "${link}" for ${context}`
  }
}

/**
 * Validates that a value belongs to a closed set of allowed values — the runtime guard for a
 * closed-union field the untyped JSON can't vouch for.
 *
 * @param value - The value to check.
 * @param allowed - The closed set of permitted values.
 * @param fieldName - The name of the field being validated (for error messages).
 * @param context - Description of the containing item (for error messages).
 *
 * @yields An error when the value falls outside the allowed set.
 */
export function* validateMembership(
  value: string,
  allowed: readonly string[],
  fieldName: string,
  context: string
): Generator<string> {
  // Flag a value outside the closed set, naming what was allowed
  if (!allowed.includes(value)) {
    yield `❌ Unknown ${fieldName} "${value}" for ${context} (expected one of: ${allowed.join(', ')})`
  }
}

/**
 * Checks for duplicate values in collections.
 *
 * @param values - Array of values to check.
 * @param getValue - Function to extract the value to check for duplicates.
 * @param getName - Function to extract a display name for error messages.
 * @param fieldName - The name of the field being validated (for error messages).
 *
 * @yields Error messages for any duplicates found.
 */
export function* validateUniqueness<T>(
  values: T[],
  getValue: (item: T) => string | undefined,
  getName: (item: T) => string,
  fieldName: string
): Generator<string> {
  // Track seen values so we can detect duplicates
  const seen = new Set<string>()

  // Check each value for duplicates
  for (const item of values) {
    // Pull the value to compare
    const value = getValue(item)

    // Skip if the value is empty
    if (value) {
      // If we've seen this value before, yield an error
      if (seen.has(value)) {
        yield `❌ Duplicate ${fieldName} "${value}" for ${getName(item)}`
      } else {
        // Otherwise, add it to the set of seen values
        seen.add(value)
      }
    }
  }
}
