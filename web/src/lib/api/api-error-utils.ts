import type { useTranslations } from 'next-intl'

import { type AppErrorCode } from '@/lib/api/api-error-codes'

/**
 * The translator bound to the central `apiErrors` namespace, which holds copy for every
 * {@link AppErrorCode}.
 */
export type ApiErrorTranslator = ReturnType<typeof useTranslations<'apiErrors'>>

/**
 * Options for {@link resolveErrorMessage}.
 */
type ResolveErrorMessageOptions = {
  /** Message to show when the failure carried no code; defaults to the generic server-error copy. */
  fallback?: string
  /** Interpolation values for a code whose copy has placeholders (e.g. `FILE_TOO_LARGE`'s max). */
  data?: Record<string, string | number>
}

/**
 * Resolves the localized message for a failure code from the central `apiErrors` namespace: the code's
 * copy when present, else the caller's fallback (or the generic server-error copy).
 *
 * @param errorCode - The failure code, or undefined when the failure carried none.
 * @param translate - The translator bound to the `apiErrors` namespace.
 * @param options - Fallback copy and interpolation values.
 *
 * @returns The localized message to show the user.
 */
export function resolveErrorMessage(
  errorCode: AppErrorCode | undefined,
  translate: ApiErrorTranslator,
  options?: ResolveErrorMessageOptions
): string {
  // A known code resolves to its central copy, with any interpolation values
  if (errorCode) {
    return translate(errorCode, options?.data)
  }

  // No code: the caller's fallback, or the generic server-error copy
  return options?.fallback ?? translate('SERVER_ERROR')
}
