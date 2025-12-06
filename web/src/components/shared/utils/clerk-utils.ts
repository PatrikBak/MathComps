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
 * Converts Clerk error objects to user-friendly Slovak messages.
 *
 * @param error - The error object from Clerk
 *
 * @returns A localized error message string
 */
export const getClerkErrorMessage = (error: unknown) => {
  // A map of Clerk error codes to user-friendly messages
  const errorMessages: Record<string, string> = {
    form_password_incorrect: 'Nesprávny email alebo heslo',
    form_identifier_not_found: 'Nesprávny email alebo heslo',
    form_password_pwned: 'Toto heslo bolo nájdené v databáze úniku dát. Použite iné heslo.',
    form_password_length_too_short: 'Heslo musí mať aspoň 8 znakov',
    form_identifier_exists: 'Účet s týmto emailom už existuje',
    too_many_attempts: 'Príliš mnoho pokusov. Skúste to prosím neskôr.',
    form_code_incorrect: 'Nesprávny kód.',
    form_verification_failed: 'Overenie kódu zlyhalo. Skúste to prosím znova.',
    session_exists: 'Už ste prihlásený. Obnovte stránku.',
    session_already_exists: 'Už ste prihlásený. Obnovte stránku.',
  }

  // Extract error code and message from Clerk error
  const { code, message } = getClerkErrorDetails(error)

  // Return the appropriate error message
  if (code && errorMessages[code]) {
    return errorMessages[code]
  }

  // Log the error for debugging purposes with both code and message
  console.error('Unexpected Clerk error:', {
    code: code,
    message: message,
    rawError: error,
  })

  // By default a generic error message is returned
  return 'Vyskytla sa chyba. Skúste to prosím znova.'
}
