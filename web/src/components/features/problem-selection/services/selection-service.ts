import type { ApiCaller } from '@/hooks/use-api'
import type { ApiResult } from '@/types/api'

import type {
  DiscussionsMarked,
  DiscussionsSeenWrite,
  FinalizationWrite,
  MoveWrite,
  PlacementWrite,
  RatingWrite,
  RecommendationWrite,
  SelectionData,
  SelectionDiscussions,
  SelectionDiscussionsSeen,
  SetAsideWrite,
  SlotAddress,
} from '../model/selection-types'
import {
  getDiscussionsSeenUrl,
  getDiscussionsUrl,
  getFinalizationUrl,
  getProposalUrl,
  getRatingUrl,
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
 * Reads an organization's whole selection in one go.
 *
 * @param apiCall - The authenticated API caller.
 * @param organization - The slug of the organization whose selection is read.
 *
 * @returns The selection, or an error.
 */
export function getSelection(
  apiCall: ApiCaller,
  organization: string
): Promise<ApiResult<SelectionData>> {
  return apiCall<SelectionData>(() => getSelectionUrl(organization))
}

/**
 * Reads the reviewers' discussion of every proposal and paper an organization's selection holds, leaving out the
 * ones nothing has been said in.
 *
 * @param apiCall - The authenticated API caller.
 * @param organization - The slug of the organization whose selection holds the discussions.
 *
 * @returns The discussions, or an error.
 */
export function getDiscussions(
  apiCall: ApiCaller,
  organization: string
): Promise<ApiResult<SelectionDiscussions>> {
  return apiCall<SelectionDiscussions>(() => getDiscussionsUrl(organization))
}

/**
 * Reads how far the reader has seen the discussion of every proposal and paper an organization's selection holds,
 * each beside when somebody else last posted in it.
 *
 * @param apiCall - The authenticated API caller.
 * @param organization - The slug of the organization whose selection holds the discussions.
 *
 * @returns How far each discussion is seen, or an error.
 */
export function getDiscussionsSeen(
  apiCall: ApiCaller,
  organization: string
): Promise<ApiResult<SelectionDiscussionsSeen>> {
  return apiCall<SelectionDiscussionsSeen>(() => getDiscussionsSeenUrl(organization))
}

/**
 * Marks the discussions of some of what an organization's selection holds as seen by the reader up to a moment, held
 * to now. A discussion already seen further along stays so, and whatever the selection doesn't hold is passed over.
 *
 * @param apiCall - The authenticated API caller.
 * @param organization - The slug of the organization whose selection holds the discussions.
 * @param write - The proposals and papers whose discussions were seen, and the moment they were seen up to.
 *
 * @returns The moment the discussions were marked as seen up to, or an error.
 */
export function markDiscussionsSeen(
  apiCall: ApiCaller,
  organization: string,
  write: DiscussionsSeenWrite
): Promise<ApiResult<DiscussionsMarked>> {
  return apiCall<DiscussionsMarked>(() => getDiscussionsSeenUrl(organization), {
    method: 'PUT',
    body: JSON.stringify(write),
  })
}

/**
 * Puts a proposal into a slot. One already on the same board trades places with whatever held the slot.
 *
 * @param apiCall - The authenticated API caller.
 * @param organization - The slug of the organization whose selection holds the slot's board.
 * @param placement - The proposal and the slot it goes into.
 *
 * @returns Success, or an error.
 */
export function placeProposal(
  apiCall: ApiCaller,
  organization: string,
  { slot, proposalId }: PlacementWrite
): Promise<ApiResult<void>> {
  return apiCall<void>(() => getSlotUrl(organization, slot), {
    method: 'PUT',
    body: JSON.stringify({ proposalId }),
  })
}

/**
 * Empties a slot on a draft board, sending its problem back to the pool.
 *
 * @param apiCall - The authenticated API caller.
 * @param organization - The slug of the organization whose selection holds the slot's board.
 * @param slot - The slot.
 *
 * @returns Success, or an error.
 */
export function clearSlot(
  apiCall: ApiCaller,
  organization: string,
  slot: SlotAddress
): Promise<ApiResult<void>> {
  return apiCall<void>(() => getSlotUrl(organization, slot), { method: 'DELETE' })
}

/**
 * Trades a slot with its neighbour in the same paper.
 *
 * @param apiCall - The authenticated API caller.
 * @param organization - The slug of the organization whose selection holds the slot's board.
 * @param move - The slot and the neighbour it trades with.
 *
 * @returns Success, or an error.
 */
export function moveSlot(
  apiCall: ApiCaller,
  organization: string,
  { slot, direction }: MoveWrite
): Promise<ApiResult<void>> {
  return apiCall<void>(() => getSlotMoveUrl(organization, slot), {
    method: 'POST',
    body: JSON.stringify({ direction }),
  })
}

/**
 * Finalizes a board into a cycle's rounds.
 *
 * @param apiCall - The authenticated API caller.
 * @param organization - The slug of the organization whose selection holds the board.
 * @param finalization - The board and the cycle it goes into.
 *
 * @returns Success, or an error.
 */
export function finalizeBoard(
  apiCall: ApiCaller,
  organization: string,
  { boardId, cycleId }: FinalizationWrite
): Promise<ApiResult<void>> {
  return apiCall<void>(() => getFinalizationUrl(organization, boardId), {
    method: 'POST',
    body: JSON.stringify({ cycleId }),
  })
}

/**
 * Sets a proposal aside, or brings it back.
 *
 * @param apiCall - The authenticated API caller.
 * @param organization - The slug of the organization whose pool holds the proposal.
 * @param change - The proposal and where it stands afterwards.
 *
 * @returns Success, or an error.
 */
export function setAside(
  apiCall: ApiCaller,
  organization: string,
  { proposalId, isSetAside }: SetAsideWrite
): Promise<ApiResult<void>> {
  return apiCall<void>(() => getSetAsideUrl(organization, proposalId), {
    method: 'PUT',
    body: JSON.stringify({ isSetAside }),
  })
}

/**
 * Recommends a proposal for one category, or takes the recommendation back.
 *
 * @param apiCall - The authenticated API caller.
 * @param organization - The slug of the organization whose pool holds the proposal.
 * @param change - The proposal, the category and whether it is recommended for it afterwards.
 *
 * @returns Success, or an error.
 */
export function setRecommended(
  apiCall: ApiCaller,
  organization: string,
  { proposalId, category, isRecommended }: RecommendationWrite
): Promise<ApiResult<void>> {
  return apiCall<void>(() => getRecommendedUrl(organization, proposalId), {
    method: 'PUT',
    body: JSON.stringify({ category, isRecommended }),
  })
}

/**
 * Sets the reader's rating of a proposal, or takes it back.
 *
 * @param apiCall - The authenticated API caller.
 * @param organization - The slug of the organization whose pool holds the proposal.
 * @param change - The proposal and the reader's scores afterwards.
 *
 * @returns Success, or an error.
 */
export function setRating(
  apiCall: ApiCaller,
  organization: string,
  { proposalId, scores }: RatingWrite
): Promise<ApiResult<void>> {
  return apiCall<void>(() => getRatingUrl(organization, proposalId), {
    method: 'PUT',
    body: JSON.stringify(scores),
  })
}

/**
 * Deletes a proposal from the selection, emptying every draft slot it held.
 *
 * @param apiCall - The authenticated API caller.
 * @param organization - The slug of the organization whose pool holds the proposal.
 * @param proposalId - The proposal.
 *
 * @returns Success, or an error.
 */
export function deleteProposal(
  apiCall: ApiCaller,
  organization: string,
  proposalId: string
): Promise<ApiResult<void>> {
  return apiCall<void>(() => getProposalUrl(organization, proposalId), { method: 'DELETE' })
}
