import { BACKEND_ERROR_CODES, type BackendErrorCode } from '@/types/backend-error-codes'

/**
 * Error codes emitted by the app's own Next.js API routes (file upload, contact, webhooks). Distinct
 * from the C# backend's {@link BackendErrorCode}s.
 */
const NODE_ERROR_CODES = [
  'INVALID_FILE_TYPE',
  'FILE_TOO_LARGE',
  'UPLOAD_URL_FAILED',
  'VALIDATION_FAILED',
  'SERVER_ERROR',
  'UNAUTHORIZED',
] as const

/** One of the Next.js route error codes. */
export type NodeErrorCode = (typeof NODE_ERROR_CODES)[number]

/**
 * Every machine-readable error code the app can surface, from either the C# backend or a Next.js route.
 * Both wire it as a top-level `errorCode` field, so one client parser and one copy resolver serve both.
 */
export type AppErrorCode = BackendErrorCode | NodeErrorCode

/** Every recognized code. */
const ALL_ERROR_CODES: readonly string[] = [...BACKEND_ERROR_CODES, ...NODE_ERROR_CODES]

/**
 * Narrows a value read off a response body to a code the app recognizes.
 *
 * @param value - The candidate `errorCode`.
 *
 * @returns Whether it is a known {@link AppErrorCode}.
 */
function isAppErrorCode(value: unknown): value is AppErrorCode {
  // Only a string that names one of the known codes counts
  return typeof value === 'string' && ALL_ERROR_CODES.includes(value)
}

/**
 * Reads the machine-readable failure code off an already-parsed response body.
 *
 * @param body - The parsed JSON body of a failed response.
 *
 * @returns The recognized code, or undefined when the body carries none.
 */
function errorCodeFromBody(body: unknown): AppErrorCode | undefined {
  // The code rides as a top-level field on both the C# problem body and our route bodies
  const errorCode = (body as { errorCode?: unknown } | null)?.errorCode

  // Only a code the frontend knows counts; anything else means none
  return isAppErrorCode(errorCode) ? errorCode : undefined
}

/**
 * Best-effort reads the failure code off a non-OK response.
 *
 * @param response - The non-OK fetch response.
 *
 * @returns The recognized code, or undefined when the body carries none or can't be parsed.
 */
export async function readErrorCode(response: Response): Promise<AppErrorCode | undefined> {
  try {
    // Both the C# backend and our routes answer a failure with a JSON body
    const body = await response.json()

    // Pull the code off the parsed body
    return errorCodeFromBody(body)
  } catch {
    // A missing or non-JSON body just means no code
    return undefined
  }
}
