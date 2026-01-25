/**
 * Structure of error objects returned by Clerk API.
 */
type ClerkErrorPayload = {
  /** Error code identifying the specific type of error */
  code?: string
  /** Human-readable error message */
  message?: string
  /** Array of detailed error objects, each with its own code and message */
  errors?: Array<{ code?: string; message?: string }>
}

/**
 * Known Clerk error codes that we translate.
 */
const CLERK_ERROR_CODES = [
  'form_password_incorrect',
  'form_identifier_not_found',
  'form_password_pwned',
  'form_password_length_too_short',
  'form_identifier_exists',
  'too_many_attempts',
  'form_code_incorrect',
  'form_verification_failed',
  'session_exists',
  'session_already_exists',
  'generic',
] as const

/**
 * Type for Clerk error codes.
 */
type ClerkErrorCode = (typeof CLERK_ERROR_CODES)[number]

/**
 * Checks if a code is a known Clerk error code.
 *
 * @param code - The error code to check
 *
 * @returns True if the code is a known Clerk error code, false otherwise
 */
function isKnownClerkError(code: string): code is ClerkErrorCode {
  return CLERK_ERROR_CODES.includes(code as ClerkErrorCode)
}

/**
 * Extracts the error code and message from a Clerk error object.
 *
 * @param error - The error object to extract details from
 *
 * @returns An object containing the error code and message
 */
const getClerkErrorDetails = (error: unknown) => {
  // Expect a Clerk error payload
  const clerkErrorPayload = error as ClerkErrorPayload

  // Take just the first error
  const firstError = clerkErrorPayload.errors?.[0]

  // Return the error code and message or some defaults
  return {
    code: firstError?.code || clerkErrorPayload.code,
    message: firstError?.message || clerkErrorPayload.message || '',
  }
}

/**
 * Type for a Clerk error translator function.
 * Expects a translation function scoped to 'clerkErrors' namespace.
 */
type ClerkErrorTranslator = (key: ClerkErrorCode) => string

/**
 * Converts Clerk error objects to user-friendly localized messages.
 *
 * @param error - The error object from Clerk
 * @param t - Translation function scoped to 'clerkErrors' namespace
 *
 * @returns A localized error message string
 */
export const getClerkErrorMessage = (error: unknown, t: ClerkErrorTranslator) => {
  // Extract error code and message from Clerk error
  const { code, message } = getClerkErrorDetails(error)

  // Return the appropriate translated error message
  if (code && isKnownClerkError(code)) {
    return t(code)
  }

  // Log the error for debugging purposes with both code and message
  console.error('Unexpected Clerk error:', {
    code: code,
    message: message,
    rawError: error,
  })

  // By default a generic error message is returned
  return t('generic')
}
