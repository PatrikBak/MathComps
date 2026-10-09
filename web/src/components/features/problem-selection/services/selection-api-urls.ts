import { buildApiUrl } from '@/components/shared/utils/url-utils'

import type { SlotAddress } from '../model/selection-types'

/**
 * The base path the selection's endpoints hang off.
 */
const SELECTION_PATH = '/problem-selection'

/**
 * The path of one slot.
 *
 * @param slot - The slot.
 *
 * @returns The path, below the API's base.
 */
function slotPath(slot: SlotAddress): string {
  // The board under the selection
  const board = `${SELECTION_PATH}/boards/${encodeURIComponent(slot.boardId)}`

  // The paper within it, and the position within that
  return `${board}/papers/${encodeURIComponent(slot.paperId)}/slots/${slot.index}`
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
