import type { ApiCaller } from '@/hooks/use-api'
import type { ApiResult } from '@/types/api'

import type { ReviewTranscript, SelectionData } from '../model/selection-types'
import { getConversationUrl, getSelectionUrl } from './selection-api-urls'

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

/**
 * Reads everything said in one conversation about a proposal.
 *
 * @param apiCall - The authenticated API caller.
 * @param conversationId - The conversation.
 *
 * @returns The conversation's statement and turns, or an error.
 */
export function getTranscript(
  apiCall: ApiCaller,
  conversationId: string
): Promise<ApiResult<ReviewTranscript>> {
  return apiCall<ReviewTranscript>(() => getConversationUrl(conversationId))
}
