import type { ApiCaller } from '@/hooks/use-api'
import type { ApiResult } from '@/types/api'

import type {
  FinalizationWrite,
  MoveWrite,
  PlacementWrite,
  RecommendationWrite,
  ReviewTranscript,
  SelectionData,
  SetAsideWrite,
  SlotAddress,
} from '../model/selection-types'
import {
  getConversationUrl,
  getFinalizationUrl,
  getProposalUrl,
  getRecommendedUrl,
  getSelectionUrl,
  getSetAsideUrl,
  getSlotMoveUrl,
  getSlotUrl,
} from './selection-api-urls'

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

/**
 * Puts a proposal into a slot. One already on the same board trades places with whatever held the slot.
 *
 * @param apiCall - The authenticated API caller.
 * @param placement - The proposal and the slot it goes into.
 *
 * @returns Success, or an error.
 */
export function placeProposal(
  apiCall: ApiCaller,
  { slot, proposalId }: PlacementWrite
): Promise<ApiResult<void>> {
  return apiCall<void>(() => getSlotUrl(slot), {
    method: 'PUT',
    body: JSON.stringify({ proposalId }),
  })
}

/**
 * Empties a slot on a draft board, sending its problem back to the pool.
 *
 * @param apiCall - The authenticated API caller.
 * @param slot - The slot.
 *
 * @returns Success, or an error.
 */
export function clearSlot(apiCall: ApiCaller, slot: SlotAddress): Promise<ApiResult<void>> {
  return apiCall<void>(() => getSlotUrl(slot), { method: 'DELETE' })
}

/**
 * Trades a slot with its neighbour in the same paper.
 *
 * @param apiCall - The authenticated API caller.
 * @param move - The slot and the neighbour it trades with.
 *
 * @returns Success, or an error.
 */
export function moveSlot(
  apiCall: ApiCaller,
  { slot, direction }: MoveWrite
): Promise<ApiResult<void>> {
  return apiCall<void>(() => getSlotMoveUrl(slot), {
    method: 'POST',
    body: JSON.stringify({ direction }),
  })
}

/**
 * Finalizes a board into a cycle's rounds.
 *
 * @param apiCall - The authenticated API caller.
 * @param finalization - The board and the cycle it goes into.
 *
 * @returns Success, or an error.
 */
export function finalizeBoard(
  apiCall: ApiCaller,
  { boardId, cycleId }: FinalizationWrite
): Promise<ApiResult<void>> {
  return apiCall<void>(() => getFinalizationUrl(boardId), {
    method: 'POST',
    body: JSON.stringify({ cycleId }),
  })
}

/**
 * Sets a proposal aside, or brings it back.
 *
 * @param apiCall - The authenticated API caller.
 * @param change - The proposal and where it stands afterwards.
 *
 * @returns Success, or an error.
 */
export function setAside(
  apiCall: ApiCaller,
  { proposalId, isSetAside }: SetAsideWrite
): Promise<ApiResult<void>> {
  return apiCall<void>(() => getSetAsideUrl(proposalId), {
    method: 'PUT',
    body: JSON.stringify({ isSetAside }),
  })
}

/**
 * Recommends a proposal for one category, or takes the recommendation back.
 *
 * @param apiCall - The authenticated API caller.
 * @param change - The proposal, the category and whether it is recommended for it afterwards.
 *
 * @returns Success, or an error.
 */
export function setRecommended(
  apiCall: ApiCaller,
  { proposalId, category, isRecommended }: RecommendationWrite
): Promise<ApiResult<void>> {
  return apiCall<void>(() => getRecommendedUrl(proposalId), {
    method: 'PUT',
    body: JSON.stringify({ category, isRecommended }),
  })
}

/**
 * Deletes a proposal from the selection, emptying every draft slot it held.
 *
 * @param apiCall - The authenticated API caller.
 * @param proposalId - The proposal.
 *
 * @returns Success, or an error.
 */
export function deleteProposal(apiCall: ApiCaller, proposalId: string): Promise<ApiResult<void>> {
  return apiCall<void>(() => getProposalUrl(proposalId), { method: 'DELETE' })
}
