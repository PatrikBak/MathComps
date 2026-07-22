import type { BackendErrorCode } from '@/types/backend-error-codes'

/**
 * Resolves the message to show for a backend failure: the code's bespoke copy, or the generic fallback
 * when the code is absent or unmapped.
 *
 * @param errorCode - The backend's failure code, or undefined when the response carried none.
 * @param keys - The feature's map from a failure code to its message key.
 * @param fallback - The message key to use when no bespoke copy applies.
 * @param translate - The feature's namespaced translator for the keys above.
 *
 * @returns The message to show.
 */
export function backendErrorMessage<Key extends string>(
  errorCode: BackendErrorCode | undefined,
  keys: Partial<Record<BackendErrorCode, Key>>,
  fallback: Key,
  translate: (key: Key) => string
): string {
  // The code's bespoke key, or none when the code is absent or unmapped
  const key = errorCode ? keys[errorCode] : undefined

  // Its message, or the generic fallback's
  return translate(key ?? fallback)
}
