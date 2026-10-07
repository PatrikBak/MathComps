import type { ApiCaller } from '@/hooks/use-api'
import type { ApiResult } from '@/types/api'

import type { SelectionData } from '../model/selection-types'
import { getSelectionUrl } from './selection-api-urls'

/**
 * The backend behind the problem selection: authenticated calls to the .NET API.
 */

/**
 * Reads the whole selection in one go.
 *
 * @param apiCall - The authenticated API caller.
 *
 * @returns The selection, or an error.
 */
export function getSelection(apiCall: ApiCaller): Promise<ApiResult<SelectionData>> {
  return apiCall<SelectionData>(() => getSelectionUrl())
}
