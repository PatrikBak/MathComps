import { buildApiUrl } from '@/components/shared/utils/url-utils'

import type { SlotAddress } from '../model/selection-types'

/**
 * The base path the selection's endpoints hang off.
 */
const SELECTION_PATH = '/problem-selection'

/**
 * The path of one board.
 *
 * @param boardId - The board.
 *
 * @returns The path, below the API's base.
 */
function boardPath(boardId: string): string {
  // The board under the selection
  return `${SELECTION_PATH}/boards/${encodeURIComponent(boardId)}`
}

/**
 * The path of one slot.
 *
 * @param slot - The slot.
 *
 * @returns The path, below the API's base.
 */
function slotPath(slot: SlotAddress): string {
  // The paper within the board, and the position within that
  return `${boardPath(slot.boardId)}/papers/${encodeURIComponent(slot.paperId)}/slots/${slot.index}`
}

/**
 * The path of one proposal.
 *
 * @param proposalId - The proposal.
 *
 * @returns The path, below the API's base.
 */
function proposalPath(proposalId: string): string {
  // The proposal under the selection
  return `${SELECTION_PATH}/proposals/${encodeURIComponent(proposalId)}`
}

/**
 * Builds the API URL for reading the whole selection.
 *
 * @returns The API URL.
 */
export function getSelectionUrl(): string {
  // The selection's own endpoint
  return buildApiUrl(SELECTION_PATH)
}

/**
 * Builds the API URL for reading one conversation about a proposal in full.
 *
 * @param conversationId - The conversation.
 *
 * @returns The API URL.
 */
export function getConversationUrl(conversationId: string): string {
  // The conversation under the selection
  return buildApiUrl(`${SELECTION_PATH}/conversations/${encodeURIComponent(conversationId)}`)
}

/**
 * Builds the API URL for putting a proposal into a slot or emptying it.
 *
 * @param slot - The slot.
 *
 * @returns The API URL.
 */
export function getSlotUrl(slot: SlotAddress): string {
  // The slot's own endpoint
  return buildApiUrl(slotPath(slot))
}

/**
 * Builds the API URL for trading a slot with its neighbour.
 *
 * @param slot - The slot.
 *
 * @returns The API URL.
 */
export function getSlotMoveUrl(slot: SlotAddress): string {
  // The move endpoint for the slot
  return buildApiUrl(`${slotPath(slot)}/move`)
}

/**
 * Builds the API URL for finalizing a board into a cycle's rounds.
 *
 * @param boardId - The board.
 *
 * @returns The API URL.
 */
export function getFinalizationUrl(boardId: string): string {
  // The finalization endpoint for the board
  return buildApiUrl(`${boardPath(boardId)}/finalization`)
}

/**
 * Builds the API URL for deleting a proposal.
 *
 * @param proposalId - The proposal.
 *
 * @returns The API URL.
 */
export function getProposalUrl(proposalId: string): string {
  // The proposal's own endpoint
  return buildApiUrl(proposalPath(proposalId))
}

/**
 * Builds the API URL for setting a proposal aside or bringing it back.
 *
 * @param proposalId - The proposal.
 *
 * @returns The API URL.
 */
export function getSetAsideUrl(proposalId: string): string {
  // The set-aside endpoint for the proposal
  return buildApiUrl(`${proposalPath(proposalId)}/set-aside`)
}

/**
 * Builds the API URL for recommending a proposal for a category or taking it back.
 *
 * @param proposalId - The proposal.
 *
 * @returns The API URL.
 */
export function getRecommendedUrl(proposalId: string): string {
  // The recommendation endpoint for the proposal
  return buildApiUrl(`${proposalPath(proposalId)}/recommended`)
}
