import type { ApiCallError, ApiResult } from '@/types/api'

/**
 * Higher-order function to wrap an API call with additional logic.
 * By default, it just returns the result, but it can be used to add
 * logging, default error handling, or result transformation.
 *
 * @param call - The API call promise
 * @param mapper - Optional function to transform the successful data
 * @param errorMapper - Optional function to transform the error
 *
 * @returns The (possibly transformed) {@link ApiResult<R, RE>}
 */
export async function wrapApi<T, R = T, E = ApiCallError, RE = E>(
  call: Promise<ApiResult<T, E>>,
  mapper?: (data: T) => R,
  errorMapper?: (error: E) => RE
): Promise<ApiResult<R, RE>> {
  try {
    // Perform call
    const result = await call

    // If call failed, return mapped error
    if (!result.success) {
      return {
        success: false,
        error: errorMapper ? errorMapper(result.error) : (result.error as unknown as RE),
      }
    }

    // If call succeeded, return transformed result
    return {
      success: true,
      data: mapper ? mapper(result.data) : (result.data as unknown as R),
    }
  } catch (error) {
    // If call threw, return unknown error
    return {
      success: false,
      error: {
        type: 'unknown',
        message: error instanceof Error ? error.message : 'An unexpected error occurred',
      } as unknown as RE,
    }
  }
}
