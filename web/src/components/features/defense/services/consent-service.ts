import type { ApiCaller } from '@/hooks/use-api'
import type { ApiResult } from '@/types/api'

import type { MathildaConsent } from '../model/defense-types'
import { getMathildaConsentUrl } from './consent-api-urls'

/**
 * Reads where the student stands on acknowledging what talking to Mathilda entails.
 *
 * @param apiCall - The authenticated API caller.
 * @returns When they acknowledged it, or null while they have yet to.
 */
export function getMathildaConsent(apiCall: ApiCaller): Promise<ApiResult<MathildaConsent>> {
  return apiCall<MathildaConsent>(() => getMathildaConsentUrl())
}

/**
 * Records that the student has been told what talking to Mathilda entails.
 *
 * @param apiCall - The authenticated API caller.
 * @returns The empty result of the write.
 */
export function recordMathildaConsent(apiCall: ApiCaller): Promise<ApiResult<void>> {
  return apiCall<void>(() => getMathildaConsentUrl(), { method: 'POST' })
}
