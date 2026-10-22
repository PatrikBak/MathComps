import { buildApiUrl } from '@/components/shared/utils/url-utils'

import type { SlotAddress } from '../model/selection-types'

/**
 * The path each organization's selection hangs off.
 */
const ORGANIZATIONS_PATH = '/problem-selection'

/**
 * The base path of one organization's selection.
 *
 * @param organization - The organization's slug.
 *
 * @returns The path, below the API's base.
 */
function selectionPath(organization: string): string {
  // The organization's selection, under the path every selection hangs off
  return `${ORGANIZATIONS_PATH}/${encodeURIComponent(organization)}`
}

/**
 * The path of one board.
 *
 * @param organization - The slug of the organization whose selection holds the board.
 * @param boardId - The board.
 *
 * @returns The path, below the API's base.
 */
function boardPath(organization: string, boardId: string): string {
  // The board under the organization's selection
  return `${selectionPath(organization)}/boards/${encodeURIComponent(boardId)}`
}

/**
 * The path of one slot.
 *
 * @param organization - The slug of the organization whose selection holds the slot's board.
 * @param slot - The slot.
 *
 * @returns The path, below the API's base.
 */
function slotPath(organization: string, slot: SlotAddress): string {
  // The paper within the board, and the position within that
  return `${boardPath(organization, slot.boardId)}/papers/${encodeURIComponent(slot.paperId)}/slots/${slot.index}`
}

/**
 * The path of one proposal.
 *
 * @param organization - The slug of the organization whose pool holds the proposal.
 * @param proposalId - The proposal.
 *
 * @returns The path, below the API's base.
 */
function proposalPath(organization: string, proposalId: string): string {
  // The proposal under the organization's selection
  return `${selectionPath(organization)}/proposals/${encodeURIComponent(proposalId)}`
}

/**
 * Builds the API URL for reading an organization's whole selection.
 *
 * @param organization - The organization's slug.
 *
 * @returns The API URL.
 */
export function getSelectionUrl(organization: string): string {
  // The selection's own endpoint
  return buildApiUrl(selectionPath(organization))
}

/**
 * Builds the API URL for reading the discussions of everything an organization's selection holds.
 *
 * @param organization - The organization's slug.
 *
 * @returns The API URL.
 */
export function getDiscussionsUrl(organization: string): string {
  // The discussions under the selection
  return buildApiUrl(`${selectionPath(organization)}/comments`)
}

/**
 * Builds the API URL for reading and marking how far the reader has seen the discussions of everything an
 * organization's selection holds.
 *
 * @param organization - The organization's slug.
 *
 * @returns The API URL.
 */
export function getDiscussionsSeenUrl(organization: string): string {
  // How far the discussions are seen, under the discussions
  return buildApiUrl(`${selectionPath(organization)}/comments/seen`)
}

/**
 * Builds the API URL for putting a proposal into a slot or emptying it.
 *
 * @param organization - The slug of the organization whose selection holds the slot's board.
 * @param slot - The slot.
 *
 * @returns The API URL.
 */
export function getSlotUrl(organization: string, slot: SlotAddress): string {
  // The slot's own endpoint
  return buildApiUrl(slotPath(organization, slot))
}

/**
 * Builds the API URL for trading a slot with its neighbour.
 *
 * @param organization - The slug of the organization whose selection holds the slot's board.
 * @param slot - The slot.
 *
 * @returns The API URL.
 */
export function getSlotMoveUrl(organization: string, slot: SlotAddress): string {
  // The move endpoint for the slot
  return buildApiUrl(`${slotPath(organization, slot)}/move`)
}

/**
 * Builds the API URL for finalizing a board into a cycle's rounds.
 *
 * @param organization - The slug of the organization whose selection holds the board.
 * @param boardId - The board.
 *
 * @returns The API URL.
 */
export function getFinalizationUrl(organization: string, boardId: string): string {
  // The finalization endpoint for the board
  return buildApiUrl(`${boardPath(organization, boardId)}/finalization`)
}

/**
 * Builds the API URL for deleting a proposal.
 *
 * @param organization - The slug of the organization whose pool holds the proposal.
 * @param proposalId - The proposal.
 *
 * @returns The API URL.
 */
export function getProposalUrl(organization: string, proposalId: string): string {
  // The proposal's own endpoint
  return buildApiUrl(proposalPath(organization, proposalId))
}

/**
 * Builds the API URL for setting a proposal aside or bringing it back.
 *
 * @param organization - The slug of the organization whose pool holds the proposal.
 * @param proposalId - The proposal.
 *
 * @returns The API URL.
 */
export function getSetAsideUrl(organization: string, proposalId: string): string {
  // The set-aside endpoint for the proposal
  return buildApiUrl(`${proposalPath(organization, proposalId)}/set-aside`)
}

/**
 * Builds the API URL for recommending a proposal for a category or taking it back.
 *
 * @param organization - The slug of the organization whose pool holds the proposal.
 * @param proposalId - The proposal.
 *
 * @returns The API URL.
 */
export function getRecommendedUrl(organization: string, proposalId: string): string {
  // The recommendation endpoint for the proposal
  return buildApiUrl(`${proposalPath(organization, proposalId)}/recommended`)
}

/**
 * Builds the API URL for setting the reader's rating of a proposal or taking it back.
 *
 * @param organization - The slug of the organization whose pool holds the proposal.
 * @param proposalId - The proposal.
 *
 * @returns The API URL.
 */
export function getRatingUrl(organization: string, proposalId: string): string {
  // The rating endpoint for the proposal
  return buildApiUrl(`${proposalPath(organization, proposalId)}/rating`)
}
