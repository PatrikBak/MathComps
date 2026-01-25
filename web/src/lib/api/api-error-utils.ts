import type { useTranslations } from 'next-intl'

import { type ApiErrorResponse } from '@/lib/api/api-error-codes'

/**
 * Type-safe translation function for API errors.
 */
export type ApiErrorTranslator = ReturnType<typeof useTranslations<'apiErrors'>>

/**
 * Translates an API error response to a localized message.
 *
 * Uses the error code to look up the translation, and passes any
 * additional data (like `max` for file size) for interpolation.
 *
 * @param t - The translation function from useTranslations('apiErrors')
 * @param error - The structured API error response
 *
 * @returns Translated error message
 */
export function translateApiError(t: ApiErrorTranslator, error: ApiErrorResponse): string {
  // Extract the code and any additional data for interpolation
  const { code, ...rest } = error

  // Cast interpolation data to the format next-intl expects
  const interpolationData = rest as Record<string, string | number | Date>

  // Look up the translation - code is guaranteed to be a valid ApiErrorCode
  return t(code, interpolationData)
}
